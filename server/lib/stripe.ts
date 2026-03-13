import Stripe from "stripe";
import { badRequest } from "./errors";

type CheckoutSessionRequest = {
  priceId?: string;
  lineItem?: {
    amountCents: number;
    currency: string;
    productName: string;
    productDescription?: string;
  };
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
  idempotencyKey?: string;
};

type StripeCheckoutSessionResponse = {
  id: string;
  url: string | null;
};

export type StripeCheckoutSessionDetails = {
  id: string;
  url: string | null;
  payment_status?: string;
  metadata?: Record<string, string | undefined>;
};

let stripeClient: Stripe | null = null;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) badRequest(`${name} is not configured`);
  return value;
}

export function getStripeClient(): Stripe {
  if (stripeClient) return stripeClient;
  stripeClient = new Stripe(requireEnv("STRIPE_SECRET_KEY"));
  return stripeClient;
}

export async function createStripeCheckoutSession(input: CheckoutSessionRequest): Promise<StripeCheckoutSessionResponse> {
  const hasPriceId = !!input.priceId?.trim();
  const lineItem = input.lineItem ?? null;
  if (!hasPriceId && !lineItem) badRequest("Stripe checkout session requires a price or line item");

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  if (hasPriceId && input.priceId) {
    lineItems.push({
      price: input.priceId,
      quantity: 1,
    });
  } else if (lineItem) {
    const currency = lineItem.currency.trim().toLowerCase();
    if (!/^[a-z]{3}$/.test(currency)) badRequest("Invalid checkout currency");
    if (!Number.isInteger(lineItem.amountCents) || lineItem.amountCents <= 0) badRequest("Invalid checkout amount");
    lineItems.push({
      quantity: 1,
      price_data: {
        currency,
        unit_amount: lineItem.amountCents,
        product_data: {
          name: lineItem.productName.trim() || "Splann-O payment",
          ...(lineItem.productDescription?.trim()
            ? { description: lineItem.productDescription.trim() }
            : {}),
        },
      },
    });
  }

  try {
    const session = await getStripeClient().checkout.sessions.create(
      {
        mode: "payment",
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata: input.metadata,
        payment_intent_data: {
          metadata: input.metadata,
        },
        line_items: lineItems,
      },
      input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined,
    );
    return {
      id: session.id,
      url: session.url ?? null,
    };
  } catch (error) {
    const message = error instanceof Stripe.errors.StripeError
      ? error.message
      : "Failed to create Stripe Checkout session";
    badRequest(message);
  }
}

export async function retrieveStripeCheckoutSession(sessionId: string): Promise<StripeCheckoutSessionDetails> {
  const trimmedId = sessionId.trim();
  if (!trimmedId) badRequest("Invalid checkout session id");
  try {
    const session = await getStripeClient().checkout.sessions.retrieve(trimmedId);
    return {
      id: session.id,
      url: session.url ?? null,
      payment_status: session.payment_status ?? undefined,
      metadata: session.metadata ?? undefined,
    };
  } catch (error) {
    const message = error instanceof Stripe.errors.StripeError
      ? error.message
      : "Failed to load Stripe Checkout session";
    badRequest(message);
  }
}

export function constructStripeWebhookEvent(rawBody: Buffer, signatureHeader: string | string[] | undefined): Stripe.Event {
  const webhookSecret = requireEnv("STRIPE_WEBHOOK_SECRET");
  const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
  if (!signature) badRequest("Missing Stripe signature");
  try {
    return getStripeClient().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid Stripe signature";
    badRequest(message);
  }
}
