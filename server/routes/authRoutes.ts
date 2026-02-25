import { Router, type Request } from "express";
import { z } from "zod";
import * as authService from "../services/authService";
import * as userService from "../services/userService";
import { userRepo } from "../repositories/userRepo";
import { requireAuth } from "../middleware/requireAuth";
import { loginLimiter, passwordResetLimiter } from "../middleware/rate-limit";
import { auditSecurity } from "../lib/audit";
import { badRequest, forbidden, notFound } from "../lib/errors";

const router = Router();

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
    const { user, emailSent } = await authService.register(input);
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
    const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:5000";
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
    const resetUrlBuilder = (token: string) => `${proto}://${host}/reset-password?token=${token}`;
    const { emailSent } = await authService.requestPasswordReset(email, ip, resetUrlBuilder);
    res.json({ ok: true, emailSent });
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

router.patch(
  "/users/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      displayName: z.string().max(50).optional(),
      avatarUrl: z.union([z.string().url(), z.literal("")]).nullable().optional(),
      profileImageUrl: z.union([z.string().url(), z.literal("")]).nullable().optional(),
      bio: z.string().max(500).nullable().optional(),
      preferredCurrencyCodes: z.array(z.string()).nullable().optional(),
    });
    const body = schema.parse(req.body);
    const user = await userService.updateProfile(req.session!.userId!, body);
    res.json(user);
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
