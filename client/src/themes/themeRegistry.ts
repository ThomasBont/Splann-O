/**
 * Interactive Themes Registry (Premium SaaS polish mode)
 * Single source of truth for event themes: accent, signature effects, empty states,
 * quick adds, expense placeholders, completion copy.
 */

export type ThemeKind = "party" | "trip";

export type SignatureType =
  | "glow"
  | "pulse"
  | "cinematic"
  | "shimmer"
  | "mapMotion"
  | "heatGlow"
  | "caustics"
  | "neonHalo"
  | "strobe";

export interface ThemeAccent {
  primary: string;
  secondary: string;
  surface: string;
  border: string;
}

export interface ThemeSignature {
  type: SignatureType;
  intensity: number;
}

export interface ThemeEmptyState {
  titleKey: string;
  subtitleKey: string;
  emojiOrIcon: string;
  ctaKey: string;
}

export interface QuickAddEntry {
  labelKey: string;
  category: string;
  optInDefault?: boolean;
  icon?: string;
}

export interface ExpenseTemplateEntry {
  category: string;
  placeholderKey: string;
  suggestions?: string[];
}

export interface ThemeCompletion {
  titleKey: string;
  subtitleKey: string;
  effect: "confetti" | "sparkle" | "badge";
}

export interface ThemeConfig {
  id: string;
  labelKey: string;
  kind: ThemeKind;
  accent: ThemeAccent;
  icon: string;
  signature: ThemeSignature;
  emptyState: ThemeEmptyState;
  quickAdds: QuickAddEntry[];
  expenseTemplates: ExpenseTemplateEntry[];
  completion: ThemeCompletion;
}

export type PartyThemeId =
  | "barbecue"
  | "birthday"
  | "dinner_party"
  | "house_party"
  | "game_night"
  | "pool_party"
  | "after_party"
  | "movie_night"
  | "other_party";

export type TripThemeId =
  | "city_trip"
  | "weekend_getaway"
  | "festival_trip"
  | "road_trip"
  | "ski_trip"
  | "beach_trip"
  | "camping"
  | "business_trip"
  | "other_trip";

export type ThemeId = PartyThemeId | TripThemeId;

const LEGACY_TRIP_MAP: Record<string, TripThemeId> = {
  vacation: "beach_trip",
  backpacking: "camping",
  bachelor_trip: "other_trip",
  workation: "business_trip",
  hiking_trip: "camping",
};

const LEGACY_PARTY_MAP: Record<string, PartyThemeId> = {
  default: "other_party",
};

const TRIP_IDS = new Set<TripThemeId>([
  "city_trip",
  "weekend_getaway",
  "festival_trip",
  "road_trip",
  "ski_trip",
  "beach_trip",
  "camping",
  "business_trip",
  "other_trip",
]);

const PARTY_IDS = new Set<PartyThemeId>([
  "barbecue",
  "birthday",
  "dinner_party",
  "house_party",
  "game_night",
  "pool_party",
  "after_party",
  "movie_night",
  "other_party",
]);

function resolveThemeId(kind: ThemeKind, type: string | null | undefined): ThemeId {
  const key = (type || "").trim();
  if (kind === "trip") {
    return (LEGACY_TRIP_MAP[key] ?? (TRIP_IDS.has(key as TripThemeId) ? key : "other_trip")) as TripThemeId;
  }
  if (kind === "party") {
    return (LEGACY_PARTY_MAP[key] ?? (PARTY_IDS.has(key as PartyThemeId) ? key : "other_party")) as PartyThemeId;
  }
  return "other_party";
}

const TRIP_THEMES: Record<TripThemeId, ThemeConfig> = {
  city_trip: {
    id: "city_trip",
    labelKey: "cityTrip",
    kind: "trip",
    accent: { primary: "217 76% 59%", secondary: "243 75% 59%", surface: "217 30% 96%", border: "217 40% 88%" },
    icon: "🗺️",
    signature: { type: "mapMotion", intensity: 0.4 },
    emptyState: {
      titleKey: "emptyNoExpenses",
      subtitleKey: "emptyCityTrip",
      emojiOrIcon: "🗺️",
      ctaKey: "ctaAddTransportAccommodation",
    },
    quickAdds: [
      { labelKey: "quickTransport", category: "Transport", optInDefault: false, icon: "🚇" },
      { labelKey: "quickPublicTransit", category: "Transport", optInDefault: false, icon: "🚌" },
      { labelKey: "quickAccommodation", category: "Accommodation", optInDefault: false, icon: "🏨" },
      { labelKey: "quickMuseums", category: "Tickets", optInDefault: true, icon: "🎨" },
      { labelKey: "quickFood", category: "Food", optInDefault: false, icon: "🍴" },
      { labelKey: "quickDrinks", category: "Drinks", optInDefault: true, icon: "🍷" },
    ],
    expenseTemplates: [
      { category: "Transport", placeholderKey: "transportCity", suggestions: ["Uber", "Metro tickets"] },
      { category: "Accommodation", placeholderKey: "accommodationCity", suggestions: ["Airbnb", "Hotel night"] },
      { category: "Tickets", placeholderKey: "ticketsCity", suggestions: ["Museum entry", "Attraction pass"] },
      { category: "Food", placeholderKey: "foodCity", suggestions: ["Tapas night", "Restaurant"] },
      { category: "Drinks", placeholderKey: "drinksCity", suggestions: ["Wine bar", "Cocktails"] },
    ],
    completion: { titleKey: "completionAllSettled", subtitleKey: "completionFriendshipPreserved", effect: "confetti" },
  },
  weekend_getaway: {
    id: "weekend_getaway",
    labelKey: "weekendGetaway",
    kind: "trip",
    accent: { primary: "38 92% 50%", secondary: "24 95% 53%", surface: "38 30% 96%", border: "38 40% 88%" },
    icon: "🌅",
    signature: { type: "glow", intensity: 0.3 },
    emptyState: {
      titleKey: "emptyNoExpenses",
      subtitleKey: "emptyWeekendGetaway",
      emojiOrIcon: "🌅",
      ctaKey: "ctaAddFirstExpense",
    },
    quickAdds: [
      { labelKey: "quickAccommodation", category: "Accommodation", optInDefault: false, icon: "🏨" },
      { labelKey: "quickFood", category: "Food", optInDefault: false, icon: "🍽️" },
      { labelKey: "quickTransport", category: "Transport", optInDefault: false, icon: "🚗" },
      { labelKey: "quickActivities", category: "Tickets", optInDefault: true, icon: "🎯" },
      { labelKey: "quickDrinks", category: "Drinks", optInDefault: true, icon: "🍷" },
    ],
    expenseTemplates: [
      { category: "Accommodation", placeholderKey: "accommodation", suggestions: ["Airbnb", "Hotel"] },
      { category: "Food", placeholderKey: "food", suggestions: ["Dinner", "Groceries"] },
      { category: "Transport", placeholderKey: "transport", suggestions: ["Car", "Train"] },
    ],
    completion: { titleKey: "completionAllSettled", subtitleKey: "completionFriendshipPreserved", effect: "confetti" },
  },
  festival_trip: {
    id: "festival_trip",
    labelKey: "festivalTrip",
    kind: "trip",
    accent: { primary: "270 91% 65%", secondary: "292 84% 61%", surface: "270 30% 96%", border: "270 40% 88%" },
    icon: "🎪",
    signature: { type: "neonHalo", intensity: 0.5 },
    emptyState: {
      titleKey: "emptyNoExpenses",
      subtitleKey: "emptyFestivalTrip",
      emojiOrIcon: "🎪",
      ctaKey: "ctaAddTicketsDrinks",
    },
    quickAdds: [
      { labelKey: "quickTickets", category: "Tickets", optInDefault: false, icon: "🎫" },
      { labelKey: "quickAccommodation", category: "Accommodation", optInDefault: false, icon: "⛺" },
      { labelKey: "quickDrinks", category: "Drinks", optInDefault: true, icon: "🍺" },
      { labelKey: "quickTransport", category: "Transport", optInDefault: false, icon: "🚗" },
      { labelKey: "quickMerch", category: "Other", optInDefault: true, icon: "👕" },
      { labelKey: "quickFood", category: "Food", optInDefault: false, icon: "🍔" },
    ],
    expenseTemplates: [
      { category: "Tickets", placeholderKey: "ticketsFestival", suggestions: ["Festival pass", "Day ticket"] },
      { category: "Drinks", placeholderKey: "drinks", suggestions: ["Beer tokens", "Cocktails"] },
    ],
    completion: { titleKey: "completionAllSettled", subtitleKey: "completionFriendshipPreserved", effect: "sparkle" },
  },
  road_trip: {
    id: "road_trip",
    labelKey: "roadTrip",
    kind: "trip",
    accent: { primary: "24 95% 53%", secondary: "38 92% 50%", surface: "24 30% 96%", border: "24 40% 88%" },
    icon: "🚗",
    signature: { type: "glow", intensity: 0.35 },
    emptyState: {
      titleKey: "emptyNoExpenses",
      subtitleKey: "emptyRoadTrip",
      emojiOrIcon: "🚗",
      ctaKey: "ctaAddFuelTolls",
    },
    quickAdds: [
      { labelKey: "quickFuel", category: "Transport", optInDefault: false, icon: "⛽" },
      { labelKey: "quickTollParking", category: "Transport", optInDefault: false, icon: "🅿️" },
      { labelKey: "quickCarRental", category: "Transport", optInDefault: false, icon: "🚗" },
      { labelKey: "quickAccommodation", category: "Accommodation", optInDefault: false, icon: "🏨" },
      { labelKey: "quickFood", category: "Food", optInDefault: false, icon: "🍔" },
      { labelKey: "quickActivities", category: "Tickets", optInDefault: true, icon: "🎯" },
    ],
    expenseTemplates: [
      { category: "Transport", placeholderKey: "transportRoad", suggestions: ["Fuel", "Toll", "Parking"] },
    ],
    completion: { titleKey: "completionAllSettled", subtitleKey: "completionFriendshipPreserved", effect: "confetti" },
  },
  ski_trip: {
    id: "ski_trip",
    labelKey: "skiTrip",
    kind: "trip",
    accent: { primary: "199 89% 48%", secondary: "217 91% 60%", surface: "199 30% 96%", border: "199 40% 88%" },
    icon: "⛷️",
    signature: { type: "shimmer", intensity: 0.3 },
    emptyState: {
      titleKey: "emptyNoExpenses",
      subtitleKey: "emptySkiTrip",
      emojiOrIcon: "⛷️",
      ctaKey: "ctaAddLiftAccommodation",
    },
    quickAdds: [
      { labelKey: "quickLiftPass", category: "Tickets", optInDefault: false, icon: "🎿" },
      { labelKey: "quickRentalGear", category: "Other", optInDefault: true, icon: "⛷️" },
      { labelKey: "quickAccommodation", category: "Accommodation", optInDefault: false, icon: "🏔️" },
      { labelKey: "quickTransport", category: "Transport", optInDefault: false, icon: "🚗" },
      { labelKey: "quickLessons", category: "Tickets", optInDefault: true, icon: "📚" },
      { labelKey: "quickFood", category: "Food", optInDefault: false, icon: "🍲" },
    ],
    expenseTemplates: [],
    completion: { titleKey: "completionAllSettled", subtitleKey: "completionFriendshipPreserved", effect: "confetti" },
  },
  beach_trip: {
    id: "beach_trip",
    labelKey: "beachTrip",
    kind: "trip",
    accent: { primary: "187 78% 43%", secondary: "174 72% 45%", surface: "187 30% 96%", border: "187 40% 88%" },
    icon: "🏖️",
    signature: { type: "shimmer", intensity: 0.4 },
    emptyState: {
      titleKey: "emptyNoExpenses",
      subtitleKey: "emptyBeachTrip",
      emojiOrIcon: "🏖️",
      ctaKey: "ctaAddAccommodationFood",
    },
    quickAdds: [
      { labelKey: "quickAccommodation", category: "Accommodation", optInDefault: false, icon: "🏖️" },
      { labelKey: "quickTransport", category: "Transport", optInDefault: false, icon: "✈️" },
      { labelKey: "quickSunscreen", category: "Other", optInDefault: true, icon: "🧴" },
      { labelKey: "quickDrinks", category: "Drinks", optInDefault: true, icon: "🥤" },
      { labelKey: "quickFood", category: "Food", optInDefault: false, icon: "🍽️" },
      { labelKey: "quickActivities", category: "Tickets", optInDefault: true, icon: "🏊" },
    ],
    expenseTemplates: [],
    completion: { titleKey: "completionAllSettled", subtitleKey: "completionFriendshipPreserved", effect: "confetti" },
  },
  camping: {
    id: "camping",
    labelKey: "camping",
    kind: "trip",
    accent: { primary: "84 81% 44%", secondary: "142 71% 45%", surface: "84 30% 96%", border: "84 40% 88%" },
    icon: "⛺",
    signature: { type: "glow", intensity: 0.25 },
    emptyState: {
      titleKey: "emptyNoExpenses",
      subtitleKey: "emptyCamping",
      emojiOrIcon: "⛺",
      ctaKey: "ctaAddFirstExpense",
    },
    quickAdds: [
      { labelKey: "quickCampingSpot", category: "Accommodation", optInDefault: false, icon: "⛺" },
      { labelKey: "quickFood", category: "Food", optInDefault: false, icon: "🍳" },
      { labelKey: "quickFirewood", category: "Other", optInDefault: false, icon: "🔥" },
      { labelKey: "quickGear", category: "Other", optInDefault: true, icon: "🎒" },
      { labelKey: "quickTransport", category: "Transport", optInDefault: false, icon: "🚗" },
    ],
    expenseTemplates: [],
    completion: { titleKey: "completionAllSettled", subtitleKey: "completionFriendshipPreserved", effect: "confetti" },
  },
  business_trip: {
    id: "business_trip",
    labelKey: "businessTrip",
    kind: "trip",
    accent: { primary: "215 16% 47%", secondary: "215 14% 55%", surface: "215 20% 96%", border: "215 25% 88%" },
    icon: "💼",
    signature: { type: "glow", intensity: 0.2 },
    emptyState: {
      titleKey: "emptyNoExpenses",
      subtitleKey: "emptyBusinessTrip",
      emojiOrIcon: "💼",
      ctaKey: "ctaAddFlightsAccommodation",
    },
    quickAdds: [
      { labelKey: "quickAccommodation", category: "Accommodation", optInDefault: false, icon: "🏨" },
      { labelKey: "quickFlights", category: "Transport", optInDefault: false, icon: "✈️" },
      { labelKey: "quickMeals", category: "Food", optInDefault: false, icon: "🍽️" },
      { labelKey: "quickTransport", category: "Transport", optInDefault: false, icon: "🚗" },
    ],
    expenseTemplates: [],
    completion: { titleKey: "completionAllSettled", subtitleKey: "completionFriendshipPreserved", effect: "badge" },
  },
  other_trip: {
    id: "other_trip",
    labelKey: "otherTrip",
    kind: "trip",
    accent: { primary: "43 96% 56%", secondary: "43 96% 48%", surface: "43 20% 96%", border: "43 30% 88%" },
    icon: "✈️",
    signature: { type: "glow", intensity: 0.2 },
    emptyState: {
      titleKey: "emptyNoExpenses",
      subtitleKey: "emptyGeneric",
      emojiOrIcon: "✈️",
      ctaKey: "ctaAddFirstExpense",
    },
    quickAdds: [
      { labelKey: "quickAccommodation", category: "Accommodation", optInDefault: false, icon: "🏨" },
      { labelKey: "quickFood", category: "Food", optInDefault: false, icon: "🍽️" },
      { labelKey: "quickTransport", category: "Transport", optInDefault: false, icon: "🚗" },
      { labelKey: "quickTickets", category: "Tickets", optInDefault: true, icon: "🎫" },
      { labelKey: "quickOther", category: "Other", optInDefault: false, icon: "📦" },
    ],
    expenseTemplates: [],
    completion: { titleKey: "completionAllSettled", subtitleKey: "completionFriendshipPreserved", effect: "confetti" },
  },
};

const PARTY_THEMES: Record<PartyThemeId, ThemeConfig> = {
  barbecue: {
    id: "barbecue",
    labelKey: "barbecue",
    kind: "party",
    accent: { primary: "24 95% 53%", secondary: "38 92% 50%", surface: "24 30% 96%", border: "24 40% 88%" },
    icon: "🔥",
    signature: { type: "heatGlow", intensity: 0.5 },
    emptyState: {
      titleKey: "emptyNoExpenses",
      subtitleKey: "emptyBarbecue",
      emojiOrIcon: "🔥",
      ctaKey: "ctaAddFirstGrillCost",
    },
    quickAdds: [
      { labelKey: "quickMeat", category: "Meat", optInDefault: true, icon: "🥩" },
      { labelKey: "quickDrinks", category: "Drinks", optInDefault: true, icon: "🍺" },
      { labelKey: "quickCharcoal", category: "Charcoal", optInDefault: false, icon: "🔥" },
      { labelKey: "quickSides", category: "Food", optInDefault: false, icon: "🥗" },
      { labelKey: "quickSauces", category: "Other", optInDefault: false, icon: "🧴" },
      { labelKey: "quickDisposablePlates", category: "Other", optInDefault: false, icon: "🍽️" },
    ],
    expenseTemplates: [
      { category: "Meat", placeholderKey: "meat", suggestions: ["Ribeye steaks", "Chorizo", "Sausages"] },
      { category: "Drinks", placeholderKey: "drinks", suggestions: ["Beer & wine", "Soft drinks"] },
    ],
    completion: { titleKey: "completionAllSettled", subtitleKey: "completionFriendshipPreserved", effect: "confetti" },
  },
  birthday: {
    id: "birthday",
    labelKey: "birthday",
    kind: "party",
    accent: { primary: "330 81% 60%", secondary: "350 83% 66%", surface: "330 30% 96%", border: "330 40% 88%" },
    icon: "🎂",
    signature: { type: "glow", intensity: 0.4 },
    emptyState: {
      titleKey: "emptyNoExpenses",
      subtitleKey: "emptyBirthday",
      emojiOrIcon: "🎂",
      ctaKey: "ctaAddCakeDecor",
    },
    quickAdds: [
      { labelKey: "quickCake", category: "Food", optInDefault: false, icon: "🎂" },
      { labelKey: "quickDecor", category: "Other", optInDefault: false, icon: "🎈" },
      { labelKey: "quickDrinks", category: "Drinks", optInDefault: true, icon: "🥤" },
      { labelKey: "quickGift", category: "Other", optInDefault: true, icon: "🎁" },
      { labelKey: "quickVenue", category: "Tickets", optInDefault: false, icon: "🏠" },
    ],
    expenseTemplates: [],
    completion: { titleKey: "completionAllSettled", subtitleKey: "completionFriendshipPreserved", effect: "confetti" },
  },
  dinner_party: {
    id: "dinner_party",
    labelKey: "dinnerParty",
    kind: "party",
    accent: { primary: "38 92% 50%", secondary: "48 96% 53%", surface: "38 30% 96%", border: "38 40% 88%" },
    icon: "🍽️",
    signature: { type: "glow", intensity: 0.3 },
    emptyState: {
      titleKey: "emptyNoExpenses",
      subtitleKey: "emptyDinnerParty",
      emojiOrIcon: "🍽️",
      ctaKey: "ctaAddGroceriesWine",
    },
    quickAdds: [
      { labelKey: "quickIngredients", category: "Food", optInDefault: false, icon: "🥕" },
      { labelKey: "quickWine", category: "Drinks", optInDefault: true, icon: "🍷" },
      { labelKey: "quickDessert", category: "Food", optInDefault: false, icon: "🍰" },
    ],
    expenseTemplates: [
      { category: "Food", placeholderKey: "foodDinner", suggestions: ["Tapas night", "Ribeye steaks"] },
      { category: "Drinks", placeholderKey: "drinks", suggestions: ["Beer & wine", "Cocktails"] },
    ],
    completion: { titleKey: "completionAllSettled", subtitleKey: "completionFriendshipPreserved", effect: "confetti" },
  },
  house_party: {
    id: "house_party",
    labelKey: "houseParty",
    kind: "party",
    accent: { primary: "258 90% 66%", secondary: "271 91% 65%", surface: "258 30% 96%", border: "258 40% 88%" },
    icon: "🏠",
    signature: { type: "glow", intensity: 0.35 },
    emptyState: {
      titleKey: "emptyNoExpenses",
      subtitleKey: "emptyHouseParty",
      emojiOrIcon: "🏠",
      ctaKey: "ctaAddDrinksSnacks",
    },
    quickAdds: [
      { labelKey: "quickDrinks", category: "Drinks", optInDefault: true, icon: "🍺" },
      { labelKey: "quickSnacks", category: "Food", optInDefault: false, icon: "🥜" },
      { labelKey: "quickCleaningSupplies", category: "Other", optInDefault: false, icon: "🧹" },
      { labelKey: "quickDecorations", category: "Other", optInDefault: false, icon: "🎉" },
    ],
    expenseTemplates: [],
    completion: { titleKey: "completionAllSettled", subtitleKey: "completionFriendshipPreserved", effect: "confetti" },
  },
  game_night: {
    id: "game_night",
    labelKey: "gameNight",
    kind: "party",
    accent: { primary: "142 71% 45%", secondary: "160 84% 39%", surface: "142 30% 96%", border: "142 40% 88%" },
    icon: "🎮",
    signature: { type: "pulse", intensity: 0.3 },
    emptyState: {
      titleKey: "emptyNoExpenses",
      subtitleKey: "emptyGameNight",
      emojiOrIcon: "🎮",
      ctaKey: "ctaAddSnacksGames",
    },
    quickAdds: [
      { labelKey: "quickSnacks", category: "Food", optInDefault: false, icon: "🍿" },
      { labelKey: "quickDrinks", category: "Drinks", optInDefault: true, icon: "🥤" },
      { labelKey: "quickNewGame", category: "Other", optInDefault: true, icon: "🎮" },
      { labelKey: "quickDeliveryFood", category: "Food", optInDefault: false, icon: "🍕" },
    ],
    expenseTemplates: [],
    completion: { titleKey: "completionAllSettled", subtitleKey: "completionFriendshipPreserved", effect: "confetti" },
  },
  pool_party: {
    id: "pool_party",
    labelKey: "poolParty",
    kind: "party",
    accent: { primary: "187 78% 43%", secondary: "174 72% 45%", surface: "187 30% 96%", border: "187 40% 88%" },
    icon: "🏊",
    signature: { type: "caustics", intensity: 0.45 },
    emptyState: {
      titleKey: "emptyNoExpenses",
      subtitleKey: "emptyPoolParty",
      emojiOrIcon: "🏊",
      ctaKey: "ctaAddDrinksSnacks",
    },
    quickAdds: [
      { labelKey: "quickDrinks", category: "Drinks", optInDefault: true, icon: "🥤" },
      { labelKey: "quickSnacks", category: "Food", optInDefault: false, icon: "🍟" },
      { labelKey: "quickIce", category: "Other", optInDefault: false, icon: "🧊" },
      { labelKey: "quickDecorations", category: "Other", optInDefault: false, icon: "🎈" },
      { labelKey: "quickSunscreen", category: "Other", optInDefault: true, icon: "🧴" },
    ],
    expenseTemplates: [],
    completion: { titleKey: "completionAllSettled", subtitleKey: "completionFriendshipPreserved", effect: "confetti" },
  },
  after_party: {
    id: "after_party",
    labelKey: "afterParty",
    kind: "party",
    accent: { primary: "292 84% 61%", secondary: "330 81% 60%", surface: "292 30% 96%", border: "292 40% 88%" },
    icon: "🎵",
    signature: { type: "strobe", intensity: 0.25 },
    emptyState: {
      titleKey: "emptyNoExpenses",
      subtitleKey: "emptyAfterParty",
      emojiOrIcon: "🎵",
      ctaKey: "ctaAddTaxiDrinks",
    },
    quickAdds: [
      { labelKey: "quickDrinks", category: "Drinks", optInDefault: true, icon: "🍺" },
      { labelKey: "quickTaxi", category: "Transport", optInDefault: true, icon: "🚕" },
      { labelKey: "quickSnacks", category: "Food", optInDefault: false, icon: "🍟" },
    ],
    expenseTemplates: [],
    completion: { titleKey: "completionAllSettled", subtitleKey: "completionFriendshipPreserved", effect: "confetti" },
  },
  movie_night: {
    id: "movie_night",
    labelKey: "movieNight",
    kind: "party",
    accent: { primary: "239 84% 67%", secondary: "217 91% 60%", surface: "239 30% 96%", border: "239 40% 88%" },
    icon: "🎬",
    signature: { type: "cinematic", intensity: 0.4 },
    emptyState: {
      titleKey: "emptyNoExpenses",
      subtitleKey: "emptyMovieNight",
      emojiOrIcon: "🎬",
      ctaKey: "ctaAddSnacksStreaming",
    },
    quickAdds: [
      { labelKey: "quickSnacks", category: "Food", optInDefault: false, icon: "🍿" },
      { labelKey: "quickStreamingRental", category: "Tickets", optInDefault: false, icon: "🎬" },
      { labelKey: "quickDrinks", category: "Drinks", optInDefault: true, icon: "🥤" },
      { labelKey: "quickPizza", category: "Food", optInDefault: false, icon: "🍕" },
      { labelKey: "quickDecor", category: "Other", optInDefault: false, icon: "✨" },
    ],
    expenseTemplates: [
      { category: "Food", placeholderKey: "foodMovie", suggestions: ["Popcorn", "Snacks"] },
      { category: "Tickets", placeholderKey: "streaming", suggestions: ["Netflix rental", "Movie ticket"] },
      { category: "Other", placeholderKey: "decor", suggestions: ["Balloons", "Candles"] },
    ],
    completion: { titleKey: "completionAllSettled", subtitleKey: "completionFriendshipPreserved", effect: "confetti" },
  },
  other_party: {
    id: "other_party",
    labelKey: "otherParty",
    kind: "party",
    accent: { primary: "43 96% 56%", secondary: "43 96% 48%", surface: "43 20% 96%", border: "43 30% 88%" },
    icon: "🎉",
    signature: { type: "glow", intensity: 0.2 },
    emptyState: {
      titleKey: "emptyNoExpenses",
      subtitleKey: "emptyGeneric",
      emojiOrIcon: "🎉",
      ctaKey: "ctaAddFirstExpense",
    },
    quickAdds: [
      { labelKey: "quickDrinks", category: "Drinks", optInDefault: true, icon: "🍺" },
      { labelKey: "quickSnacks", category: "Food", optInDefault: false, icon: "🥜" },
      { labelKey: "quickDecorations", category: "Other", optInDefault: false, icon: "🎉" },
      { labelKey: "quickTransport", category: "Transport", optInDefault: true, icon: "🚗" },
    ],
    expenseTemplates: [],
    completion: { titleKey: "completionAllSettled", subtitleKey: "completionFriendshipPreserved", effect: "confetti" },
  },
};

const ALL_THEMES: Record<ThemeId, ThemeConfig> = { ...TRIP_THEMES, ...PARTY_THEMES };

export function getThemeConfig(kind: ThemeKind, type: string | null | undefined): ThemeConfig {
  const id = resolveThemeId(kind, type);
  return ALL_THEMES[id] ?? ALL_THEMES.other_party;
}

export function getThemeConfigById(id: ThemeId): ThemeConfig {
  return ALL_THEMES[id] ?? ALL_THEMES.other_party;
}

const CATEGORY_ALIASES: Record<string, string> = {
  Transportation: "Transport",
};

/**
 * Get expense placeholder key for category + theme. Falls back to generic category placeholder.
 */
export function getExpensePlaceholderKey(category: string, themeId: ThemeId): string {
  const config = ALL_THEMES[themeId] ?? ALL_THEMES.other_party;
  const norm = CATEGORY_ALIASES[category] ?? category;
  const entry = config.expenseTemplates.find((e) => e.category === norm || e.category === category);
  if (entry) return entry.placeholderKey;
  return norm.toLowerCase();
}

/**
 * Convert theme registry quickAdds to ExpenseTemplateItem format (for backward compat with QuickAddChips).
 * Uses raw labels from i18n; caller must pass t() for resolution.
 */
export function getQuickAddsFromRegistry(
  kind: ThemeKind,
  type: string | null | undefined,
  resolveLabel: (key: string) => string
): { label: string; category: string; optInDefault: boolean; icon?: string }[] {
  const config = getThemeConfig(kind, type);
  return config.quickAdds.map((q) => ({
    label: resolveLabel(q.labelKey),
    category: q.category,
    optInDefault: q.optInDefault ?? false,
    icon: q.icon,
  }));
}
