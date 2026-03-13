import express, { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { stripeEvents } from "@shared/schema";
import { db } from "../db";
import { log } from "../lib/logger";
import { broadcastEventRealtime } from "../lib/eventRealtime";
import { reconcileStripeSettlementCheckout } from "../lib/stripeCheckoutReconciliation";
import { constructStripeWebhookEvent, getStripeClient } from "../lib/stripe";
import * as bbqService from "../services/bbqService";

const router = Router();

type StripeMetadata = Record<string, string | undefined>;

function normalizeMetadata(input: Stripe.Metadata | null | undefined): StripeMetadata {
  if (!input) return {};
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, typeof value === "string" ? value : undefined]),
  );
}

async function hasProcessedStripeEvent(eventId: string): Promise<boolean> {
  const existing = await db.select().from(stripeEvents).where(eq(stripeEvents.id, eventId)).limit(1);
  return existing.length > 0;
}

async function markStripeEventProcessed(eventId: string): Promise<void> {
  await db.insert(stripeEvents).values({ id: eventId }).onConflictDoNothing({ target: stripeEvents.id });
}

async function processCheckoutSessionCompleted(event: Stripe.Event, sessionObject: Stripe.Checkout.Session): Promise<void> {
  const session = await getStripeClient().checkout.sessions.retrieve(sessionObject.id);
  const metadata = normalizeMetadata(session.metadata);
  const action = metadata.action ?? metadata.intendedAction ?? null;
  const planId = Number(metadata.eventId ?? metadata.planId ?? "");
  const expenseId = metadata.expenseId ? Number(metadata.expenseId) : null;
  const payerId = Number(metadata.payerUserId ?? metadata.userId ?? metadata.payerId ?? "");

  log("info", "Stripe webhook checkout.session.completed", {
    stripeEventId: event.id,
    checkoutSessionId: session.id,
    action,
    paymentStatus: session.payment_status ?? null,
    planId: Number.isFinite(planId) ? planId : null,
    expenseId: Number.isFinite(expenseId) ? expenseId : null,
    payerId: Number.isFinite(payerId) ? payerId : null,
    metadata,
  });

  if (action === "activate_public_listing" && Number.isFinite(planId)) {
    const publishAfterActivation = metadata.publishAfterActivation === "true";
    const publicMode = metadata.publicMode === "joinable" ? "joinable" : metadata.publicMode === "marketing" ? "marketing" : undefined;
    await bbqService.activateListingBySystem(planId, {
      publishAfterActivation,
      publicMode,
    });
    return;
  }

  const result = await reconcileStripeSettlementCheckout({
    metadata,
    paymentStatus: session.payment_status ?? null,
  });
  log("info", "Stripe webhook checkout.session.completed reconciliation result", {
    stripeEventId: event.id,
    checkoutSessionId: session.id,
    reconciled: result.reconciled,
    eventId: result.eventId,
  });
}

async function processPaymentIntentSucceeded(event: Stripe.Event, paymentIntent: Stripe.PaymentIntent): Promise<void> {
  const metadata = normalizeMetadata(paymentIntent.metadata);
  const action = metadata.action ?? metadata.intendedAction ?? null;
  const planId = Number(metadata.eventId ?? metadata.planId ?? "");
  const expenseId = metadata.expenseId ? Number(metadata.expenseId) : null;
  const payerId = Number(metadata.payerUserId ?? metadata.userId ?? metadata.payerId ?? "");

  log("info", "Stripe webhook payment_intent.succeeded", {
    stripeEventId: event.id,
    paymentIntentId: paymentIntent.id,
    action,
    status: paymentIntent.status,
    planId: Number.isFinite(planId) ? planId : null,
    expenseId: Number.isFinite(expenseId) ? expenseId : null,
    payerId: Number.isFinite(payerId) ? payerId : null,
    metadata,
  });

  const result = await reconcileStripeSettlementCheckout({
    metadata,
    paymentStatus: paymentIntent.status === "succeeded" ? "paid" : paymentIntent.status,
  });
  log("info", "Stripe webhook payment_intent.succeeded reconciliation result", {
    stripeEventId: event.id,
    paymentIntentId: paymentIntent.id,
    reconciled: result.reconciled,
    eventId: result.eventId,
  });
}

async function processPaymentIntentFailed(event: Stripe.Event, paymentIntent: Stripe.PaymentIntent): Promise<void> {
  const metadata = normalizeMetadata(paymentIntent.metadata);
  const planId = Number(metadata.eventId ?? metadata.planId ?? "");
  const action = metadata.action ?? metadata.intendedAction ?? null;

  log("warn", "Stripe webhook payment_intent.payment_failed", {
    stripeEventId: event.id,
    paymentIntentId: paymentIntent.id,
    action,
    planId: Number.isFinite(planId) ? planId : null,
    lastPaymentError: paymentIntent.last_payment_error?.message ?? null,
    metadata,
  });

  if (Number.isFinite(planId)) {
    broadcastEventRealtime(planId, {
      type: "settlement_payment_failed",
      eventId: planId,
      paymentIntentId: paymentIntent.id,
      metadata,
    });
  }
}

router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response) => {
    const rawBody = req.body;
    if (!Buffer.isBuffer(rawBody)) {
      log("warn", "Stripe webhook missing raw body");
      res.status(400).send("Missing raw webhook body");
      return;
    }

    let event: Stripe.Event;
    try {
      event = constructStripeWebhookEvent(rawBody, req.headers["stripe-signature"]);
    } catch (error) {
      log("warn", "Stripe webhook signature verification failed", {
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      res.status(400).send("Invalid signature");
      return;
    }

    try {
      if (await hasProcessedStripeEvent(event.id)) {
        log("info", "Stripe webhook duplicate ignored", {
          stripeEventId: event.id,
          eventType: event.type,
        });
        res.status(200).json({ received: true, duplicate: true });
        return;
      }

      switch (event.type) {
        case "checkout.session.completed":
          await processCheckoutSessionCompleted(event, event.data.object as Stripe.Checkout.Session);
          break;
        case "payment_intent.succeeded":
          await processPaymentIntentSucceeded(event, event.data.object as Stripe.PaymentIntent);
          break;
        case "payment_intent.payment_failed":
          await processPaymentIntentFailed(event, event.data.object as Stripe.PaymentIntent);
          break;
        default:
          log("info", "Stripe webhook event ignored", {
            stripeEventId: event.id,
            eventType: event.type,
          });
          break;
      }

      await markStripeEventProcessed(event.id);
      res.status(200).json({ received: true });
    } catch (error) {
      log("error", "Stripe webhook processing failed", {
        stripeEventId: event.id,
        eventType: event.type,
        errorMessage: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(200).json({ received: true, processingError: true });
    }
  },
);

export default router;
