import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Participants
  app.get(api.participants.list.path, async (req, res) => {
    const items = await storage.getParticipants();
    res.json(items);
  });

  app.post(api.participants.create.path, async (req, res) => {
    try {
      const input = api.participants.create.input.parse(req.body);
      const created = await storage.createParticipant(input);
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.participants.delete.path, async (req, res) => {
    await storage.deleteParticipant(Number(req.params.id));
    res.status(204).send();
  });

  // Expenses
  app.get(api.expenses.list.path, async (req, res) => {
    const items = await storage.getExpenses();
    res.json(items);
  });

  app.post(api.expenses.create.path, async (req, res) => {
    try {
      const bodySchema = api.expenses.create.input.extend({
        amount: z.coerce.number(),
        participantId: z.coerce.number(),
      });
      const input = bodySchema.parse(req.body);
      const created = await storage.createExpense(input);
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
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
      if (!updated) {
        return res.status(404).json({ message: "Expense not found" });
      }
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.expenses.delete.path, async (req, res) => {
    await storage.deleteExpense(Number(req.params.id));
    res.status(204).send();
  });

  // Seed database if empty
  setTimeout(async () => {
    try {
      const participants = await storage.getParticipants();
      if (participants.length === 0) {
        const p1 = await storage.createParticipant({ name: "Alex" });
        const p2 = await storage.createParticipant({ name: "Sam" });
        const p3 = await storage.createParticipant({ name: "Jordan" });
        
        await storage.createExpense({ participantId: p1.id, category: "Meat", item: "Ribeye steaks", amount: 45.50 });
        await storage.createExpense({ participantId: p2.id, category: "Drinks", item: "Craft Beer", amount: 24.00 });
        await storage.createExpense({ participantId: p3.id, category: "Charcoal", item: "Lump charcoal", amount: 12.00 });
      }
    } catch (e) {
      console.error("Failed to seed database:", e);
    }
  }, 1000);

  return httpServer;
}
