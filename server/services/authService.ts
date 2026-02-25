import bcrypt from "bcryptjs";
import crypto from "crypto";
import { userRepo } from "../repositories/userRepo";
import { badRequest, unauthorized } from "../lib/errors";
import { auditSecurity } from "../lib/audit";
import { sendPasswordResetEmail, sendWelcomeEmail } from "../email";
import type { User } from "@shared/schema";

export function serializeUser(user: {
  id: number;
  username: string;
  email: string;
  displayName: string | null;
  avatarUrl?: string | null;
  profileImageUrl?: string | null;
  bio?: string | null;
  preferredCurrencyCodes?: string | null;
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
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl ?? undefined,
    profileImageUrl: user.profileImageUrl ?? undefined,
    bio: user.bio ?? undefined,
    preferredCurrencyCodes: preferredCurrencyCodes ?? undefined,
  };
}

export async function me(userId: number | undefined): Promise<ReturnType<typeof serializeUser> | null> {
  if (!userId) return null;
  const user = await userRepo.findById(userId);
  if (!user) return null;
  return serializeUser(user);
}

export async function register(input: {
  username: string;
  email: string;
  displayName?: string;
  password: string;
}): Promise<{ user: ReturnType<typeof serializeUser>; emailSent: boolean }> {
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

  const welcomeResult = await sendWelcomeEmail(user.email, user.displayName || user.username);
  return { user: serializeUser(user), emailSent: welcomeResult.sent };
}

export async function login(username: string, password: string, ip: string): Promise<ReturnType<typeof serializeUser>> {
  const user = await userRepo.findByUsername(username);
  if (!user) {
    auditSecurity("login.failure", { user: "unknown", ip });
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

export async function requestPasswordReset(email: string, ip: string, resetUrlBuilder: (token: string) => string): Promise<{ emailSent: boolean }> {
  const user = await userRepo.findByEmail(email);
  auditSecurity("password_reset.request", { user: user?.id ?? "unknown", ip });
  let emailSent = false;
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await userRepo.createPasswordResetToken(user.id, token, expiresAt);
    const resetUrl = resetUrlBuilder(token);
    const resetResult = await sendPasswordResetEmail(user.email, resetUrl);
    emailSent = resetResult.sent;
  }
  return { emailSent };
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
