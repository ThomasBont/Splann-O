import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Barbecues
  app.get(api.barbecues.list.path, async (req, res) => {
    const items = await storage.getBarbecues();
    res.json(items);
  });

  app.post(api.barbecues.create.path, async (req, res) => {
    try {
      const bodySchema = api.barbecues.create.input.extend({
        date: z.coerce.date(),
      });
      const input = bodySchema.parse(req.body);
      const created = await storage.createBarbecue(input);
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
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
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.post(api.participants.join.path, async (req, res) => {
    try {
      const input = api.participants.join.input.parse(req.body);
      const bbqId = Number(req.params.bbqId);

      // Check if user already has a request (pending or accepted)
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
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
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
    const userId = req.query.userId as string;
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
      const created = await storage.createExpense({
        ...input,
        barbecueId: Number(req.params.bbqId)
      });
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
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
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete(api.expenses.delete.path, async (req, res) => {
    await storage.deleteExpense(Number(req.params.id));
    res.status(204).send();
  });

  return httpServer;
}
