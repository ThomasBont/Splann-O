import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import bcrypt from "bcryptjs";

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {

  // Auth
  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) return res.json(null);
    const user = await storage.getUserById(req.session.userId);
    if (!user) return res.json(null);
    res.json({ id: user.id, username: user.username });
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const schema = z.object({
        username: z.string().min(2).max(30).regex(/^[a-zA-Z0-9_\-]+$/, "Username can only contain letters, numbers, _ and -"),
        password: z.string().min(4),
      });
      const { username, password } = schema.parse(req.body);

      const existing = await storage.getUserByUsername(username);
      if (existing) return res.status(409).json({ message: "username_taken" });

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await storage.createUser({ username, passwordHash });

      req.session.userId = user.id;
      req.session.username = user.username;
      res.status(201).json({ id: user.id, username: user.username });
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
      res.json({ id: user.id, username: user.username });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ ok: true });
    });
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

  return httpServer;
}
