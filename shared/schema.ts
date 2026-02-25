import { pgTable, text, serial, numeric, integer, timestamp, boolean, unique, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  passwordHash: text("password_hash").notNull(),
  avatarUrl: text("avatar_url"),
  profileImageUrl: text("profile_image_url"),
  bio: text("bio"),

  // (Optional) If this is meant to be a list, consider making it .array()
  preferredCurrencyCodes: text("preferred_currency_codes"),

  /** User default currency (ISO-4217) for auto-currency fallback */
  defaultCurrencyCode: text("default_currency_code").notNull().default("EUR"),

  /** User pinned/favorite currencies for quick switching */
  favoriteCurrencyCodes: text("favorite_currency_codes")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),

  /** Plan tier for feature gating. Default free. */
  plan: text("plan").notNull().default("free"),
  /** When pro plan expires (nullable for free). */
  planExpiresAt: timestamp("plan_expires_at"),
  /** When email was verified (null = not verified). */
  emailVerifiedAt: timestamp("email_verified_at"),
  /** Hashed email verification token. */
  emailVerifyToken: text("email_verify_token"),
  /** Token expiry. */
  emailVerifyTokenExpiresAt: timestamp("email_verify_token_expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const appMeta = pgTable("app_meta", {
  id: integer("id").primaryKey(),
  schemaVersion: integer("schema_version").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
});

/** Session table used by connect-pg-simple (express-session). Declared here so Drizzle does not propose dropping it on db:push. */
export const session = pgTable("session", {
  sid: text("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire").notNull(),
});

export const eventTypeEnum = [
  "default", "barbecue", "birthday", "dinner_party", "house_party", "game_night", "movie_night", "pool_party", "after_party", "other_party",
  "city_trip", "road_trip", "beach_trip", "ski_trip", "festival_trip", "hiking_trip", "camping", "weekend_getaway", "business_trip", "other_trip",
  /* legacy - kept for backward compat */ "vacation", "backpacking", "bachelor_trip", "workation",
  "cinema", "theme_park", "day_out",
] as const;
export const areaEnum = ["parties", "trips"] as const;

export const barbecues = pgTable("barbecues", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  date: timestamp("date").notNull().defaultNow(),
  currency: text("currency").notNull().default("EUR"),
  creatorId: text("creator_id"),
  isPublic: boolean("is_public").notNull().default(true),
  allowOptInExpenses: boolean("allow_opt_in_expenses").notNull().default(false),
  area: text("area").notNull().default("parties"),
  eventType: text("event_type").notNull().default("default"),
  templateData: json("template_data").$type<unknown | null>().default(null),
  /** Trip location: display string e.g. "Amsterdam, Netherlands" */
  locationName: text("location_name"),
  city: text("city"),
  countryCode: text("country_code"),
  countryName: text("country_name"),
  placeId: text("place_id"),
  /** "auto" = derived from location; "manual" = user override */
  currencySource: text("currency_source").notNull().default("auto"),
  /** Private/public visibility for platform listing. */
  visibility: text("visibility").notNull().default("private"),
  /** Public page mode. */
  publicMode: text("public_mode").notNull().default("marketing"),
  /** Listing gate status (phase 1 stub activation). */
  publicListingStatus: text("public_listing_status").notNull().default("inactive"),
  publicListingExpiresAt: timestamp("public_listing_expires_at"),
  publicSlug: text("public_slug").unique(),
  organizationName: text("organization_name"),
  publicDescription: text("public_description"),
  bannerImageUrl: text("banner_image_url"),
  publicViewCount: integer("public_view_count").notNull().default(0),
  /** Stable invite token for /join/:token links. Generated on create. */
  inviteToken: text("invite_token").unique(),
  /** Event lifecycle: draft | active | settling | settled. Default active. */
  status: text("status").notNull().default("active"),
  /** When creator triggered "Settle up" — used for "updated after" badge. */
  settledAt: timestamp("settled_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const eventNotifications = pgTable("event_notifications", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  barbecueId: integer("barbecue_id").references(() => barbecues.id, { onDelete: "cascade" }).notNull(),
  type: text("type").notNull(),
  payload: json("payload").$type<{ creatorName?: string; amountOwed?: number; eventName?: string; currency?: string } | null>().default(null),
  createdAt: timestamp("created_at").defaultNow(),
  readAt: timestamp("read_at"),
});

export const participants = pgTable("participants", {
  id: serial("id").primaryKey(),
  barbecueId: integer("barbecue_id").references(() => barbecues.id, { onDelete: 'cascade' }).notNull(),
  name: text("name").notNull(),
  userId: text("user_id"),
  /** FK to users.id when status='invited' — links invite to target user. */
  invitedUserId: integer("invited_user_id").references(() => users.id, { onDelete: "set null" }),
  status: text("status").notNull().default("accepted"),
});

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  barbecueId: integer("barbecue_id").references(() => barbecues.id, { onDelete: 'cascade' }).notNull(),
  participantId: integer("participant_id").references(() => participants.id, { onDelete: 'cascade' }).notNull(),
  category: text("category").notNull(),
  item: text("item").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const expenseShares = pgTable("expense_shares", {
  id: serial("id").primaryKey(),
  expenseId: integer("expense_id").references(() => expenses.id, { onDelete: 'cascade' }).notNull(),
  participantId: integer("participant_id").references(() => participants.id, { onDelete: 'cascade' }).notNull(),
}, (table) => ({
  expenseParticipantUnique: unique().on(table.expenseId, table.participantId),
}));

export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  barbecueId: integer("barbecue_id").references(() => barbecues.id, { onDelete: "cascade" }).notNull(),
  participantId: integer("participant_id").references(() => participants.id, { onDelete: "cascade" }).notNull(),
  title: text("title"),
  body: text("body").notNull(),
  pinned: boolean("pinned").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertNoteSchema = createInsertSchema(notes)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    title: z.string().max(200).optional().nullable(),
    body: z.string().min(1, "Note body is required").max(10000),
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
export type StripeEvent = typeof stripeEvents.$inferSelect;

export type Barbecue = typeof barbecues.$inferSelect;
export type InsertBarbecue = z.infer<typeof insertBarbecueSchema>;

export type Participant = typeof participants.$inferSelect;
export type InsertParticipant = z.infer<typeof insertParticipantSchema>;

export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;

export type ExpenseWithParticipant = Expense & {
  participantName: string;
  participantUserId?: string | null;
};

export type Note = typeof notes.$inferSelect;
export type InsertNote = z.infer<typeof insertNoteSchema>;

export type NoteWithAuthor = Note & {
  authorName: string;
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
