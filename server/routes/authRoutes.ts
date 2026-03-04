import { Router, type Request } from "express";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import * as authService from "../services/authService";
import * as userService from "../services/userService";
import { userRepo } from "../repositories/userRepo";
import { requireAuth } from "../middleware/requireAuth";
import { loginLimiter, passwordResetLimiter } from "../middleware/rate-limit";
import { auditSecurity } from "../lib/audit";
import { badRequest, forbidden, notFound } from "../lib/errors";
import passport from "passport";

const router = Router();
const currencyCodeSchema = z.string().regex(/^[A-Z]{3}$/, "Currency code must be 3 uppercase letters");
const publicHandleSchema = z.string().min(2).max(30).regex(/^[a-z0-9][a-z0-9_-]*$/, "Handle can only use lowercase letters, numbers, _ and -");
const AVATAR_UPLOAD_DIR = path.resolve(process.cwd(), "public/uploads/avatars");
const EVENT_BANNER_UPLOAD_DIR = path.resolve(process.cwd(), "public/uploads/event-banners");
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
const ASSET_ID_REGEX = /^[a-zA-Z0-9._-]+$/;
const publicImagePathOrUrlSchema = z
  .string()
  .trim()
  .refine((value) => /^https?:\/\//i.test(value) || value.startsWith("/"), "Invalid image URL");

/** Build proxy-safe origin: x-forwarded-proto/host → req.protocol/host → localhost:(PORT|5001) */
function getRequestOrigin(req: Request): string {
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "http";
  const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || `localhost:${process.env.PORT || 5001}`;
  return `${proto}://${host}`.replace(/\/$/, "");
}

function getAppBase(req: Request): string {
  const base = process.env.APP_URL ?? getRequestOrigin(req);
  return base.replace(/\/$/, "");
}

function requireAdmin(req: Request): void {
  const admins = (process.env.ADMIN_USERNAMES ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const username = (req.session?.username as string)?.toLowerCase();
  if (!username || !admins.includes(username)) forbidden("Admin only");
}

function asyncHandler(fn: (req: Request, res: any, next: any) => Promise<void>) {
  return (req: Request, res: any, next: any) => fn(req, res, next).catch(next);
}

function ensureGoogleOAuthConfigured(req: Request, res: any, next: any) {
  const strategy = (passport as unknown as { _strategy?: (name: string) => unknown })._strategy?.("google");
  if (!strategy) {
    return res.status(503).json({
      code: "GOOGLE_OAUTH_NOT_CONFIGURED",
      message: "Google sign-in is not configured",
    });
  }
  return next();
}

router.get(
  "/assets/:assetId",
  asyncHandler(async (req, res) => {
    const assetId = String(req.params.assetId ?? "").trim();
    if (!ASSET_ID_REGEX.test(assetId)) {
      return res.status(400).json({ code: "INVALID_ASSET_ID", message: "Invalid asset id" });
    }
    const candidates = [
      path.join(AVATAR_UPLOAD_DIR, assetId),
      path.join(EVENT_BANNER_UPLOAD_DIR, assetId),
    ];
    for (const candidate of candidates) {
      try {
        await fs.stat(candidate);
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        return res.sendFile(candidate);
      } catch {
        // Try next location.
      }
    }
    return res.status(404).json({ code: "ASSET_NOT_FOUND", message: "Asset not found" });
  }),
);

router.get(
  "/auth/google",
  ensureGoogleOAuthConfigured,
  passport.authenticate("google", { scope: ["profile", "email"] }),
);

router.get(
  "/auth/google/callback",
  ensureGoogleOAuthConfigured,
  passport.authenticate("google", { failureRedirect: "/login?error=google", session: true }),
  asyncHandler(async (req, res) => {
    const user = req.user as { id: number; username: string } | undefined;
    if (!user) return res.redirect("/login?error=google");

    req.session!.userId = user.id;
    req.session!.username = user.username;
    req.session!.save((err: Error) => {
      if (err) {
        console.error("[session] save error on google callback:", err);
        return res.status(500).json({ message: "Session error" });
      }
      return res.redirect("/app");
    });
  }),
);

router.get(
  "/auth/me",
  asyncHandler(async (req, res) => {
    const user = await authService.me(req.session?.userId);
    res.json(user);
  })
);

router.get(
  "/me/plan",
  requireAuth,
  asyncHandler(async (req, res) => {
    const info = await userService.getPlanInfo(req.session!.userId!);
    res.json(info);
  })
);

router.post(
  "/auth/register",
  loginLimiter,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      username: z.string().min(2).max(30).regex(/^[a-zA-Z0-9_\-]+$/, "Username can only contain letters, numbers, _ and -"),
      email: z.string().email("Invalid email address"),
      displayName: z.string().max(50).optional(),
      password: z.string().min(8),
    });
    const input = schema.parse(req.body);
    const base = getAppBase(req);
    const verifyUrlBuilder = (token: string) => `${base}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
    const { user, emailSent } = await authService.register(input, verifyUrlBuilder);
    req.session!.userId = user.id;
    req.session!.username = user.username;
    req.session!.save((err: Error) => {
      if (err) {
        console.error("[session] save error on register:", err);
        res.status(500).json({ message: "Session error" });
      } else {
        res.status(201).json({ ...user, emailSent });
      }
    });
  })
);

router.post(
  "/auth/login",
  loginLimiter,
  asyncHandler(async (req, res) => {
    const schema = z.object({ username: z.string(), password: z.string() });
    const { username, password } = schema.parse(req.body);
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
    const user = await authService.login(username, password, ip);
    req.session!.userId = user.id;
    req.session!.username = user.username;
    req.session!.save((err: Error) => {
      if (err) {
        console.error("[session] save error on login:", err);
        res.status(500).json({ message: "Session error" });
      } else {
        res.json(user);
      }
    });
  })
);

router.post("/auth/logout", (req, res) => {
  req.session?.destroy(() => res.json({ ok: true }));
});

router.post(
  "/auth/forgot-password",
  passwordResetLimiter,
  asyncHandler(async (req, res) => {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const base = getAppBase(req);
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
    const resetUrlBuilder = (token: string) => `${base}/reset-password?token=${token}`;
    const { resetUrl } = await authService.requestPasswordReset(email, ip, resetUrlBuilder);
    if (process.env.NODE_ENV === "development" && resetUrl) {
      const sep = "─────────────────────────────────────────────────────────────";
      console.log(["", sep, "  FORGOT PASSWORD — reset link (dev)", sep, `  RESET URL: ${resetUrl}`, `  COPY: ${resetUrl}`, sep, ""].join("\n"));
    }
    res.json({ ok: true });
  })
);

router.post(
  "/auth/reset-password",
  passwordResetLimiter,
  asyncHandler(async (req, res) => {
    const { token, password } = z.object({ token: z.string(), password: z.string().min(8) }).parse(req.body);
    await authService.resetPassword(token, password);
    res.json({ ok: true });
  })
);

router.post(
  "/auth/resend-verification",
  requireAuth,
  asyncHandler(async (req, res) => {
    const base = getAppBase(req);
    const verifyUrlBuilder = (token: string) => `${base}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
    const result = await authService.resendVerification(req.session!.userId!, verifyUrlBuilder);
    res.json(result);
  })
);

router.get(
  "/auth/verify-email",
  asyncHandler(async (req, res) => {
    const token = (req.query.token as string)?.trim() || "";
    const userId = await authService.verifyEmailToken(token);
    const base = getAppBase(req);
    if (userId) {
      res.redirect(`${base}/verified`);
    } else {
      res.redirect(`${base}/verify-error`);
    }
  })
);

router.post(
  "/uploads/avatar",
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = z.object({ dataUrl: z.string().min(1) }).parse(req.body ?? {});
    const match = payload.dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) badRequest("Invalid avatar image");

    const mime = match[1].toLowerCase();
    const base64 = match[2];
    const allowedMime = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]);
    if (!allowedMime.has(mime)) badRequest("Unsupported image type");

    const buffer = Buffer.from(base64, "base64");
    if (!buffer.length) badRequest("Invalid image payload");
    if (buffer.length > MAX_AVATAR_SIZE_BYTES) badRequest("Avatar image must be 5MB or smaller");

    const extensionByMime: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
    };
    const ext = extensionByMime[mime] ?? "jpg";
    const fileName = `avatar-${req.session!.userId}-${randomUUID()}.${ext}`;
    await fs.mkdir(AVATAR_UPLOAD_DIR, { recursive: true });
    const filePath = path.join(AVATAR_UPLOAD_DIR, fileName);
    await fs.writeFile(filePath, buffer);

    const publicPath = `/uploads/avatars/${fileName}`;
    res.json({
      assetId: fileName,
      path: publicPath,
      url: publicPath,
      mime,
      size: buffer.length,
    });
  })
);

router.patch(
  "/users/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      displayName: z.string().max(50).optional(),
      avatarUrl: z.union([publicImagePathOrUrlSchema, z.literal("")]).nullable().optional(),
      avatarAssetId: z.union([z.string().min(1), z.literal("")]).nullable().optional(),
      profileImageUrl: z.union([publicImagePathOrUrlSchema, z.literal("")]).nullable().optional(),
      bio: z.string().max(500).nullable().optional(),
      publicHandle: z.union([publicHandleSchema, z.literal("")]).nullable().optional(),
      publicProfileEnabled: z.boolean().optional(),
      defaultEventType: z.enum(["private", "public"]).optional(),
      preferredCurrencyCodes: z.array(z.string()).nullable().optional(),
      defaultCurrencyCode: currencyCodeSchema.optional(),
      favoriteCurrencyCodes: z
        .array(currencyCodeSchema)
        .max(10, "Favorite currencies max 10")
        .refine((codes) => new Set(codes).size === codes.length, "Favorite currencies must be unique")
        .optional(),
    });
    const body = schema.parse(req.body);
    if (body.avatarAssetId !== undefined && body.avatarAssetId !== null && body.avatarAssetId !== "") {
      body.avatarUrl = null;
      body.profileImageUrl = null;
    }
    if (body.publicHandle !== undefined) {
      const normalized = (body.publicHandle ?? "").trim().toLowerCase();
      const nextHandle = normalized || null;
      if (nextHandle) {
        const existingByHandle = await userRepo.findByPublicHandle(nextHandle);
        const me = await userRepo.findById(req.session!.userId!);
        if (!me) notFound("User not found");
        if (existingByHandle && existingByHandle.id !== req.session!.userId) {
          throw badRequest("handle_taken");
        }
        body.publicHandle = nextHandle;
      } else {
        body.publicHandle = null;
      }
    }
    const user = await userService.updateProfile(req.session!.userId!, body);
    res.json(user);
  })
);

router.get(
  "/users/handle-availability",
  requireAuth,
  asyncHandler(async (req, res) => {
    const raw = String(req.query.handle ?? "").trim().toLowerCase();
    if (!raw) return res.json({ ok: false, reason: "empty" });
    const parsed = publicHandleSchema.safeParse(raw);
    if (!parsed.success) return res.json({ ok: false, reason: "invalid" });
    const existing = await userRepo.findByPublicHandle(parsed.data);
    const me = await userRepo.findById(req.session!.userId!);
    if (!me) notFound("User not found");
    const available = !existing || existing.id === me.id;
    res.json({ ok: available, normalized: parsed.data });
  })
);

router.delete(
  "/users/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    await userService.deleteAccount(req.session!.userId!);
    req.session?.destroy(() => res.status(204).send());
  })
);

router.patch(
  "/admin/users/:id/plan",
  requireAuth,
  asyncHandler(async (req, res) => {
    requireAdmin(req);
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) throw badRequest("Invalid user ID");
    const body = z.object({ plan: z.enum(["free", "pro"]), planExpiresAt: z.union([z.string(), z.null()]).optional() }).parse(req.body);
    const user = await userRepo.findById(id);
    if (!user) notFound("User not found");
    const planExpiresAt = body.planExpiresAt ? new Date(body.planExpiresAt) : null;
    const updated = await userRepo.updatePlan(id, body.plan, planExpiresAt);
    if (!updated) notFound("User not found");
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
    auditSecurity("plan.change", { user: req.session!.userId, ip });
    res.json({ id: updated.id, plan: updated.plan, planExpiresAt: updated.planExpiresAt?.toISOString() ?? null });
  })
);

export default router;
