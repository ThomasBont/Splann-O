import { db } from "../db";
import { expenses, expenseShares, notes, barbecues } from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import { desc } from "drizzle-orm";
import type { Expense, ExpenseWithParticipant, NoteWithAuthor, InsertNote } from "@shared/schema";
import { participantRepo } from "./participantRepo";

type ExpenseInsertRow = Omit<typeof expenses.$inferInsert, "amount"> & { amount: string | number };
type ExpenseUpdateRow = Partial<Omit<typeof expenses.$inferInsert, "amount">> & { amount?: string | number };

export const expenseRepo = {
  async listByBbq(bbqId: number): Promise<ExpenseWithParticipant[]> {
    const allExpenses = await db.select().from(expenses).where(eq(expenses.barbecueId, bbqId));
    const allParticipants = await participantRepo.listByBbq(bbqId, "accepted");
    return allExpenses.map((e) => {
      const p = allParticipants.find((p) => p.id === e.participantId);
      return { ...e, participantName: p ? p.name : "Unknown", participantUserId: p?.userId ?? null };
    });
  },

  async create(e: ExpenseInsertRow, options?: { optInByDefault?: boolean }): Promise<Expense> {
    const [expense] = await db.insert(expenses).values({ ...e, amount: e.amount.toString() }).returning();
    const [bbqData] = await db.select().from(barbecues).where(eq(barbecues.id, e.barbecueId));
    if (bbqData?.allowOptInExpenses && options?.optInByDefault !== true) {
      const accepted = await participantRepo.listByBbq(e.barbecueId, "accepted");
      if (accepted.length > 0) {
        await db.insert(expenseShares).values(accepted.map((p) => ({ expenseId: expense.id, participantId: p.id })));
      }
    }
    return expense;
  },

  async update(id: number, updates: ExpenseUpdateRow): Promise<Expense | undefined> {
    const updateData: Record<string, unknown> = { ...updates };
    if (updateData.amount !== undefined) updateData.amount = String(updateData.amount);
    const [updated] = await db.update(expenses).set(updateData as Record<string, unknown>).where(eq(expenses.id, id)).returning();
    return updated;
  },

  async delete(id: number): Promise<void> {
    await db.delete(expenses).where(eq(expenses.id, id));
  },

  async getExpenseShares(bbqId: number): Promise<{ expenseId: number; participantId: number }[]> {
    const exps = await db.select({ id: expenses.id }).from(expenses).where(eq(expenses.barbecueId, bbqId));
    if (exps.length === 0) return [];
    const rows = await db.select().from(expenseShares).where(inArray(expenseShares.expenseId, exps.map((x) => x.id)));
    return rows.map((r) => ({ expenseId: r.expenseId, participantId: r.participantId }));
  },

  async setExpenseShare(expenseId: number, participantId: number, inShare: boolean): Promise<void> {
    if (inShare) {
      await db.insert(expenseShares).values({ expenseId, participantId }).onConflictDoNothing({ target: [expenseShares.expenseId, expenseShares.participantId] });
    } else {
      await db.delete(expenseShares).where(and(eq(expenseShares.expenseId, expenseId), eq(expenseShares.participantId, participantId)));
    }
  },

  async getNotes(bbqId: number): Promise<NoteWithAuthor[]> {
    const rows = await db.select().from(notes).where(eq(notes.barbecueId, bbqId)).orderBy(desc(notes.createdAt));
    const participantsList = await participantRepo.listByBbq(bbqId, "accepted");
    return rows.map((n) => {
      const p = participantsList.find((x) => x.id === n.participantId);
      return { ...n, authorName: p ? p.name : "Unknown" };
    });
  },

  async createNote(n: InsertNote): Promise<NoteWithAuthor> {
    const [row] = await db.insert(notes).values({ ...n, updatedAt: new Date() }).returning();
    const p = await participantRepo.getById(row.participantId);
    return { ...row, authorName: p ? p.name : "Unknown" };
  },

  async updateNote(id: number, updates: { title?: string | null; body?: string; pinned?: boolean }): Promise<NoteWithAuthor | undefined> {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.title !== undefined) set.title = updates.title;
    if (updates.body !== undefined) set.body = updates.body;
    if (updates.pinned !== undefined) set.pinned = updates.pinned;
    const [row] = await db.update(notes).set(set as Record<string, unknown>).where(eq(notes.id, id)).returning();
    if (!row) return undefined;
    const p = await participantRepo.getById(row.participantId);
    return { ...row, authorName: p ? p.name : "Unknown" };
  },

  async deleteNote(id: number): Promise<void> {
    await db.delete(notes).where(eq(notes.id, id));
  },
};
