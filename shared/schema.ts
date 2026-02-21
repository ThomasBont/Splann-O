import { pgTable, text, serial, numeric, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
});

export const barbecues = pgTable("barbecues", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  date: timestamp("date").notNull().defaultNow(),
  currency: text("currency").notNull().default("EUR"),
  creatorId: text("creator_id"),
  isPublic: boolean("is_public").notNull().default(true),
});

export const participants = pgTable("participants", {
  id: serial("id").primaryKey(),
  barbecueId: integer("barbecue_id").references(() => barbecues.id, { onDelete: 'cascade' }).notNull(),
  name: text("name").notNull(),
  userId: text("user_id"),
  status: text("status").notNull().default("accepted"),
});

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  barbecueId: integer("barbecue_id").references(() => barbecues.id, { onDelete: 'cascade' }).notNull(),
  participantId: integer("participant_id").references(() => participants.id, { onDelete: 'cascade' }).notNull(),
  category: text("category").notNull(),
  item: text("item").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
});

export const friendships = pgTable("friendships", {
  id: serial("id").primaryKey(),
  requesterId: integer("requester_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  addresseeId: integer("addressee_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertBarbecueSchema = createInsertSchema(barbecues).omit({ id: true });
export const insertParticipantSchema = createInsertSchema(participants).omit({ id: true });
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true }).extend({
  amount: z.union([z.string(), z.number()]),
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

export type Barbecue = typeof barbecues.$inferSelect;
export type InsertBarbecue = z.infer<typeof insertBarbecueSchema>;

export type Participant = typeof participants.$inferSelect;
export type InsertParticipant = z.infer<typeof insertParticipantSchema>;

export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;

export type ExpenseWithParticipant = Expense & {
  participantName: string;
};

export type Friendship = typeof friendships.$inferSelect;

export type FriendInfo = {
  friendshipId: number;
  userId: number;
  username: string;
  displayName: string | null;
  status: string;
};

export type Membership = {
  bbqId: number;
  participantId: number;
  status: string;
  name: string;
};

export type PendingRequestWithBbq = Participant & {
  bbqName: string;
};
