import { pgTable, text, serial, numeric, integer, timestamp, boolean, unique, json, real, uuid, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  googleId: text("google_id").unique(),
  displayName: text("display_name"),
  passwordHash: text("password_hash"),
  avatarUrl: text("avatar_url"),
  avatarAssetId: text("avatar_asset_id"),
  profileImageUrl: text("profile_image_url"),
  bio: text("bio"),
  /** Shareable public creator profile handle (separate from username to avoid username migrations). */
  publicHandle: text("public_handle").unique(),
  /** Public creator profile visibility toggle. */
  publicProfileEnabled: boolean("public_profile_enabled").notNull().default(true),
  /** Preferred New Event starting mode. */
  defaultEventType: text("default_event_type").notNull().default("private"),

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
  durationMinutes: integer("duration_minutes").notNull().default(120),
  currency: text("currency").notNull().default("EUR"),
  creatorUserId: integer("creator_user_id").references(() => users.id, { onDelete: "set null" }),
  isPublic: boolean("is_public").notNull().default(true),
  allowOptInExpenses: boolean("allow_opt_in_expenses").notNull().default(false),
  area: text("area").notNull().default("parties"),
  eventType: text("event_type").notNull().default("default"),
  eventVibe: text("event_vibe").notNull().default("cozy"),
  templateData: json("template_data").$type<unknown | null>().default(null),
  /** Trip location: display string e.g. "Amsterdam, Netherlands" */
  locationName: text("location_name"),
  /** Human-entered location string used by private/public creation flows. */
  locationText: text("location_text"),
  /** Optional structured location info for future maps/place providers. */
  locationMeta: json("location_meta").$type<{ city?: string; countryCode?: string; countryName?: string; lat?: number; lng?: number } | null>().default(null),
  city: text("city"),
  countryCode: text("country_code"),
  countryName: text("country_name"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  placeId: text("place_id"),
  /** "auto" = derived from location; "manual" = user override */
  currencySource: text("currency_source").notNull().default("auto"),
  /** Private/public visibility for platform listing. */
  visibility: text("visibility").notNull().default("private"),
  /** Immutable origin chosen at creation: private-origin events cannot become public later. */
  visibilityOrigin: text("visibility_origin").notNull().default("public"),
  /** Public page mode. */
  publicMode: text("public_mode").notNull().default("marketing"),
  /** Public page template layout. */
  publicTemplate: text("public_template").notNull().default("classic"),
  /** Listing gate status (phase 1 stub activation). */
  publicListingStatus: text("public_listing_status").notNull().default("inactive"),
  /** Optional listing window start (event remains hidden before this). */
  publicListFromAt: timestamp("public_list_from_at"),
  /** Optional listing window end (event auto-hides after this). */
  publicListUntilAt: timestamp("public_list_until_at"),
  publicListingExpiresAt: timestamp("public_listing_expires_at"),
  publicSlug: text("public_slug").unique(),
  organizationName: text("organization_name"),
  publicDescription: text("public_description"),
  bannerImageUrl: text("banner_image_url"),
  bannerAssetId: text("banner_asset_id"),
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
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
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
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  status: text("status").notNull().default("accepted"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueBbqUser: unique().on(table.barbecueId, table.userId),
}));

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  barbecueId: integer("barbecue_id").references(() => barbecues.id, { onDelete: 'cascade' }).notNull(),
  participantId: integer("participant_id").references(() => participants.id, { onDelete: 'cascade' }).notNull(),
  category: text("category").notNull(),
  item: text("item").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  includedUserIds: text("included_user_ids").array(),
  receiptUrl: text("receipt_url"),
  receiptMime: text("receipt_mime"),
  receiptUploadedAt: timestamp("receipt_uploaded_at"),
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

export const publicEventRsvps = pgTable("public_event_rsvps", {
  id: serial("id").primaryKey(),
  barbecueId: integer("barbecue_id").references(() => barbecues.id, { onDelete: "cascade" }).notNull(),
  tierId: text("tier_id"),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  email: text("email"),
  name: text("name"),
  status: text("status").notNull().default("requested"), // requested | approved | declined | going
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniquePerUserTier: unique().on(table.barbecueId, table.userId, table.tierId),
}));

export const publicEventConversations = pgTable("public_event_conversations", {
  id: text("id").primaryKey(),
  barbecueId: integer("barbecue_id").references(() => barbecues.id, { onDelete: "cascade" }).notNull(),
  organizerUserId: integer("organizer_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  participantUserId: integer("participant_user_id").references(() => users.id, { onDelete: "cascade" }),
  participantEmail: text("participant_email"),
  participantLabel: text("participant_label"),
  status: text("status").notNull().default("pending"), // pending | active | archived | blocked
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniquePerEventParticipant: unique().on(table.barbecueId, table.organizerUserId, table.participantUserId),
}));

export const publicEventMessages = pgTable("public_event_messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").references(() => publicEventConversations.id, { onDelete: "cascade" }).notNull(),
  senderUserId: integer("sender_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  readAt: timestamp("read_at"),
});

export const eventMembers = pgTable("event_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: integer("event_id").references(() => barbecues.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  role: text("role").notNull().default("member"), // member | owner
  joinedAt: timestamp("joined_at").defaultNow(),
  lastReadActivityAt: timestamp("last_read_activity_at", { withTimezone: true }),
}, (table) => ({
  uniqueEventUser: unique().on(table.eventId, table.userId),
}));

export const eventInvites = pgTable("event_invites", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: integer("event_id").references(() => barbecues.id, { onDelete: "cascade" }).notNull(),
  inviterUserId: integer("inviter_user_id").references(() => users.id, { onDelete: "set null" }),
  email: text("email"),
  token: text("token").notNull().unique(),
  status: text("status").notNull().default("pending"), // pending | accepted | revoked | expired
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedByUserId: integer("accepted_by_user_id").references(() => users.id, { onDelete: "set null" }),
  acceptedAt: timestamp("accepted_at"),
});

export const planActivity = pgTable("plan_activity", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => barbecues.id, { onDelete: "cascade" }).notNull(),
  type: text("type").notNull(),
  actorUserId: integer("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  actorName: text("actor_name"),
  message: text("message").notNull(),
  meta: json("meta").$type<Record<string, unknown> | null>().default(null),
  createdAt: timestamp("created_at").defaultNow(),
});

export const eventChatMessages = pgTable("event_chat_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: integer("event_id").references(() => barbecues.id, { onDelete: "cascade" }).notNull(),
  authorUserId: integer("author_user_id").references(() => users.id, { onDelete: "set null" }),
  authorName: text("author_name"),
  authorAvatarUrl: text("author_avatar_url"),
  clientMessageId: uuid("client_message_id").defaultRandom().notNull(),
  type: text("type").notNull().default("user"), // user | system
  content: text("content").notNull(),
  metadata: json("metadata").$type<Record<string, unknown> | null>().default(null),
  hiddenAt: timestamp("hidden_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  editedAt: timestamp("edited_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => ({
  eventCreatedAtIdx: index("event_chat_messages_event_created_at_idx").on(table.eventId, table.createdAt),
  eventIdIdx: index("event_chat_messages_event_id_idx").on(table.eventId, table.id),
  eventClientMessageIdUnique: unique("event_chat_messages_event_client_message_id_unique").on(table.eventId, table.clientMessageId),
}));

export const eventChatMessageReactions = pgTable("event_chat_message_reactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  messageId: uuid("message_id").references(() => eventChatMessages.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  messageEmojiIdx: index("event_chat_message_reactions_message_emoji_idx").on(table.messageId, table.emoji),
  uniqueUserReactionPerEmoji: unique("event_chat_message_reactions_message_user_emoji_unique").on(table.messageId, table.userId, table.emoji),
}));

export const eventSettlements = pgTable("event_settlements", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: integer("event_id").references(() => barbecues.id, { onDelete: "cascade" }).notNull(),
  status: text("status").notNull().default("proposed"), // proposed | in_progress | settled
  settledAt: timestamp("settled_at", { withTimezone: true }),
  source: text("source").notNull().default("auto"), // auto | manual
  createdByUserId: integer("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const eventSettlementTransfers = pgTable("event_settlement_transfers", {
  id: uuid("id").defaultRandom().primaryKey(),
  settlementId: uuid("settlement_id").references(() => eventSettlements.id, { onDelete: "cascade" }).notNull(),
  fromUserId: integer("from_user_id").references(() => users.id, { onDelete: "set null" }).notNull(),
  toUserId: integer("to_user_id").references(() => users.id, { onDelete: "set null" }).notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  paidByUserId: integer("paid_by_user_id").references(() => users.id, { onDelete: "set null" }),
  paymentRef: text("payment_ref"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  settlementIdx: index("event_settlement_transfers_settlement_idx").on(table.settlementId),
}));

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
export const insertParticipantSchema = createInsertSchema(participants).omit({ id: true, createdAt: true });
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true }).extend({
  amount: z.union([z.string(), z.number()]),
  includedUserIds: z.array(z.string()).optional().nullable(),
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

export type EventMember = typeof eventMembers.$inferSelect;
export type EventInvite = typeof eventInvites.$inferSelect;
export type PlanActivity = typeof planActivity.$inferSelect;
export type EventChatMessageRow = typeof eventChatMessages.$inferSelect;
export type EventSettlement = typeof eventSettlements.$inferSelect;
export type EventSettlementTransfer = typeof eventSettlementTransfers.$inferSelect;

export type ExpenseWithParticipant = Expense & {
  participantName: string;
  participantUserId?: number | null;
};

export type Note = typeof notes.$inferSelect;
export type InsertNote = z.infer<typeof insertNoteSchema>;

export type NoteWithAuthor = Note & {
  authorName: string;
};

export type PublicEventRsvp = typeof publicEventRsvps.$inferSelect;
export type PublicEventConversation = typeof publicEventConversations.$inferSelect;
export type PublicEventMessage = typeof publicEventMessages.$inferSelect;

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
