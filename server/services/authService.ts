import bcrypt from "bcryptjs";
import crypto from "crypto";
import { userRepo } from "../repositories/userRepo";
import { badRequest, unauthorized } from "../lib/errors";
import { auditSecurity } from "../lib/audit";
import { sendPasswordResetEmail, sendWelcomeEmail, sendEmailVerificationEmail } from "../email";
import type { User } from "@shared/schema";
import { resolveLegacyAssetIdToPublicPath } from "../lib/assets";

const EMAIL_VERIFY_EXPIRY_HOURS = 24;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function serializeUser(user: {
  id: number;
  username: string;
  email: string;
  displayName: string | null;
  avatarUrl?: string | null;
  avatarAssetId?: string | null;
  profileImageUrl?: string | null;
  bio?: string | null;
  publicHandle?: string | null;
  publicProfileEnabled?: boolean | null;
  defaultEventType?: string | null;
  preferredCurrencyCodes?: string | null;
  defaultCurrencyCode?: string | null;
  favoriteCurrencyCodes?: string[] | null;
  emailVerifiedAt?: Date | null;
}) {
  let preferredCurrencyCodes: string[] | undefined;
  if (user.preferredCurrencyCodes) {
    try {
      preferredCurrencyCodes = JSON.parse(user.preferredCurrencyCodes) as string[];
    } catch {
      preferredCurrencyCodes = undefined;
    }
  }
  return {
    // Expose a browser-loadable URL while allowing DB storage via asset id.
    avatarUrl: user.avatarUrl ?? resolveLegacyAssetIdToPublicPath(user.avatarAssetId) ?? undefined,
    profileImageUrl: user.profileImageUrl ?? resolveLegacyAssetIdToPublicPath(user.avatarAssetId) ?? undefined,
    avatarAssetId: user.avatarAssetId ?? undefined,
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    bio: user.bio ?? undefined,
    publicHandle: user.publicHandle ?? user.username,
    publicProfileEnabled: user.publicProfileEnabled ?? true,
    defaultEventType: (user.defaultEventType === "public" ? "public" : "private") as "private" | "public",
    preferredCurrencyCodes: preferredCurrencyCodes ?? undefined,
    defaultCurrencyCode: user.defaultCurrencyCode ?? "EUR",
    favoriteCurrencyCodes: Array.isArray(user.favoriteCurrencyCodes) ? user.favoriteCurrencyCodes : [],
    emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : undefined,
  };
}

export async function me(userId: number | undefined): Promise<ReturnType<typeof serializeUser> | null> {
  if (!userId) return null;
  const user = await userRepo.findById(userId);
  if (!user) return null;
  return serializeUser(user);
}

export async function register(
  input: {
    username: string;
    email: string;
    displayName?: string;
    password: string;
  },
  verifyUrlBuilder: (token: string) => string
): Promise<{ user: ReturnType<typeof serializeUser>; emailSent: boolean }> {
  const existingUsername = await userRepo.findByUsername(input.username);
  if (existingUsername) throw badRequest("username_taken");
  const existingEmail = await userRepo.findByEmail(input.email);
  if (existingEmail) throw badRequest("email_taken");

  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await userRepo.createUser({
    username: input.username,
    email: input.email.toLowerCase(),
    displayName: input.displayName || null,
    passwordHash,
  });

  const token = crypto.randomBytes(32).toString("hex");
  const hashedToken = hashToken(token);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFY_EXPIRY_HOURS * 60 * 60 * 1000);
  await userRepo.setEmailVerifyToken(user.id, hashedToken, expiresAt);
  const verifyUrl = verifyUrlBuilder(token);
  const verifyResult = await sendEmailVerificationEmail(user.email, user.displayName || user.username, verifyUrl);

  const welcomeResult = await sendWelcomeEmail(user.email, user.displayName || user.username);
  return { user: serializeUser(user), emailSent: verifyResult.sent || welcomeResult.sent };
}

export async function login(username: string, password: string, ip: string): Promise<ReturnType<typeof serializeUser>> {
  const user = await userRepo.findByUsername(username);
  if (!user) {
    auditSecurity("login.failure", { user: "unknown", ip });
    throw unauthorized("invalid_credentials");
  }
  if (!user.passwordHash) {
    auditSecurity("login.failure", { user: user.id, ip });
    throw unauthorized("invalid_credentials");
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    auditSecurity("login.failure", { user: user.id, ip });
    throw unauthorized("invalid_credentials");
  }
  auditSecurity("login.success", { user: user.id, ip });
  return serializeUser(user);
}

export async function requestPasswordReset(email: string, ip: string, resetUrlBuilder: (token: string) => string): Promise<{ emailSent: boolean; resetUrl?: string }> {
  const user = await userRepo.findByEmail(email);
  auditSecurity("password_reset.request", { user: user?.id ?? "unknown", ip });
  let emailSent = false;
  let resetUrl: string | undefined;
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await userRepo.createPasswordResetToken(user.id, token, expiresAt);
    resetUrl = resetUrlBuilder(token);
    const resetResult = await sendPasswordResetEmail(user.email, resetUrl);
    emailSent = resetResult.sent;
  }
  return { emailSent, resetUrl };
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const record = await userRepo.getPasswordResetToken(token);
  if (!record) throw badRequest("invalid_token");
  if (record.usedAt) throw badRequest("token_already_used");
  if (new Date() > record.expiresAt) throw badRequest("token_expired");
  const passwordHash = await bcrypt.hash(password, 10);
  await userRepo.updatePassword(record.userId, passwordHash);
  await userRepo.markTokenUsed(record.id);
}

export async function resendVerification(userId: number, verifyUrlBuilder: (token: string) => string): Promise<{ sent: boolean }> {
  const user = await userRepo.findById(userId);
  if (!user) return { sent: false };
  if (user.emailVerifiedAt) {
    return { sent: true };
  }
  const token = crypto.randomBytes(32).toString("hex");
  const hashedToken = hashToken(token);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFY_EXPIRY_HOURS * 60 * 60 * 1000);
  await userRepo.setEmailVerifyToken(userId, hashedToken, expiresAt);
  const verifyUrl = verifyUrlBuilder(token);
  return sendEmailVerificationEmail(user.email, user.displayName || user.username, verifyUrl);
}

export async function verifyEmailToken(plainToken: string): Promise<number | null> {
  if (!plainToken?.trim()) return null;
  const hashed = hashToken(plainToken.trim());
  const user = await userRepo.findByEmailVerifyToken(hashed);
  if (!user) return null;
  const updated = await userRepo.verifyEmailAndClearToken(user.id);
  return updated ? user.id : null;
}
