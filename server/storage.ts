import { db } from "./db";
import {
  users,
  barbecues,
  participants,
  expenses,
  type User,
  type Barbecue,
  type Participant,
  type Expense,
  type InsertUser,
  type InsertBarbecue,
  type InsertParticipant,
  type InsertExpense,
  type ExpenseWithParticipant,
  type Membership,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  createUser(u: InsertUser): Promise<User>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;

  getBarbecues(currentUsername?: string): Promise<Barbecue[]>;
  getBarbecue(id: number): Promise<Barbecue | undefined>;
  createBarbecue(b: InsertBarbecue): Promise<Barbecue>;
  deleteBarbecue(id: number): Promise<void>;

  getParticipants(bbqId: number): Promise<Participant[]>;
  getPendingRequests(bbqId: number): Promise<Participant[]>;
  getInvitedParticipants(bbqId: number): Promise<Participant[]>;
  getParticipant(id: number): Promise<Participant | undefined>;
  createParticipant(p: InsertParticipant): Promise<Participant>;
  joinBarbecue(bbqId: number, name: string, userId: string): Promise<Participant>;
  inviteParticipant(bbqId: number, name: string, userId: string): Promise<Participant>;
  acceptParticipant(id: number): Promise<Participant | undefined>;
  deleteParticipant(id: number): Promise<void>;
  getMemberships(userId: string): Promise<Membership[]>;

  getExpenses(bbqId: number): Promise<ExpenseWithParticipant[]>;
  createExpense(e: InsertExpense): Promise<Expense>;
  updateExpense(id: number, updates: Partial<InsertExpense>): Promise<Expense | undefined>;
  deleteExpense(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async createUser(u: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(u).returning();
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [u] = await db.select().from(users).where(eq(users.username, username));
    return u;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [u] = await db.select().from(users).where(eq(users.id, id));
    return u;
  }

  async getBarbecues(currentUsername?: string): Promise<Barbecue[]> {
    const all = await db.select().from(barbecues);
    if (!currentUsername) return all.filter(b => b.isPublic);

    const userParticipations = await db.select({ bbqId: participants.barbecueId })
      .from(participants)
      .where(eq(participants.userId, currentUsername));
    const participatingIds = new Set(userParticipations.map(p => p.bbqId));

    return all.filter(b => {
      if (b.isPublic) return true;
      if (b.creatorId === currentUsername) return true;
      if (participatingIds.has(b.id)) return true;
      return false;
    });
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

  async getInvitedParticipants(bbqId: number): Promise<Participant[]> {
    return await db.select().from(participants).where(
      and(eq(participants.barbecueId, bbqId), eq(participants.status, "invited"))
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
    const [p] = await db.insert(participants).values({ barbecueId: bbqId, name, userId, status: "pending" }).returning();
    return p;
  }

  async inviteParticipant(bbqId: number, name: string, userId: string): Promise<Participant> {
    const [p] = await db.insert(participants).values({ barbecueId: bbqId, name, userId, status: "invited" }).returning();
    return p;
  }

  async acceptParticipant(id: number): Promise<Participant | undefined> {
    const [updated] = await db.update(participants).set({ status: "accepted" }).where(eq(participants.id, id)).returning();
    return updated;
  }

  async deleteParticipant(id: number): Promise<void> {
    await db.delete(participants).where(eq(participants.id, id));
  }

  async getMemberships(userId: string): Promise<Membership[]> {
    const rows = await db.select().from(participants).where(eq(participants.userId, userId));
    return rows.map(p => ({ bbqId: p.barbecueId, participantId: p.id, status: p.status, name: p.name }));
  }

  async getExpenses(bbqId: number): Promise<ExpenseWithParticipant[]> {
    const allExpenses = await db.select().from(expenses).where(eq(expenses.barbecueId, bbqId));
    const allParticipants = await this.getParticipants(bbqId);
    return allExpenses.map(e => {
      const p = allParticipants.find(p => p.id === e.participantId);
      return { ...e, participantName: p ? p.name : 'Unknown' };
    });
  }

  async createExpense(e: InsertExpense): Promise<Expense> {
    const [expense] = await db.insert(expenses).values({ ...e, amount: e.amount.toString() }).returning();
    return expense;
  }

  async updateExpense(id: number, updates: Partial<InsertExpense>): Promise<Expense | undefined> {
    const updateData: Record<string, any> = { ...updates };
    if (updateData.amount !== undefined) updateData.amount = String(updateData.amount);
    const [updated] = await db.update(expenses).set(updateData as any).where(eq(expenses.id, id)).returning();
    return updated;
  }

  async deleteExpense(id: number): Promise<void> {
    await db.delete(expenses).where(eq(expenses.id, id));
  }
}

export const storage = new DatabaseStorage();
