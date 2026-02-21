import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { users, expenses } from "@shared/schema";
import { api } from "@shared/routes";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendPasswordResetEmail, sendWelcomeEmail } from "./email";
import { eq, and } from "drizzle-orm";

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
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

  app.get("/api/health", (_req, res) => {
    res.json({ emailConfigured: !!process.env.RESEND_API_KEY });
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

  app.post("/api/auth/login", async (req, res) => {
    try {
      const schema = z.object({ username: z.string(), password: z.string() });
      const { username, password } = schema.parse(req.body);

      const user = await storage.getUserByUsername(username);
      if (!user) return res.status(401).json({ message: "invalid_credentials" });

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return res.status(401).json({ message: "invalid_credentials" });

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

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = z.object({ email: z.string().email() }).parse(req.body);
      const user = await storage.getUserByEmail(email);

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

  app.post("/api/auth/reset-password", async (req, res) => {
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

  // Barbecues
  app.get(api.barbecues.list.path, async (req, res) => {
    const currentUsername = req.session.username || (req.query.userId as string | undefined);
    const items = await storage.getBarbecues(currentUsername);
    res.json(items);
  });

  app.post(api.barbecues.create.path, async (req, res) => {
    try {
      const bodySchema = api.barbecues.create.input.extend({ date: z.coerce.date() });
      const input = bodySchema.parse(req.body);
      const created = await storage.createBarbecue(input);
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
      const schema = z.object({ allowOptInExpenses: z.boolean().optional() });
      const body = schema.parse(req.body);
      const updated = await storage.updateBarbecue(id, body);
      if (!updated) return res.status(404).json({ message: "BBQ not found" });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
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
      const created = await storage.createExpense({ ...input, barbecueId: Number(req.params.bbqId) });
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

  // Search users (for adding friends)
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

  return httpServer;
}
