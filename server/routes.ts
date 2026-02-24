import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { db, pool } from "./db";
import { parseDbUrl } from "./lib/db-utils";
import { auditLog, auditSecurity } from "./lib/audit";
import { users, expenses, notes } from "@shared/schema";
import { api } from "@shared/routes";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendPasswordResetEmail, sendWelcomeEmail } from "./email";
import { eq, and } from "drizzle-orm";
import { loginLimiter, passwordResetLimiter } from "./middleware/rate-limit";
import { canUseLimit } from "./lib/features";

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const admins = (process.env.ADMIN_USERNAMES ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const username = (req.session?.username as string)?.toLowerCase();
  if (!username || !admins.includes(username)) {
    return res.status(403).json({ message: "Admin only" });
  }
  next();
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {

  function serializeUser(user: { id: number; username: string; email: string; displayName: string | null; avatarUrl?: string | null; profileImageUrl?: string | null; bio?: string | null; preferredCurrencyCodes?: string | null }) {
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

  // Auth
  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) return res.json(null);
    const user = await storage.getUserById(req.session.userId);
    if (!user) return res.json(null);
    res.json(serializeUser(user));
  });

  app.get("/api/health", async (_req, res) => {
    res.setHeader("Cache-Control", "private, max-age=30");
    const timestamp = new Date().toISOString();
    const commit =
      process.env.RENDER_GIT_COMMIT ?? process.env.VERCEL_GIT_COMMIT_SHA ?? null;
    const parsed = process.env.DATABASE_URL
      ? parseDbUrl(process.env.DATABASE_URL)
      : null;

    const dbInfo = {
      host: parsed?.host ?? null,
      port: parsed?.port ?? null,
      user: parsed?.user ?? null,
      database: parsed?.database ?? null,
    };

    try {
      const result = await pool.query("SELECT schema_version FROM app_meta WHERE id = 1");
      const schemaVersion = result.rows[0]?.schema_version ?? 0;
      res.json({
        ok: true,
        db: { ok: true, ...dbInfo },
        schemaVersion,
        commit,
        timestamp,
      });
    } catch {
      res.status(503).json({
        ok: false,
        db: { ok: false, ...dbInfo },
        schemaVersion: null,
        commit,
        timestamp,
      });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const schema = z.object({
        username: z.string().min(2).max(30).regex(/^[a-zA-Z0-9_\-]+$/, "Username can only contain letters, numbers, _ and -"),
        email: z.string().email("Invalid email address"),
        displayName: z.string().max(50).optional(),
        password: z.string().min(8),
      });
      const { username, email, displayName, password } = schema.parse(req.body);

      const existingUsername = await storage.getUserByUsername(username);
      if (existingUsername) return res.status(409).json({ message: "username_taken" });

      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) return res.status(409).json({ message: "email_taken" });

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await storage.createUser({ username, email: email.toLowerCase(), displayName: displayName || null, passwordHash });

      req.session.userId = user.id;
      req.session.username = user.username;
      const welcomeResult = await sendWelcomeEmail(user.email, user.displayName || user.username);
      req.session.save((err) => {
        if (err) {
          console.error("[session] save error on register:", err);
          return res.status(500).json({ message: "Session error" });
        }
        res.status(201).json({ ...serializeUser(user), emailSent: welcomeResult.sent });
      });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.post("/api/auth/login", loginLimiter, async (req, res) => {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
    try {
      const schema = z.object({ username: z.string(), password: z.string() });
      const { username, password } = schema.parse(req.body);

      const user = await storage.getUserByUsername(username);
      if (!user) {
        auditSecurity("login.failure", { user: "unknown", ip });
        return res.status(401).json({ message: "invalid_credentials" });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        auditSecurity("login.failure", { user: user.id, ip });
        return res.status(401).json({ message: "invalid_credentials" });
      }

      auditSecurity("login.success", { user: user.id, ip });
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.save((err) => {
        if (err) {
          console.error("[session] save error on login:", err);
          return res.status(500).json({ message: "Session error" });
        }
        res.json(serializeUser(user));
      });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.patch("/api/users/me", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        displayName: z.string().max(50).optional(),
        avatarUrl: z.union([z.string().url(), z.literal("")]).nullable().optional(),
        profileImageUrl: z.union([z.string().url(), z.literal("")]).nullable().optional(),
        bio: z.string().max(500).nullable().optional(),
        preferredCurrencyCodes: z.array(z.string()).nullable().optional(),
      });
      const body = schema.parse(req.body);
      const updates: Parameters<typeof storage.updateUserProfile>[1] = {};
      if (body.displayName !== undefined) updates.displayName = body.displayName;
      if (body.avatarUrl !== undefined) updates.avatarUrl = body.avatarUrl === "" ? null : body.avatarUrl;
      if (body.profileImageUrl !== undefined) updates.profileImageUrl = body.profileImageUrl === "" ? null : body.profileImageUrl;
      if (body.bio !== undefined) updates.bio = body.bio;
      if (body.preferredCurrencyCodes !== undefined) updates.preferredCurrencyCodes = body.preferredCurrencyCodes === null ? null : JSON.stringify(body.preferredCurrencyCodes);
      const user = await storage.updateUserProfile(req.session.userId!, updates);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json(serializeUser(user));
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.delete("/api/users/me", requireAuth, async (req, res) => {
    await storage.deleteUser(req.session.userId!);
    req.session.destroy(() => {
      res.status(204).send();
    });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  });

  app.post("/api/auth/forgot-password", passwordResetLimiter, async (req, res) => {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
    try {
      const { email } = z.object({ email: z.string().email() }).parse(req.body);
      const user = await storage.getUserByEmail(email);
      auditSecurity("password_reset.request", { user: user?.id ?? "unknown", ip });

      let emailSent = false;
      if (user) {
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        await storage.createPasswordResetToken(user.id, token, expiresAt);

        const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
        const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:5000";
        const resetUrl = `${proto}://${host}/reset-password?token=${token}`;

        const resetResult = await sendPasswordResetEmail(user.email, resetUrl);
        emailSent = resetResult.sent;
      }

      res.json({ ok: true, emailSent });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.post("/api/auth/reset-password", passwordResetLimiter, async (req, res) => {
    try {
      const { token, password } = z.object({
        token: z.string(),
        password: z.string().min(8),
      }).parse(req.body);

      const record = await storage.getPasswordResetToken(token);
      if (!record) return res.status(400).json({ message: "invalid_token" });
      if (record.usedAt) return res.status(400).json({ message: "token_already_used" });
      if (new Date() > record.expiresAt) return res.status(400).json({ message: "token_expired" });

      const passwordHash = await bcrypt.hash(password, 10);
      await storage.updateUserPassword(record.userId, passwordHash);
      await storage.markTokenUsed(record.id);

      res.json({ ok: true });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  /** Admin-only: set user plan. Gated by ADMIN_USERNAMES env (comma-separated). */
  app.patch("/api/admin/users/:id/plan", requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid user ID" });
      const body = z
        .object({
          plan: z.enum(["free", "pro"]),
          planExpiresAt: z.union([z.string(), z.null()]).optional(),
        })
        .parse(req.body);
      const user = await storage.getUserById(id);
      if (!user) return res.status(404).json({ message: "User not found" });
      const planExpiresAt = body.planExpiresAt ? new Date(body.planExpiresAt) : null;
      const updated = await storage.updateUserPlan(id, body.plan, planExpiresAt);
      if (!updated) return res.status(404).json({ message: "User not found" });
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
      auditSecurity("plan.change", { user: req.session.userId, ip });
      res.json({ id: updated.id, plan: updated.plan, planExpiresAt: updated.planExpiresAt?.toISOString() ?? null });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  // Barbecues
  app.get(api.barbecues.list.path, async (req, res) => {
    const currentUsername = req.session.username || (req.query.userId as string | undefined);
    const items = await storage.getBarbecues(currentUsername);
    res.json(items);
  });

  app.get(api.barbecues.listPublic.path, async (_req, res) => {
    const items = await storage.getBarbecues();
    res.json(items);
  });

  app.post(api.barbecues.create.path, async (req, res) => {
    try {
      const bodySchema = api.barbecues.create.input.extend({ date: z.coerce.date() });
      const input = bodySchema.parse(req.body);
      if (input.creatorId && input.creatorId.trim()) {
        const user = await storage.getUserByUsername(input.creatorId.trim());
        const count = await storage.countBarbecuesByCreator(input.creatorId.trim());
        const check = canUseLimit(user ?? undefined, "events_created", count);
        if (!check.allowed) {
          return res.status(403).json({
            message: `Free plan limit reached. You can create up to ${check.limit} events. Upgrade to Pro for unlimited events.`,
          });
        }
      }
      const created = await storage.createBarbecue(input);
      if (input.creatorId && input.creatorId.trim()) {
        await storage.createParticipant({
          barbecueId: created.id,
          name: input.creatorId.trim(),
          userId: input.creatorId.trim(),
          status: "accepted",
        });
      }
      auditLog("barbecue.create", { barbecueId: created.id, username: req.session?.username });
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.get(api.barbecues.get.path, async (req, res) => {
    const bbq = await storage.getBarbecue(Number(req.params.id));
    if (!bbq) return res.status(404).json({ message: "BBQ not found" });
    res.json(bbq);
  });

  /** Resolve invite token to event info (public, for /join/:token page). */
  app.get("/api/join/:token", async (req, res) => {
    const bbq = await storage.getBarbecueByInviteToken(req.params.token);
    if (!bbq) return res.status(404).json({ message: "Invite not found" });
    res.json({
      bbqId: bbq.id,
      name: bbq.name,
      eventType: bbq.eventType,
      currency: bbq.currency,
    });
  });

  /** Ensure event has invite token (backfill for legacy events). Creator only. */
  app.post("/api/barbecues/:id/ensure-invite-token", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const bbq = await storage.getBarbecue(id);
    if (!bbq) return res.status(404).json({ message: "Event not found" });
    if (bbq.creatorId !== req.session.username) return res.status(403).json({ message: "Only the creator can update this event" });
    const updated = await storage.ensureBarbecueInviteToken(id);
    if (!updated) return res.status(404).json({ message: "Event not found" });
    res.json(updated);
  });

  app.delete(api.barbecues.delete.path, async (req, res) => {
    await storage.deleteBarbecue(Number(req.params.id));
    res.status(204).send();
  });

  app.patch(api.barbecues.update.path, requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const bbq = await storage.getBarbecue(id);
      if (!bbq) return res.status(404).json({ message: "BBQ not found" });
      if (bbq.creatorId !== req.session.username) return res.status(403).json({ message: "Only the creator can update this BBQ" });
      const schema = z.object({ allowOptInExpenses: z.boolean().optional(), templateData: z.unknown().optional(), status: z.enum(["draft", "active", "settling", "settled"]).optional() });
      const body = schema.parse(req.body);
      const updated = await storage.updateBarbecue(id, body);
      if (!updated) return res.status(404).json({ message: "BBQ not found" });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  /** Settle up: creator triggers settling, notifies participants. */
  app.post("/api/barbecues/:id/settle-up", requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const bbq = await storage.getBarbecue(id);
      if (!bbq) return res.status(404).json({ message: "Event not found" });
      if (bbq.creatorId !== req.session.username) return res.status(403).json({ message: "Only the creator can settle up" });
      const participantsList = await storage.getParticipants(id);
      const expensesList = await storage.getExpenses(id);
      const total = expensesList.reduce((s, e) => s + parseFloat(String(e.amount || 0)), 0);
      const n = participantsList.length;
      const fairShare = n > 0 ? total / n : 0;
      const paidBy: Record<number, number> = {};
      participantsList.forEach((p) => (paidBy[p.id] = 0));
      expensesList.forEach((e) => {
        if (paidBy[e.participantId] !== undefined) paidBy[e.participantId] += parseFloat(String(e.amount || 0));
      });
      const creatorName = bbq.creatorId || "Someone";
      const notifications: { userId: string; barbecueId: number; type: string; payload: { creatorName: string; amountOwed: number; eventName: string; currency: string } }[] = [];
      for (const p of participantsList) {
        if (!p.userId || p.userId === bbq.creatorId) continue;
        const balance = (paidBy[p.id] ?? 0) - fairShare;
        if (balance < -0.01) {
          notifications.push({
            userId: p.userId,
            barbecueId: id,
            type: "event_settled_started",
            payload: {
              creatorName,
              amountOwed: Math.abs(balance),
              eventName: bbq.name,
              currency: bbq.currency ?? "EUR",
            },
          });
        }
      }
      await storage.createEventNotificationsBatch(notifications);
      const now = new Date();
      const settleSnapshot = { total, expenseCount: expensesList.length, at: now.toISOString() };
      const currentTemplate = (bbq.templateData as Record<string, unknown>) || {};
      const updated = await storage.updateBarbecue(id, {
        status: "settling",
        settledAt: now,
        templateData: { ...currentTemplate, settleSnapshot },
      });
      if (!updated) return res.status(404).json({ message: "Event not found" });
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
      auditSecurity("event.lock", { user: req.session.userId, ip });
      auditLog("barbecue.settle_up", { barbecueId: id, username: req.session.username });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.get("/api/notifications/events", requireAuth, async (req, res) => {
    const userId = req.session.username;
    if (!userId) return res.json([]);
    const items = await storage.getEventNotificationsForUser(userId);
    res.json(items);
  });

  app.patch("/api/notifications/events/:id/read", requireAuth, async (req, res) => {
    await storage.markEventNotificationRead(Number(req.params.id));
    res.status(204).send();
  });

  // Participants
  app.get(api.participants.list.path, async (req, res) => {
    const items = await storage.getParticipants(Number(req.params.bbqId));
    res.json(items);
  });

  app.get(api.participants.pending.path, async (req, res) => {
    const items = await storage.getPendingRequests(Number(req.params.bbqId));
    res.json(items);
  });

  app.get("/api/barbecues/:bbqId/invited", async (req, res) => {
    const items = await storage.getInvitedParticipants(Number(req.params.bbqId));
    res.json(items);
  });

  app.post(api.participants.create.path, async (req, res) => {
    try {
      const input = api.participants.create.input.parse(req.body);
      const created = await storage.createParticipant({
        ...input,
        barbecueId: Number(req.params.bbqId),
        status: "accepted",
      });
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.post(api.participants.join.path, async (req, res) => {
    try {
      const input = api.participants.join.input.parse(req.body);
      const bbqId = Number(req.params.bbqId);
      const existing = await storage.getMemberships(input.userId);
      const alreadyIn = existing.find(m => m.bbqId === bbqId);
      if (alreadyIn) {
        return res.status(409).json({
          message: alreadyIn.status === "accepted" ? "already_joined" : "already_pending"
        });
      }
      const created = await storage.joinBarbecue(bbqId, input.name, input.userId);
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.post("/api/barbecues/:bbqId/invite", async (req, res) => {
    try {
      const schema = z.object({ username: z.string().min(1) });
      const { username } = schema.parse(req.body);
      const bbqId = Number(req.params.bbqId);

      const existing = await storage.getMemberships(username);
      const alreadyIn = existing.find(m => m.bbqId === bbqId);
      if (alreadyIn) return res.status(409).json({ message: "already_member" });

      const created = await storage.inviteParticipant(bbqId, username, username);
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.patch(api.participants.accept.path, async (req, res) => {
    const updated = await storage.acceptParticipant(Number(req.params.id));
    if (!updated) return res.status(404).json({ message: "Participant not found" });
    res.json(updated);
  });

  app.patch(api.participants.update.path, async (req, res) => {
    try {
      const username = req.session.username;
      if (!username) return res.status(401).json({ message: "Not authenticated" });
      const id = Number(req.params.id);
      const input = api.participants.update.input.parse(req.body);
      const participant = await storage.getParticipant(id);
      if (!participant) return res.status(404).json({ message: "Participant not found" });
      if (participant.userId !== username) return res.status(403).json({ message: "Can only edit your own name" });
      const updated = await storage.updateParticipantName(id, input.name);
      if (!updated) return res.status(404).json({ message: "Participant not found" });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.delete(api.participants.delete.path, async (req, res) => {
    await storage.deleteParticipant(Number(req.params.id));
    res.status(204).send();
  });

  // Memberships
  app.get(api.memberships.list.path, async (req, res) => {
    const userId = req.query.userId as string | undefined || req.session.username;
    if (!userId) return res.json([]);
    const memberships = await storage.getMemberships(userId);
    res.json(memberships);
  });

  // Expenses
  app.get(api.expenses.list.path, async (req, res) => {
    const items = await storage.getExpenses(Number(req.params.bbqId));
    res.json(items);
  });

  app.post(api.expenses.create.path, async (req, res) => {
    try {
      const bodySchema = api.expenses.create.input.extend({
        amount: z.coerce.number(),
        participantId: z.coerce.number(),
      });
      const input = bodySchema.parse(req.body);
      const { optInByDefault, ...expenseData } = input;
      const created = await storage.createExpense(
        { ...expenseData, barbecueId: Number(req.params.bbqId) },
        { optInByDefault }
      );
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.put(api.expenses.update.path, async (req, res) => {
    try {
      const bodySchema = api.expenses.update.input.extend({
        amount: z.coerce.number().optional(),
        participantId: z.coerce.number().optional(),
      });
      const input = bodySchema.parse(req.body);
      const updated = await storage.updateExpense(Number(req.params.id), input);
      if (!updated) return res.status(404).json({ message: "Expense not found" });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.delete(api.expenses.delete.path, async (req, res) => {
    await storage.deleteExpense(Number(req.params.id));
    res.status(204).send();
  });

  app.get("/api/barbecues/:bbqId/expense-shares", async (req, res) => {
    const shares = await storage.getExpenseShares(Number(req.params.bbqId));
    res.json(shares);
  });

  // Notes (event-agnostic: eventId = barbecue id for parties/trips)
  app.get(api.notes.list.path, async (req, res) => {
    const eventId = Number(req.params.eventId);
    const items = await storage.getNotes(eventId);
    res.json(items);
  });

  app.post(api.notes.create.path, async (req, res) => {
    try {
      const eventId = Number(req.params.eventId);
      const input = api.notes.create.input.parse(req.body);
      const participant = await storage.getParticipant(input.participantId);
      if (!participant || participant.barbecueId !== eventId) {
        return res.status(403).json({ message: "Invalid participant for this event" });
      }
      const created = await storage.createNote({
        barbecueId: eventId,
        participantId: input.participantId,
        title: input.title ?? null,
        body: input.body,
        pinned: input.pinned ?? false,
      });
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const first = err.errors[0];
        const msg = first ? `${first.path.join(".")}: ${first.message}` : "Validation failed";
        return res.status(400).json({ message: msg });
      }
      const message = err instanceof Error ? err.message : "Failed to create note";
      if (process.env.NODE_ENV !== "production") {
        console.error("[notes.create]", err);
      }
      return res.status(500).json({ message });
    }
  });

  app.patch(api.notes.update.path, async (req, res) => {
    try {
      const noteId = Number(req.params.noteId);
      const input = api.notes.update.input.parse(req.body);
      const existing = await db.select().from(notes).where(eq(notes.id, noteId));
      if (!existing[0]) return res.status(404).json({ message: "Note not found" });
      const participant = await storage.getParticipant(existing[0].participantId);
      const username = req.session.username;
      if (username && participant?.userId && participant.userId !== username) {
        return res.status(403).json({ message: "Can only edit your own notes" });
      }
      const updated = await storage.updateNote(noteId, input);
      if (!updated) return res.status(404).json({ message: "Note not found" });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const first = err.errors[0];
        const msg = first ? `${first.path.join(".")}: ${first.message}` : "Validation failed";
        return res.status(400).json({ message: msg });
      }
      const message = err instanceof Error ? err.message : "Failed to update note";
      return res.status(500).json({ message });
    }
  });

  app.delete(api.notes.delete.path, async (req, res) => {
    const noteId = Number(req.params.noteId);
    const existing = await db.select().from(notes).where(eq(notes.id, noteId));
    if (!existing[0]) return res.status(404).json({ message: "Note not found" });
    const participant = await storage.getParticipant(existing[0].participantId);
    const username = req.session.username;
    if (username && participant?.userId && participant.userId !== username) {
      return res.status(403).json({ message: "Can only delete your own notes" });
    }
    await storage.deleteNote(noteId);
    res.status(204).send();
  });

  app.patch("/api/barbecues/:bbqId/expenses/:expenseId/share", requireAuth, async (req, res) => {
    try {
      const bbqId = Number(req.params.bbqId);
      const expenseId = Number(req.params.expenseId);
      const bbq = await storage.getBarbecue(bbqId);
      if (!bbq) return res.status(404).json({ message: "BBQ not found" });
      if (!bbq.allowOptInExpenses) return res.status(400).json({ message: "Opt-in expenses not enabled for this BBQ" });
      const participantsList = await storage.getParticipants(bbqId);
      const myParticipant = participantsList.find(p => p.userId === req.session.username);
      if (!myParticipant) return res.status(403).json({ message: "Not a participant of this BBQ" });
      const [expenseRow] = await db.select().from(expenses).where(and(eq(expenses.id, expenseId), eq(expenses.barbecueId, bbqId)));
      if (!expenseRow) return res.status(404).json({ message: "Expense not found" });
      const schema = z.object({ in: z.boolean() });
      const { in: inShare } = schema.parse(req.body);
      await storage.setExpenseShare(expenseId, myParticipant.id, inShare);
      res.json({ ok: true });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  // Friends
  app.get("/api/friends", requireAuth, async (req, res) => {
    const friends = await storage.getFriends(req.session.userId!);
    res.json(friends);
  });

  app.get("/api/friends/requests", requireAuth, async (req, res) => {
    const requests = await storage.getFriendRequests(req.session.userId!);
    res.json(requests);
  });

  app.get("/api/friends/sent", requireAuth, async (req, res) => {
    const sent = await storage.getSentFriendRequests(req.session.userId!);
    res.json(sent);
  });

  app.post("/api/friends/request", requireAuth, async (req, res) => {
    try {
      const { username } = z.object({ username: z.string() }).parse(req.body);
      const target = await storage.getUserByUsername(username);
      if (!target) return res.status(404).json({ message: "user_not_found" });
      if (target.id === req.session.userId) return res.status(400).json({ message: "cannot_friend_self" });
      await storage.sendFriendRequest(req.session.userId!, target.id);
      res.status(201).json({ ok: true });
    } catch (err: any) {
      if (err.message === "friendship_exists") return res.status(409).json({ message: "friendship_exists" });
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.patch("/api/friends/:id/accept", requireAuth, async (req, res) => {
    await storage.acceptFriendRequest(Number(req.params.id));
    res.json({ ok: true });
  });

  app.delete("/api/friends/:id", requireAuth, async (req, res) => {
    await storage.removeFriend(Number(req.params.id));
    res.status(204).send();
  });

  // All pending requests across creator's BBQs
  app.get("/api/pending-requests/all", requireAuth, async (req, res) => {
    const username = req.session.username;
    if (!username) return res.json([]);
    const all = await storage.getAllPendingRequestsForCreator(username);
    res.json(all);
  });

  // Search users (for adding friends) - must be before /:username
  app.get("/api/users/search", requireAuth, async (req, res) => {
    const query = (req.query.q as string || "").toLowerCase().trim();
    if (!query || query.length < 2) return res.json([]);
    const allUsers = await db.select({ id: users.id, username: users.username, displayName: users.displayName }).from(users);
    const results = allUsers.filter(u =>
      u.id !== req.session.userId &&
      (u.username.toLowerCase().includes(query) || (u.displayName && u.displayName.toLowerCase().includes(query)))
    ).slice(0, 10);
    res.json(results);
  });

  // Public profile by username (for viewing other users)
  app.get("/api/users/:username", requireAuth, async (req, res) => {
    const username = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;
    if (!username) return res.status(400).json({ message: "Username required" });
    const profile = await storage.getPublicProfileWithStats(username);
    if (!profile) return res.status(404).json({ message: "User not found" });
    res.json(profile);
  });

  return httpServer;
}
