#!/usr/bin/env npx tsx
import "dotenv/config";

import bcrypt from "bcryptjs";
import { eq, inArray } from "drizzle-orm";
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

const SEED_TAG = "nav-seed-v1";

type SeedArgs = {
  onlyPrivate: boolean;
  onlyPublic: boolean;
};

function parseArgs(argv: string[]): SeedArgs {
  const onlyPrivate = argv.includes("--only-seed-private");
  const onlyPublic = argv.includes("--only-seed-public");
  if (onlyPrivate && onlyPublic) {
    throw new Error("Use only one of --only-seed-private or --only-seed-public");
  }
  return { onlyPrivate, onlyPublic };
}

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
    .slice(0, 48);
}

async function ensureSeedUser() {
  const envEmail = process.env.SEED_USER_EMAIL?.trim();
  const envUsername = process.env.SEED_USERNAME?.trim();

  if (envUsername === "YOUR_USERNAME") {
    console.warn('[db:seed] Warning: SEED_USERNAME is literally "YOUR_USERNAME". Did you forget to replace the placeholder?');
  }

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
    bio: "Development seed user for navigation testing.",
    avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80",
    profileImageUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80",
  }).returning();
  return created;
}

async function deleteExistingSeedEvents(creatorUsername: string, scope: "all" | "private" | "public" = "all") {
  const rows = await db.select().from(barbecues).where(eq(barbecues.creatorId, creatorUsername));
  const seedIds = rows
    .filter((b) => {
      const t = b.templateData as Record<string, unknown> | null;
      if (!(t && t.__seedTag === SEED_TAG)) return false;
      if (scope === "private") return b.visibilityOrigin === "private";
      if (scope === "public") return b.visibilityOrigin === "public";
      return true;
    })
    .map((b) => b.id);
  if (seedIds.length === 0) return [];
  await db.delete(barbecues).where(inArray(barbecues.id, seedIds));
  return seedIds;
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

  const participantByName = new Map(createdParticipants.map((p) => [p.name, p]));

  for (const e of expenseSeeds) {
    const payer = participantByName.get(e.participantName);
    if (!payer) continue;
    const [expense] = await db.insert(expenses).values({
      barbecueId: event.id,
      participantId: payer.id,
      category: e.category,
      item: e.item,
      amount: e.amount,
    }).returning();

    for (const shareName of e.shareWith) {
      const shareParticipant = participantByName.get(shareName);
      if (!shareParticipant) continue;
      await db.insert(expenseShares).values({
        expenseId: expense.id,
        participantId: shareParticipant.id,
      });
    }
  }

  if (noteBody) {
    const author = createdParticipants[0];
    if (author) {
      await db.insert(notes).values({
        barbecueId: event.id,
        participantId: author.id,
        title: "Seed note",
        body: noteBody,
      });
    }
  }

  for (const rsvp of rsvps) {
    await db.insert(publicEventRsvps).values({
      barbecueId: event.id,
      tierId: rsvp.tierId ?? null,
      name: rsvp.name,
      email: rsvp.email,
      status: rsvp.status,
    });
  }

  return { event, participants: createdParticipants };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv !== "development") {
    console.warn(`[db:seed] NODE_ENV=${nodeEnv ?? "(unset)"} (continuing; seeding is allowed, but intended for dev)`);
  }

  const seedUser = await ensureSeedUser();
  console.log(`[db:seed] Using seed user: ${seedUser.username} (${seedUser.email})`);

  const scope: "all" | "private" | "public" = args.onlyPrivate ? "private" : args.onlyPublic ? "public" : "all";
  console.log(`[db:seed] Scope: ${scope}`);

  const deletedSeedIds = await deleteExistingSeedEvents(seedUser.username, scope);
  if (deletedSeedIds.length) {
    console.log(`[db:seed] Removed existing seed events: ${deletedSeedIds.join(", ")}`);
  }

  const created: Array<{ id: number; name: string; kind: "private" | "public"; listed: boolean }> = [];
  const skipped: Array<{ name: string; reason: string }> = [];
  const failed: Array<{ name: string; reason: string }> = [];

  const privateCommon = {
    creatorId: seedUser.username,
    isPublic: false,
    visibility: "private" as const,
    visibilityOrigin: "private" as const,
    publicListingStatus: "inactive" as const,
    status: "active" as const,
    currencySource: "manual" as const,
    templateData: { __seedTag: SEED_TAG },
    inviteToken: null,
  };

  const publicCommon = {
    creatorId: seedUser.username,
    isPublic: false,
    visibilityOrigin: "public" as const,
    status: "active" as const,
    publicMode: "joinable" as const,
    publicTemplate: "classic" as const,
    currencySource: "manual" as const,
    templateData: { __seedTag: SEED_TAG, publicRsvpTiers: [{ id: "general", name: "General Admission", description: "Open RSVP", priceLabel: "Free", capacity: 80, isFree: true }] },
    inviteToken: null,
  };

  const hostName = seedUser.displayName || seedUser.username;
  const participantPool = ["Lina", "Marco", "Nora", "Alex", "Sophie", "Jay", "Mila", "Ruben", "Iris", "Noah", "Emma", "Finn", "Sam", "Zoë", "Levi"];
  const cities = [
    ["Amsterdam", "NL", "Netherlands", "EUR"],
    ["Rotterdam", "NL", "Netherlands", "EUR"],
    ["Utrecht", "NL", "Netherlands", "EUR"],
    ["Barcelona", "ES", "Spain", "EUR"],
    ["Málaga", "ES", "Spain", "EUR"],
    ["Berlin", "DE", "Germany", "EUR"],
    ["London", "GB", "United Kingdom", "GBP"],
    ["Prague", "CZ", "Czech Republic", "CZK"],
    ["Copenhagen", "DK", "Denmark", "DKK"],
    ["Lisbon", "PT", "Portugal", "EUR"],
  ] as const;

  const privateNameTemplates = [
    { name: "BBQ Night", area: "parties", eventType: "barbecue", personality: "fun" },
    { name: "Birthday Dinner", area: "parties", eventType: "birthday", personality: "cozy" },
    { name: "Housemates Utilities", area: "parties", eventType: "other_party", personality: "cozy" },
    { name: "Game Night", area: "parties", eventType: "game_night", personality: "fun" },
    { name: "Movie Night", area: "parties", eventType: "movie_night", personality: "cozy" },
    { name: "Road Trip Crew", area: "trips", eventType: "road_trip", personality: "fun" },
    { name: "City Trip", area: "trips", eventType: "city_trip", personality: "fun" },
    { name: "Festival Planning", area: "trips", eventType: "festival_trip", personality: "chaotic" },
    { name: "Ski Weekend", area: "trips", eventType: "ski_trip", personality: "fun" },
    { name: "Camping Weekend", area: "trips", eventType: "camping", personality: "cozy" },
    { name: "Wedding Prep", area: "parties", eventType: "dinner_party", personality: "minimal" },
    { name: "House Dinner Club", area: "parties", eventType: "dinner_party", personality: "cozy" },
  ] as const;

  const privateSeeds: SeedEventInput[] = Array.from({ length: 30 }).map((_, idx) => {
    const tpl = privateNameTemplates[idx % privateNameTemplates.length];
    const loc = cities[idx % cities.length];
    const memberCount = 2 + (idx % 6); // 2..7
    const names = [hostName, ...participantPool.slice(idx % participantPool.length), ...participantPool].slice(0, memberCount);
    const uniqueNames = Array.from(new Set(names)).slice(0, memberCount);
    const expenseCount = idx % 4 === 0 ? 0 : 1 + (idx % 3);
    const eventName = `${tpl.name}${tpl.name === "City Trip" ? ` ${loc[0]}` : ""} ${String(idx + 1).padStart(2, "0")}`;
    const dateOffset = -20 + idx * 2;
    const expensesForEvent: SeedExpense[] = Array.from({ length: expenseCount }).map((__, expenseIdx) => {
      const payerName = uniqueNames[expenseIdx % uniqueNames.length]!;
      const categoryOptions = ["Food", "Drinks", "Transport", "Tickets", "Utilities", "Supplies"];
      const items = ["Groceries", "Train tickets", "Dinner bill", "Fuel", "Venue deposit", "Decorations"];
      const amount = (15 + ((idx * 7 + expenseIdx * 11) % 95) + 0.5).toFixed(2);
      return {
        participantName: payerName,
        category: categoryOptions[(idx + expenseIdx) % categoryOptions.length]!,
        item: items[(idx * 2 + expenseIdx) % items.length]!,
        amount,
        shareWith: uniqueNames,
      };
    });
    return {
      ...privateCommon,
      name: eventName,
      date: getDate(dateOffset, 18 - (idx % 3)),
      currency: loc[3],
      area: tpl.area,
      eventType: tpl.eventType,
      allowOptInExpenses: idx % 5 === 0,
      locationName: `${loc[0]}, ${loc[2]}`,
      city: loc[0],
      countryCode: loc[1],
      countryName: loc[2],
      templateData: { __seedTag: SEED_TAG, __seedId: `private-${String(idx + 1).padStart(2, "0")}`, personality: tpl.personality },
      participants: uniqueNames.map((name, nameIdx) => ({ name, userId: nameIdx === 0 ? seedUser.username : null })),
      expenses: expensesForEvent,
      noteBody: idx % 3 === 0 ? `Seed note for ${eventName}.` : undefined,
    };
  });

  const publicTitles = [
    "Yoga in the Park",
    "Indie Night Meetup",
    "Photography Walk",
    "Language Exchange Evening",
    "Tech Meetup",
    "Rooftop Concert",
    "Charity Run",
    "Art Market Sunday",
    "Startup Breakfast",
    "Design Crit Night",
    "Open Mic Social",
    "Community Workshop",
    "Book Club Live",
    "Wellness Morning",
    "Creative Coding Jam",
    "Film Club Screening",
    "Local Makers Fair",
    "Sunset Dance Session",
  ] as const;

  const bannerUrls = [
    "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80",
  ] as const;

  const publicSeeds: SeedEventInput[] = Array.from({ length: 18 }).map((_, idx) => {
    const title = publicTitles[idx % publicTitles.length]!;
    const loc = cities[(idx * 2) % cities.length]!;
    const isListed = idx < 12;
    const isPaused = idx === 13;
    const mode = idx % 3 === 0 ? "marketing" : "joinable";
    const template = (["classic", "keynote", "workshop", "nightlife", "meetup"] as const)[idx % 5]!;
    const slug = `${slugify(title)}-seed-${String(idx + 1).padStart(2, "0")}`;
    const baseDate = getDate(2 + idx * 3, 10 + (idx % 8));
    const listFrom = getDate(-2 + idx, 8);
    const listUntil = getDate(20 + idx * 2, 23);
    const tierBase = idx % 2 === 0
      ? [
          { id: "general", name: "General Admission", description: "Standard entry", priceLabel: idx % 4 === 0 ? "Free" : `€${8 + idx}`, capacity: 40 + idx * 2, isFree: idx % 4 === 0 },
          { id: "vip", name: "VIP", description: "Priority seating", priceLabel: `€${20 + idx}`, capacity: 10 + (idx % 5), isFree: false },
        ]
      : [{ id: "general", name: "RSVP", description: "Reserve your spot", priceLabel: "Free", capacity: 60 + idx, isFree: true }];

    const rsvpStatuses: SeedRsvp[] = mode === "joinable"
      ? [
          { name: "Nina", email: `nina+${idx}@example.test`, status: "requested", tierId: "general" },
          { name: "Tom", email: `tom+${idx}@example.test`, status: isListed ? "approved" : "requested", tierId: "general" },
          ...(tierBase.some((t) => t.id === "vip") ? [{ name: "Alex VIP", email: `vip+${idx}@example.test`, status: "going" as const, tierId: "vip" }] : []),
        ]
      : [];

    return {
      ...publicCommon,
      name: `${title} ${String(idx + 1).padStart(2, "0")}`,
      date: baseDate,
      currency: loc[3] === "CZK" || loc[3] === "DKK" ? "EUR" : loc[3],
      isPublic: isListed && !isPaused,
      area: "parties",
      eventType: "other_party",
      visibility: isListed && !isPaused ? "public" : "private",
      publicListingStatus: isPaused ? "paused" : (isListed ? "active" : "inactive"),
      publicMode: mode,
      publicTemplate: template,
      publicSlug: slug,
      publicListingExpiresAt: isListed ? getDate(35 + idx, 12) : null,
      publicListFromAt: isListed ? listFrom : null,
      publicListUntilAt: isListed ? listUntil : null,
      organizationName: `${loc[0]} Collective`,
      publicDescription: `${title} for the local community in ${loc[0]}. Hosted by ${loc[0]} Collective with a professional, welcoming format.`,
      bannerImageUrl: bannerUrls[idx % bannerUrls.length]!,
      locationName: `${loc[0]}, ${loc[2]}`,
      city: loc[0],
      countryCode: loc[1],
      countryName: loc[2],
      templateData: {
        __seedTag: SEED_TAG,
        __seedId: `public-${String(idx + 1).padStart(2, "0")}`,
        publicRsvpTiers: tierBase,
      },
      participants: [{ name: hostName, userId: seedUser.username }],
      rsvps: rsvpStatuses,
    };
  });

  const processSeed = async (seed: SeedEventInput, kind: "private" | "public") => {
    const label = `[${kind}] ${seed.name}`;
    try {
      const result = await createEvent(seed);
      created.push({ id: result.event.id, name: result.event.name, kind, listed: result.event.visibility === "public" });
      console.log(`[db:seed] created ${label} (#${result.event.id})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/duplicate key value|unique constraint/i.test(msg)) {
        skipped.push({ name: seed.name, reason: "unique_conflict" });
        console.warn(`[db:seed] skipped ${label} (unique conflict)`);
      } else {
        failed.push({ name: seed.name, reason: msg });
        console.error(`[db:seed] failed ${label}: ${msg}`);
      }
    }
  };

  if (!args.onlyPublic) {
    for (const seed of privateSeeds) {
      await processSeed(seed, "private");
    }
  }

  if (!args.onlyPrivate) {
    for (const seed of publicSeeds) {
      await processSeed(seed, "public");
    }
  }

  console.log(`[db:seed] Created ${created.length} events`);
  created.forEach((e) => {
    console.log(`  - [${e.kind}] #${e.id} ${e.name}${e.kind === "public" ? (e.listed ? " (listed)" : " (draft/unlisted)") : ""}`);
  });
  console.log(`[db:seed] Skipped: ${skipped.length}`);
  if (skipped.length > 0) skipped.forEach((s) => console.log(`  - ${s.name}: ${s.reason}`));
  console.log(`[db:seed] Failed: ${failed.length}`);
  if (failed.length > 0) failed.forEach((f) => console.log(`  - ${f.name}: ${f.reason}`));
  const privateCount = created.filter((e) => e.kind === "private").length;
  const publicCount = created.filter((e) => e.kind === "public").length;
  const listedCount = created.filter((e) => e.kind === "public" && e.listed).length;
  console.log(`[db:seed] Totals => private: ${privateCount}, public: ${publicCount} (${listedCount} listed, ${publicCount - listedCount} draft/unlisted/paused)`);
  console.log("[db:seed] Note: pinned events are stored in localStorage and cannot be seeded via DB.");
}

main()
  .catch((err) => {
    console.error("[db:seed] Error:", err instanceof Error ? err.message : String(err));
    if (err instanceof Error && err.stack) console.error(err.stack);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end().catch(() => undefined);
  });
