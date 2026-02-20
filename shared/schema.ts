import { pgTable, text, serial, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const barbecues = pgTable("barbecues", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  date: timestamp("date").notNull().defaultNow(),
  currency: text("currency").notNull().default("EUR"),
});

export const participants = pgTable("participants", {
  id: serial("id").primaryKey(),
  barbecueId: integer("barbecue_id").references(() => barbecues.id, { onDelete: 'cascade' }).notNull(),
  name: text("name").notNull(),
});

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  barbecueId: integer("barbecue_id").references(() => barbecues.id, { onDelete: 'cascade' }).notNull(),
  participantId: integer("participant_id").references(() => participants.id, { onDelete: 'cascade' }).notNull(),
  category: text("category").notNull(),
  item: text("item").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
});

export const insertBarbecueSchema = createInsertSchema(barbecues).omit({ id: true });
export const insertParticipantSchema = createInsertSchema(participants).omit({ id: true });
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true }).extend({
  amount: z.union([z.string(), z.number()]),
});

export type Barbecue = typeof barbecues.$inferSelect;
export type InsertBarbecue = z.infer<typeof insertBarbecueSchema>;

export type Participant = typeof participants.$inferSelect;
export type InsertParticipant = z.infer<typeof insertParticipantSchema>;

export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;

export type ExpenseWithParticipant = Expense & {
  participantName: string;
};
