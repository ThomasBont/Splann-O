import crypto from "crypto";
import { badRequest } from "./errors";

type CheckoutSessionRequest = {
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
};

type StripeCheckoutSessionResponse = {
  id: string;
  url: string | null;
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
  const body: Record<string, string> = {
    mode: "payment",
    "line_items[0][price]": input.priceId,
    "line_items[0][quantity]": "1",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  };

  for (const [k, v] of Object.entries(input.metadata)) {
    body[`metadata[${k}]`] = v;
  }

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
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
