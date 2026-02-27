#!/usr/bin/env npx tsx
import "dotenv/config";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, pool } from "../server/db";
import {
  barbecues,
  participants,
  expenses,
  expenseShares,
  notes,
  publicEventRsvps,
  users,
  type InsertBarbecue,
} from "../shared/schema";

const SEED_TAG = "dev-seed-v2";

function getDbHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

function assertSafe() {
  const nodeEnv = process.env.NODE_ENV;
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL is required");
  const host = getDbHost(dbUrl);
  const allow = process.env.ALLOW_DB_RESET === "true";
  if (!allow && nodeEnv !== "development") {
    throw new Error("Refusing to run outside development. Set ALLOW_DB_RESET=true to override.");
  }
  if (!allow && /render\.com|onrender/i.test(host)) {
    throw new Error("Refusing to run on Render-like host. Set ALLOW_DB_RESET=true to override.");
  }
  console.log("[db:seed:dev] host:", host);
  console.log("[db:seed:dev] NODE_ENV:", nodeEnv ?? "(unset)");
}

type SeedParticipant = { name: string; userId?: string | null; status?: "accepted" | "pending" | "invited" };
type SeedExpense = { participantName: string; category: string; item: string; amount: string; shareWith: string[] };
type SeedRsvp = { name: string; email: string; status: "requested" | "approved" | "declined" | "going"; tierId?: string | null };
type SeedEventInput = InsertBarbecue & {
  participants: SeedParticipant[];
  expenses?: SeedExpense[];
  noteBody?: string;
  rsvps?: SeedRsvp[];
};

const PRIVATE_TEMPLATES = [
  { id: "trip", eventType: "city_trip", area: "trips" as const, emoji: "✈️" },
  { id: "dinner", eventType: "dinner_party", area: "parties" as const, emoji: "🍝" },
  { id: "game_night", eventType: "game_night", area: "parties" as const, emoji: "🎮" },
  { id: "party", eventType: "house_party", area: "parties" as const, emoji: "🎉" },
  { id: "weekend", eventType: "weekend_getaway", area: "trips" as const, emoji: "🏕️" },
  { id: "generic", eventType: "other_party", area: "parties" as const, emoji: "🙂" },
] as const;

const PRIVATE_NAMES = [
  "Lisbon Roadtrip Crew",
  "Copenhagen Movie Night",
  "Sunday Dinner — De Pijp",
  "Prague Game Night",
  "Beach Weekend Cádiz",
  "Barcelona Tapas Crawl",
  "Lake Cabin Weekend",
  "Tokyo Snack Night",
  "Seoul Friends Dinner",
  "Montreal Housemates Utilities",
  "London Boardgame Social",
  "Stockholm Cozy Dinner",
  "Kyoto Cherry Trip Crew",
  "Berlin Birthday Loft",
  "Osaka Weekend Escape",
  "New York Brunch Club",
  "Milan Aperitivo Circle",
  "Cairo Rooftop Friends",
  "Toronto Game + Pizza Night",
  "Vienna Sunday Roast",
  "Reykjavík Northern Lights Crew",
  "Cape Town Friends Cookout",
] as const;

const PUBLIC_NAMES = [
  "Indie Night Meetup",
  "Community Workshop",
  "Design Systems Breakfast",
  "Local Makers Fair",
  "Sunset Dance Session",
  "Creative Coding Jam",
  "Urban Photo Walk Collective",
  "City Founders Roundtable",
  "Live Jazz Rooftop Sessions",
  "Wellness Breathwork Circle",
  "Neighborhood Food Market",
  "Open Studio Portfolio Night",
  "AI for Creators Evening",
  "Public Speaking Masterclass",
  "Night Run + Coffee Club",
  "Makers & Musicians Mixer",
  "Freelancers Accountability Club",
  "Global Product Crit Meetup",
  "Sustainable Design Forum",
  "Community Art Jam",
] as const;

const CITIES = [
  ["Amsterdam", "NL", "Netherlands", "EUR"],
  ["Paris", "FR", "France", "EUR"],
  ["London", "GB", "United Kingdom", "GBP"],
  ["Tokyo", "JP", "Japan", "JPY"],
  ["New York", "US", "United States", "USD"],
  ["Prague", "CZ", "Czech Republic", "CZK"],
  ["Copenhagen", "DK", "Denmark", "DKK"],
  ["Stockholm", "SE", "Sweden", "SEK"],
  ["Zurich", "CH", "Switzerland", "CHF"],
  ["Toronto", "CA", "Canada", "CAD"],
  ["Lisbon", "PT", "Portugal", "EUR"],
  ["Barcelona", "ES", "Spain", "EUR"],
] as const;

const PUBLIC_BANNERS = [
  "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1503428593586-e225b39bddfe?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80",
];

const PRIVATE_BANNERS = [
  "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1464375117522-1311d6a5b81f?auto=format&fit=crop&w=1200&q=80",
];

function getDate(daysFromNow: number, hour = 18): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56);
}

async function ensureSeedUser() {
  const envEmail = process.env.SEED_USER_EMAIL?.trim();
  const envUsername = process.env.SEED_USERNAME?.trim();

  let existing = null as (typeof users.$inferSelect) | null;
  if (envEmail) {
    [existing] = await db.select().from(users).where(eq(users.email, envEmail)).limit(1);
  }
  if (!existing && envUsername) {
    [existing] = await db.select().from(users).where(eq(users.username, envUsername)).limit(1);
  }
  if (!existing) {
    [existing] = await db.select().from(users).where(eq(users.username, "dev")).limit(1);
  }
  if (existing) return existing;

  const passwordHash = await bcrypt.hash("dev12345", 10);
  const [created] = await db.insert(users).values({
    username: envUsername || "dev",
    email: envEmail || "dev@splanno.local",
    displayName: "Dev Host",
    passwordHash,
    publicHandle: "dev-host",
    publicProfileEnabled: true,
    defaultEventType: "private",
  }).returning();
  return created;
}

async function createEvent(input: SeedEventInput) {
  const { participants: participantSeeds, expenses: expenseSeeds = [], noteBody, rsvps = [], ...eventValues } = input;
  const [event] = await db.insert(barbecues).values(eventValues).returning();

  const createdParticipants = await Promise.all(
    participantSeeds.map(async (p) => {
      const [row] = await db.insert(participants).values({
        barbecueId: event.id,
        name: p.name,
        userId: p.userId ?? null,
        status: p.status ?? "accepted",
      }).returning();
      return row;
    }),
  );

  const byName = new Map(createdParticipants.map((p) => [p.name, p]));

  for (const exp of expenseSeeds) {
    const payer = byName.get(exp.participantName);
    if (!payer) continue;
    const [row] = await db.insert(expenses).values({
      barbecueId: event.id,
      participantId: payer.id,
      category: exp.category,
      item: exp.item,
      amount: exp.amount,
    }).returning();
    for (const shareName of exp.shareWith) {
      const participant = byName.get(shareName);
      if (!participant) continue;
      await db.insert(expenseShares).values({
        expenseId: row.id,
        participantId: participant.id,
      });
    }
  }

  if (noteBody && createdParticipants[0]) {
    await db.insert(notes).values({
      barbecueId: event.id,
      participantId: createdParticipants[0].id,
      title: "Plan notes",
      body: noteBody,
    });
  }

  for (const r of rsvps) {
    await db.insert(publicEventRsvps).values({
      barbecueId: event.id,
      tierId: r.tierId ?? null,
      name: r.name,
      email: r.email,
      status: r.status,
    });
  }

  return event;
}

async function main() {
  assertSafe();
  const seedUser = await ensureSeedUser();
  const hostName = seedUser.displayName || seedUser.username;
  const participantPool = ["Lina", "Marco", "Nora", "Alex", "Sophie", "Jay", "Mila", "Ruben", "Iris", "Noah", "Emma", "Finn"];

  const privateSeeds: SeedEventInput[] = PRIVATE_NAMES.map((name, idx) => {
    const city = CITIES[idx % CITIES.length]!;
    const t = PRIVATE_TEMPLATES[idx % PRIVATE_TEMPLATES.length]!;
    const members = [hostName, ...participantPool.slice(idx % 6, (idx % 6) + 6)].slice(0, 2 + (idx % 8));
    const uniqueMembers = Array.from(new Set(members));
    const expensesCount = idx % 4 === 0 ? 0 : 2 + (idx % 4);
    const expenseRows: SeedExpense[] = Array.from({ length: expensesCount }).map((_, eIdx) => ({
      participantName: uniqueMembers[eIdx % uniqueMembers.length]!,
      category: ["Food", "Drinks", "Transport", "Tickets", "Other"][eIdx % 5]!,
      item: ["Groceries", "Train", "Dinner", "Taxi", "Snacks", "Accommodation"][((idx * 3) + eIdx) % 6]!,
      amount: (10 + ((idx * 9 + eIdx * 7) % 140) + 0.95).toFixed(2),
      shareWith: uniqueMembers,
    }));

    return {
      name,
      date: getDate(-15 + idx * 2, 18 - (idx % 4)),
      currency: city[3],
      creatorId: seedUser.username,
      isPublic: false,
      visibility: "private",
      visibilityOrigin: "private",
      publicListingStatus: "inactive",
      area: t.area,
      eventType: t.eventType,
      allowOptInExpenses: idx % 5 === 0,
      locationName: idx % 7 === 0 ? null : `${city[0]}, ${city[2]}`,
      city: idx % 7 === 0 ? null : city[0],
      countryCode: idx % 7 === 0 ? null : city[1],
      countryName: idx % 7 === 0 ? null : city[2],
      currencySource: "manual",
      bannerImageUrl: idx % 3 === 0 ? PRIVATE_BANNERS[idx % PRIVATE_BANNERS.length] : null,
      status: "active",
      templateData: {
        __seedTag: SEED_TAG,
        __seedId: `private-${String(idx + 1).padStart(2, "0")}`,
        privateTemplateId: t.id,
        emoji: t.emoji,
      },
      participants: uniqueMembers.map((member, mIdx) => ({ name: member, userId: mIdx === 0 ? seedUser.username : null })),
      expenses: expenseRows,
      noteBody: idx % 3 === 0 ? `Group plan notes for ${name}.` : undefined,
      inviteToken: null,
    };
  });

  const publicSeeds: SeedEventInput[] = PUBLIC_NAMES.map((name, idx) => {
    const city = CITIES[(idx * 2) % CITIES.length]!;
    const listed = idx < 13;
    const paused = idx === 13;
    const mode = idx % 3 === 0 ? "marketing" : "joinable";
    const template = (["classic", "keynote", "workshop", "nightlife", "meetup"] as const)[idx % 5]!;
    const date = getDate(1 + idx * 2, 9 + (idx % 8));
    const slug = `${slugify(name)}-${city[0].toLowerCase()}-v2-${String(idx + 1).padStart(2, "0")}`;
    const tiers = idx % 2 === 0
      ? [
          { id: "general", name: "General Admission", description: "Core access", priceLabel: idx % 4 === 0 ? "Free" : `€${12 + idx}`, capacity: 50 + idx * 2, isFree: idx % 4 === 0 },
          { id: "vip", name: "VIP", description: "Priority entry", priceLabel: `€${32 + idx}`, capacity: 15, isFree: false },
        ]
      : [{ id: "general", name: "RSVP", description: "Reserve your seat", priceLabel: "Free", capacity: 80, isFree: true }];

    return {
      name,
      date,
      currency: city[3] === "JPY" ? "USD" : city[3],
      creatorId: seedUser.username,
      isPublic: listed && !paused,
      visibility: listed && !paused ? "public" : "private",
      visibilityOrigin: "public",
      publicMode: mode,
      publicTemplate: template,
      publicListingStatus: paused ? "paused" : listed ? "active" : "inactive",
      publicListingExpiresAt: listed ? getDate(40 + idx, 12) : null,
      publicListFromAt: listed ? getDate(-2, 8) : null,
      publicListUntilAt: listed ? getDate(70 + idx, 23) : null,
      publicSlug: slug,
      organizationName: `${city[0]} Collective`,
      publicDescription: `${name} in ${city[0]} for creators, professionals, and curious locals. Warm crowd, practical sessions, and good energy.`,
      bannerImageUrl: PUBLIC_BANNERS[idx % PUBLIC_BANNERS.length]!,
      locationName: idx % 6 === 0 ? null : `${city[0]}, ${city[2]}`,
      city: idx % 6 === 0 ? null : city[0],
      countryCode: idx % 6 === 0 ? null : city[1],
      countryName: idx % 6 === 0 ? null : city[2],
      status: "active",
      currencySource: "manual",
      templateData: {
        __seedTag: SEED_TAG,
        __seedId: `public-${String(idx + 1).padStart(2, "0")}`,
        publicRsvpTiers: tiers,
      },
      participants: [{ name: hostName, userId: seedUser.username }],
      rsvps: mode === "joinable"
        ? [
            { name: "Nina", email: `nina+v2-${idx}@example.test`, status: "requested", tierId: "general" },
            { name: "Tom", email: `tom+v2-${idx}@example.test`, status: listed ? "approved" : "requested", tierId: "general" },
          ]
        : [],
      inviteToken: null,
    };
  });

  const created: Array<{ id: number; kind: "private" | "public"; name: string; listed: boolean }> = [];
  const failed: Array<{ kind: "private" | "public"; name: string; reason: string }> = [];

  for (const seed of privateSeeds) {
    try {
      const event = await createEvent(seed);
      created.push({ id: event.id, kind: "private", name: event.name, listed: false });
      console.log(`[db:seed:dev] created [private] ${event.name} (#${event.id})`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      failed.push({ kind: "private", name: seed.name, reason });
      console.error(`[db:seed:dev] failed [private] ${seed.name}: ${reason}`);
    }
  }

  for (const seed of publicSeeds) {
    try {
      const event = await createEvent(seed);
      created.push({ id: event.id, kind: "public", name: event.name, listed: event.visibility === "public" });
      console.log(`[db:seed:dev] created [public] ${event.name} (#${event.id})`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      failed.push({ kind: "public", name: seed.name, reason });
      console.error(`[db:seed:dev] failed [public] ${seed.name}: ${reason}`);
    }
  }

  const privateCount = created.filter((c) => c.kind === "private").length;
  const publicCount = created.filter((c) => c.kind === "public").length;
  const listedCount = created.filter((c) => c.kind === "public" && c.listed).length;

  console.log(`[db:seed:dev] done. private=${privateCount}, public=${publicCount}, listed=${listedCount}, failed=${failed.length}`);
}

main()
  .catch((err) => {
    console.error("[db:seed:dev] failed:", err instanceof Error ? err.message : String(err));
    if (err instanceof Error && err.stack) console.error(err.stack);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end().catch(() => undefined);
  });
