import { pgTable, text, serial, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const participants = pgTable("participants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  participantId: integer("participant_id").references(() => participants.id, { onDelete: 'cascade' }),
  category: text("category").notNull(),
  item: text("item").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
});

export const insertParticipantSchema = createInsertSchema(participants).omit({ id: true });
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true }).extend({
  amount: z.union([z.string(), z.number()]),
});

export type Participant = typeof participants.$inferSelect;
export type InsertParticipant = z.infer<typeof insertParticipantSchema>;

export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;

export type CreateParticipantRequest = InsertParticipant;
export type CreateExpenseRequest = InsertExpense;
export type UpdateExpenseRequest = Partial<InsertExpense>;

export type ExpenseWithParticipant = Expense & {
  participantName: string;
};
