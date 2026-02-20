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
  type ExpenseWithParticipant
} from "@shared/schema";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  getBarbecues(): Promise<Barbecue[]>;
  getBarbecue(id: number): Promise<Barbecue | undefined>;
  createBarbecue(b: InsertBarbecue): Promise<Barbecue>;
  deleteBarbecue(id: number): Promise<void>;

  getParticipants(bbqId: number): Promise<Participant[]>;
  createParticipant(p: InsertParticipant): Promise<Participant>;
  deleteParticipant(id: number): Promise<void>;
  
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
    return await db.select().from(participants).where(eq(participants.barbecueId, bbqId));
  }

  async createParticipant(p: InsertParticipant): Promise<Participant> {
    const [participant] = await db.insert(participants).values(p).returning();
    return participant;
  }

  async deleteParticipant(id: number): Promise<void> {
    await db.delete(participants).where(eq(participants.id, id));
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
