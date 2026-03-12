import crypto from "crypto";
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

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) badRequest(`${name} is not configured`);
  return value;
}

function formEncode(data: Record<string, string>): string {
  return new URLSearchParams(data).toString();
}

export async function createStripeCheckoutSession(input: CheckoutSessionRequest): Promise<StripeCheckoutSessionResponse> {
  const secretKey = requireEnv("STRIPE_SECRET_KEY");
  const hasPriceId = !!input.priceId?.trim();
  const lineItem = input.lineItem ?? null;
  if (!hasPriceId && !lineItem) badRequest("Stripe checkout session requires a price or line item");
  const body: Record<string, string> = {
    mode: "payment",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  };
  body["line_items[0][quantity]"] = "1";
  if (hasPriceId && input.priceId) {
    body["line_items[0][price]"] = input.priceId;
  } else if (lineItem) {
    const currency = lineItem.currency.trim().toLowerCase();
    if (!/^[a-z]{3}$/.test(currency)) badRequest("Invalid checkout currency");
    if (!Number.isInteger(lineItem.amountCents) || lineItem.amountCents <= 0) badRequest("Invalid checkout amount");
    body["line_items[0][price_data][currency]"] = currency;
    body["line_items[0][price_data][unit_amount]"] = String(lineItem.amountCents);
    body["line_items[0][price_data][product_data][name]"] = lineItem.productName.trim() || "Splann-O payment";
    if (lineItem.productDescription?.trim()) {
      body["line_items[0][price_data][product_data][description]"] = lineItem.productDescription.trim();
    }
  }

  for (const [k, v] of Object.entries(input.metadata)) {
    body[`metadata[${k}]`] = v;
  }

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {}),
    },
    body: formEncode(body),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (payload as { error?: { message?: string } }).error?.message ?? "Failed to create Stripe Checkout session";
    badRequest(message);
  }
  return payload as StripeCheckoutSessionResponse;
}

export async function retrieveStripeCheckoutSession(sessionId: string): Promise<StripeCheckoutSessionDetails> {
  const secretKey = requireEnv("STRIPE_SECRET_KEY");
  const trimmedId = sessionId.trim();
  if (!trimmedId) badRequest("Invalid checkout session id");

  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(trimmedId)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (payload as { error?: { message?: string } }).error?.message ?? "Failed to load Stripe Checkout session";
    badRequest(message);
  }
  return payload as StripeCheckoutSessionDetails;
}

export function verifyStripeWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): unknown {
  const webhookSecret = requireEnv("STRIPE_WEBHOOK_SECRET");
  if (!signatureHeader) badRequest("Missing Stripe signature");

  const parts = signatureHeader.split(",").map((s) => s.trim());
  const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2);
  const signatures = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!timestamp || signatures.length === 0) badRequest("Invalid Stripe signature header");

  const signedPayload = `${timestamp}.${rawBody.toString("utf8")}`;
  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(signedPayload)
    .digest("hex");

  const valid = signatures.some((sig) => {
    try {
      return crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
    } catch {
      return false;
    }
  });
  if (!valid) badRequest("Invalid Stripe signature");

  return JSON.parse(rawBody.toString("utf8"));
}
