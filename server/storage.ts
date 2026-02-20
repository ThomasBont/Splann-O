import { db } from "./db";
import {
  barbecues,
  participants,
  expenses,
  type Barbecue,
  type Participant,
  type Expense,
  type InsertBarbecue,
  type InsertParticipant,
  type InsertExpense,
  type ExpenseWithParticipant,
  type Membership,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  getBarbecues(): Promise<Barbecue[]>;
  getBarbecue(id: number): Promise<Barbecue | undefined>;
  createBarbecue(b: InsertBarbecue): Promise<Barbecue>;
  deleteBarbecue(id: number): Promise<void>;

  getParticipants(bbqId: number): Promise<Participant[]>;
  getPendingRequests(bbqId: number): Promise<Participant[]>;
  getParticipant(id: number): Promise<Participant | undefined>;
  createParticipant(p: InsertParticipant): Promise<Participant>;
  joinBarbecue(bbqId: number, name: string, userId: string): Promise<Participant>;
  acceptParticipant(id: number): Promise<Participant | undefined>;
  deleteParticipant(id: number): Promise<void>;
  getMemberships(userId: string): Promise<Membership[]>;

  getExpenses(bbqId: number): Promise<ExpenseWithParticipant[]>;
  createExpense(e: InsertExpense): Promise<Expense>;
  updateExpense(id: number, updates: Partial<InsertExpense>): Promise<Expense | undefined>;
  deleteExpense(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getBarbecues(): Promise<Barbecue[]> {
    return await db.select().from(barbecues);
  }

  async getBarbecue(id: number): Promise<Barbecue | undefined> {
    const [b] = await db.select().from(barbecues).where(eq(barbecues.id, id));
    return b;
  }

  async createBarbecue(b: InsertBarbecue): Promise<Barbecue> {
    const [bbq] = await db.insert(barbecues).values(b).returning();
    return bbq;
  }

  async deleteBarbecue(id: number): Promise<void> {
    await db.delete(barbecues).where(eq(barbecues.id, id));
  }

  async getParticipants(bbqId: number): Promise<Participant[]> {
    return await db.select().from(participants).where(
      and(eq(participants.barbecueId, bbqId), eq(participants.status, "accepted"))
    );
  }

  async getPendingRequests(bbqId: number): Promise<Participant[]> {
    return await db.select().from(participants).where(
      and(eq(participants.barbecueId, bbqId), eq(participants.status, "pending"))
    );
  }

  async getParticipant(id: number): Promise<Participant | undefined> {
    const [p] = await db.select().from(participants).where(eq(participants.id, id));
    return p;
  }

  async createParticipant(p: InsertParticipant): Promise<Participant> {
    const [participant] = await db.insert(participants).values(p).returning();
    return participant;
  }

  async joinBarbecue(bbqId: number, name: string, userId: string): Promise<Participant> {
    const [participant] = await db.insert(participants).values({
      barbecueId: bbqId,
      name,
      userId,
      status: "pending",
    }).returning();
    return participant;
  }

  async acceptParticipant(id: number): Promise<Participant | undefined> {
    const [updated] = await db.update(participants)
      .set({ status: "accepted" })
      .where(eq(participants.id, id))
      .returning();
    return updated;
  }

  async deleteParticipant(id: number): Promise<void> {
    await db.delete(participants).where(eq(participants.id, id));
  }

  async getMemberships(userId: string): Promise<Membership[]> {
    const rows = await db.select().from(participants).where(eq(participants.userId, userId));
    return rows.map(p => ({
      bbqId: p.barbecueId,
      participantId: p.id,
      status: p.status,
      name: p.name,
    }));
  }

  async getExpenses(bbqId: number): Promise<ExpenseWithParticipant[]> {
    const allExpenses = await db.select().from(expenses).where(eq(expenses.barbecueId, bbqId));
    const allParticipants = await this.getParticipants(bbqId);

    return allExpenses.map(e => {
      const p = allParticipants.find(p => p.id === e.participantId);
      return {
        ...e,
        participantName: p ? p.name : 'Unknown'
      };
    });
  }

  async createExpense(e: InsertExpense): Promise<Expense> {
    const [expense] = await db.insert(expenses).values({
      ...e,
      amount: e.amount.toString(),
    }).returning();
    return expense;
  }

  async updateExpense(id: number, updates: Partial<InsertExpense>): Promise<Expense | undefined> {
    const updateData = { ...updates };
    if (updateData.amount !== undefined) {
      updateData.amount = updateData.amount.toString();
    }
    const [updated] = await db.update(expenses)
      .set(updateData)
      .where(eq(expenses.id, id))
      .returning();
    return updated;
  }

  async deleteExpense(id: number): Promise<void> {
    await db.delete(expenses).where(eq(expenses.id, id));
  }
}

export const storage = new DatabaseStorage();
