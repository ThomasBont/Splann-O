import { db } from "./db";
import {
  participants,
  expenses,
  type Participant,
  type Expense,
  type CreateParticipantRequest,
  type CreateExpenseRequest,
  type UpdateExpenseRequest,
  type ExpenseWithParticipant
} from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  getParticipants(): Promise<Participant[]>;
  createParticipant(p: CreateParticipantRequest): Promise<Participant>;
  deleteParticipant(id: number): Promise<void>;
  
  getExpenses(): Promise<ExpenseWithParticipant[]>;
  createExpense(e: CreateExpenseRequest): Promise<Expense>;
  updateExpense(id: number, updates: UpdateExpenseRequest): Promise<Expense | undefined>;
  deleteExpense(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getParticipants(): Promise<Participant[]> {
    return await db.select().from(participants);
  }

  async createParticipant(p: CreateParticipantRequest): Promise<Participant> {
    const [participant] = await db.insert(participants).values(p).returning();
    return participant;
  }

  async deleteParticipant(id: number): Promise<void> {
    await db.delete(participants).where(eq(participants.id, id));
  }

  async getExpenses(): Promise<ExpenseWithParticipant[]> {
    const allExpenses = await db.select().from(expenses);
    const allParticipants = await this.getParticipants();
    
    return allExpenses.map(e => {
      const p = allParticipants.find(p => p.id === e.participantId);
      return {
        ...e,
        participantName: p ? p.name : 'Unknown'
      };
    });
  }

  async createExpense(e: CreateExpenseRequest): Promise<Expense> {
    const [expense] = await db.insert(expenses).values({
      ...e,
      amount: e.amount.toString(),
    }).returning();
    return expense;
  }

  async updateExpense(id: number, updates: UpdateExpenseRequest): Promise<Expense | undefined> {
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
