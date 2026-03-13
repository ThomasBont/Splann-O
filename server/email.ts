/**
 * Splanno email system via Resend.
 *
 * Environment variables:
 *   RESEND_API_KEY   — API key for Resend; if missing in development, emails are logged to console and treated as sent.
 *   BASE_URL         — Base URL of the app (e.g. https://splanno.app); falls back to localhost in development.
 */
import { resolveBaseUrl } from "./config/env";

const APP_NAME = "Splann-O";
const FROM = process.env.EMAIL_FROM ?? "Splann-O <noreply@resend.dev>";
const BRAND_COLOR = "#111827";
const ACCENT_COLOR = "#2563eb";
const APP_URL = resolveBaseUrl();
const FETCH_TIMEOUT_MS = 10_000;

function isDevMailMode(): boolean {
  return process.env.NODE_ENV === "development" && !process.env.RESEND_API_KEY;
}

/** Log a DEV MAIL block when Resend is unavailable in development. URLs on own lines for click/copy. */
function logDevMail(subject: string, to: string, lines: string[]): void {
  const sep = "─────────────────────────────────────────────────────────────";
  const block = ["", sep, "  DEV MAIL (not sent — no RESEND_API_KEY)", sep, `  To:      ${to}`, `  Subject: ${subject}`, "", ...lines.map((l) => `  ${l}`), sep, ""];
  console.log(block.join("\n"));
}

interface LayoutOpts {
  title: string;
  preheader?: string;
  bodyHtml: string;
  ctaText?: string;
  ctaUrl?: string;
  footer?: string;
}

function layout(opts: LayoutOpts): string {
  const preheader = opts.preheader
    ? `<span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${opts.preheader}</span>`
    : "";
  const ctaSection =
    opts.ctaText && opts.ctaUrl
      ? `
        <p style="margin: 24px 0 32px;">
          <a href="${opts.ctaUrl}" style="display:inline-block;background:${ACCENT_COLOR};color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
            ${opts.ctaText}
          </a>
        </p>`
      : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${opts.title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;color:${BRAND_COLOR};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased;">
  ${preheader}
  <div style="max-width:520px;margin:0 auto;padding:40px 24px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#ffffff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
      <tr>
        <td style="padding:40px 32px;">
          <h1 style="margin:0 0 24px;font-size:24px;font-weight:700;color:${BRAND_COLOR};">
            ${opts.title}
          </h1>
          <div style="color:#374151;font-size:16px;line-height:1.65;">
            ${opts.bodyHtml}
            ${ctaSection}
          </div>
          <p style="margin:32px 0 0;padding-top:24px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:13px;">
            ${opts.footer ?? `© ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.`}
          </p>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}

interface SendEmailOpts {
  to: string;
  subject: string;
  html: string;
}

async function sendEmail(opts: SendEmailOpts): Promise<{ sent: boolean }> {
  const { to, subject, html } = opts;

  if (isDevMailMode()) {
    logDevMail(subject, to, ["(preview omitted)"]);
    return { sent: true };
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY is missing in production. Email not sent.", { to, subject });
    return { sent: false };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const bodyText = await res.text();
      console.error("[email] Resend error:", {
        status: res.status,
        statusText: res.statusText,
        body: bodyText,
      });
      return { sent: false };
    }

    return { sent: true };
  } catch (err) {
    clearTimeout(timeoutId);
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout = msg.includes("abort") || err instanceof Error && err.name === "AbortError";
    console.error("[email] Failed to send:", isTimeout ? "request timeout" : msg);
    return { sent: false };
  }
}

export async function sendWelcomeEmail(toEmail: string, displayName: string): Promise<{ sent: boolean }> {
  const name = displayName?.trim() || "there";
  const openUrl = APP_URL;

  if (isDevMailMode()) {
    logDevMail("Welcome to Splann-O", toEmail, [`OPEN URL: ${openUrl}`, `COPY: ${openUrl}`]);
    return { sent: true };
  }

  const html = layout({
    title: `Welcome to ${APP_NAME}`,
    preheader: "You're all set. Create trips, split costs, and manage expenses together.",
    bodyHtml: `
      <p style="margin:0 0 16px;">Hey <strong>${name}</strong>,</p>
      <p style="margin:0 0 16px;">Welcome! Your account is ready. Create trips and events, add expenses, and split the bill with friends—with support for multiple currencies.</p>
      <p style="margin:0 0 16px;">Get started by creating your first event or trip.</p>
    `,
    ctaText: "Open Splann-O",
    ctaUrl: openUrl,
    footer: `© ${new Date().getFullYear()} ${APP_NAME}. Create events, split costs, settle up.`,
  });

  return sendEmail({ to: toEmail, subject: "Welcome to Splann-O", html });
}

export async function sendPasswordResetEmail(toEmail: string, resetUrl: string): Promise<{ sent: boolean }> {
  const url = resetUrl?.trim();
  if (!url) {
    console.error("[email] sendPasswordResetEmail: resetUrl is empty");
    return { sent: false };
  }

  if (isDevMailMode()) {
    logDevMail("Reset your Splann-O password", toEmail, [`RESET URL: ${url}`, `COPY: ${url}`]);
    return { sent: true };
  }

  const html = layout({
    title: "Reset your password",
    preheader: "Click the button below to set a new password. This link expires in 1 hour.",
    bodyHtml: `
      <p style="margin:0 0 16px;">You requested a password reset for your Splann-O account.</p>
      <p style="margin:0 0 16px;">Click the button below to set a new password. This link expires in <strong>1 hour</strong>. If you didn't request this, you can safely ignore this email.</p>
      <p style="margin:16px 0 0;font-size:14px;color:#6b7280;">If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="margin:8px 0 0;word-break:break-all;font-size:13px;color:${ACCENT_COLOR};">${url}</p>
    `,
    ctaText: "Reset password",
    ctaUrl: url,
    footer: `© ${new Date().getFullYear()} ${APP_NAME}. If you didn't request this, ignore this email.`,
  });

  return sendEmail({ to: toEmail, subject: "Reset your Splann-O password", html });
}

export async function sendEmailVerificationEmail(toEmail: string, displayName: string, verifyUrl: string): Promise<{ sent: boolean }> {
  const url = verifyUrl?.trim();
  if (!url) {
    console.error("[email] sendEmailVerificationEmail: verifyUrl is empty");
    return { sent: false };
  }

  const name = displayName?.trim() || "there";

  if (isDevMailMode()) {
    logDevMail("Verify your Splann-O email", toEmail, [`VERIFY URL: ${url}`, `COPY: ${url}`]);
    return { sent: true };
  }

  const html = layout({
    title: "Verify your email",
    preheader: "Click the button below to verify your Splann-O account. This link expires in 24 hours.",
    bodyHtml: `
      <p style="margin:0 0 16px;">Hey <strong>${name}</strong>,</p>
      <p style="margin:0 0 16px;">Please verify your email address to complete your Splann-O account setup.</p>
      <p style="margin:0 0 16px;">Click the button below. This link expires in <strong>24 hours</strong>. If you didn't create an account, you can safely ignore this email.</p>
      <p style="margin:16px 0 0;font-size:14px;color:#6b7280;">If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="margin:8px 0 0;word-break:break-all;font-size:13px;color:${ACCENT_COLOR};">${url}</p>
    `,
    ctaText: "Verify email",
    ctaUrl: url,
    footer: `© ${new Date().getFullYear()} ${APP_NAME}. If you didn't create an account, ignore this email.`,
  });

  return sendEmail({ to: toEmail, subject: "Verify your Splann-O email", html });
}
