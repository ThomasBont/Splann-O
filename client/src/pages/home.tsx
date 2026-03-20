import { lazy, Suspense, useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, type TouchEvent as ReactTouchEvent } from "react";
import { Link, useLocation } from "wouter";
import { normalizeCountryCode } from "@shared/lib/country-code";
import { useLanguage, getCurrency, type CurrencyCode, convertCurrency, type Language } from "@/hooks/use-language";
import { useAuth } from "@/hooks/use-auth";
import { useUserProfile } from "@/hooks/use-user-profile";
import {
  useCreateParticipant, useDeleteParticipant, useUpdateParticipantName,
  usePendingRequests, useMemberships, useJoinBarbecue,
  useAcceptParticipant, useRejectParticipant,
  useInvitedParticipants, useInviteParticipant,
  useAcceptInvite, useDeclineInvite,
} from "@/hooks/use-participants";
import { useDeleteExpense, useExpenseShares, useRealtimePlanBalances, useSetExpenseShare } from "@/hooks/use-expenses";
import { useIsMobile } from "@/hooks/use-mobile";
import { useBarbecues, useCreateBarbecue, useDeleteBarbecue, useUpdateBarbecue, useEnsureInviteToken, useSettleUp, useCheckoutPublicListing, useConfirmCheckoutSession, useDeactivateListing, useExploreEvents, usePublicEventRsvpRequests, useUpdatePublicEventRsvpRequest, useConversations, useConversation, useSendConversationMessage, useUpdateConversationStatus, useUploadEventBanner, useDeleteEventBanner, useNotifications, useAcceptPlanInvite, useDeclinePlanInvite, useAcceptFriendRequestNotification, useDeclineFriendRequestNotification, useLeaveBarbecue, type BarbecueListItem, type ExploreEvent } from "@/hooks/use-bbq-data";
import { useQueryClient } from "@tanstack/react-query";
import { useFriends, useFriendRequests, useAllPendingRequests, useAcceptFriendRequest, useRemoveFriend, useSearchUsers, useSendFriendRequest } from "@/hooks/use-friends";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EventTabsContent } from "@/components/event/EventTabs";
import { EventPageTabsRouter } from "@/components/event/pages/EventPageTabsRouter";
import { Modal } from "@/components/ui/modal";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AddPersonDialog } from "@/components/add-person-dialog";
import { AddExpenseDialog } from "@/components/add-expense-dialog";
import { CurrencyPicker } from "@/components/currency-picker";
import { type LocationOption, currencyForCountry } from "@/lib/locations-data";
import { EventHeader } from "@/components/event/EventHeader";
import { ChatSidebar } from "@/components/event/ChatSidebar";
import GuestsWidget from "@/components/event/GuestsWidget";
import SharedCostsWidget from "@/components/event/SharedCostsWidget";
import AccountSettingsContent from "@/components/account/AccountSettingsContent";
import { PrivateEventHero } from "@/components/event/PrivateEventHero";
import EventSettingsModal from "@/components/event/EventSettingsModal";
import { EditTripLocationModal } from "@/components/event/EditTripLocationModal";
import { SettleUpModal } from "@/components/event/SettleUpModal";
import { QuickAddChips } from "@/components/event/QuickAddChips";
import { EmptyState } from "@/components/event/EmptyState";
import { InviteSheet } from "@/components/event/InviteSheet";
import { InviteLink } from "@/components/events/invite-link";
import { ShareRecapWithMenu } from "@/components/share/ShareRecapWithMenu";
import { IndividualContributions } from "@/components/split/IndividualContributions";
import { SettlementPlan } from "@/components/split/SettlementPlan";
import { ConfettiCelebration } from "@/components/basic/ConfettiCelebration";
import { generateSettleCardData, generateRecapCardData } from "@/utils/shareCard";
import { DiscoverModal } from "@/components/discover-modal";
import { SplannoLogo } from "@/components/splanno-logo";
import { resolveAssetUrl, withCacheBust } from "@/lib/asset-url";
import { queryKeys } from "@/lib/query-keys";
import { getPlanIcons } from "@/lib/planIcons";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import {
  Receipt, Trash2, Edit2,
  Plus, CheckCircle2,
  CalendarDays, Loader2,
  ArrowLeft,
  UserCheck, UserX, LogOut, Crown, Clock, UserCircle, ChevronDown, ChevronRight, Users,
  Lock, Globe, UserPlus, X, Eye, EyeOff, Compass,
  Bell, UserPlus2, Search, Heart, MessageCircle, Star, Plane, PartyPopper, Settings, LayoutGrid,
  ImageIcon,
  type LucideIcon,
} from "lucide-react";
import { useEventHeaderPreferences } from "@/hooks/use-event-header-preferences";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useAppToast } from "@/hooks/use-app-toast";
import { useUpgrade } from "@/contexts/UpgradeContext";
import { useNewPlanWizard } from "@/contexts/new-plan-wizard";
import { UpgradeRequiredError } from "@/lib/upgrade";
import { usePlan, usePlanCrew, usePlanExpenses } from "@/hooks/use-plan-data";
import {
  getEventTemplate,
  getTemplateData,
  EventTemplateWrapper,
  getTripTemplate,
  getPartyTemplate,
  isTripEventType,
  isPartyEventType,
  defaultBarbecueTemplateData,
  defaultBirthdayTemplateData,
  type BarbecueTemplateData,
  getExpenseTemplates,
  getExpenseTemplateHelper,
} from "@/eventTemplates";
import { getCategoriesForEvent, getCategoryDef } from "@/config/expenseCategories";
import { getEventActivity } from "@/utils/eventActivity";
import { EventActivityFeed } from "@/components/event/EventActivityFeed";
import { NotesTab } from "@/components/event/NotesTab";
import { ExpenseReactionBar } from "@/components/event/ExpenseReactionBar";
import { AnimatedBalance } from "@/components/event/AnimatedBalance";
import ContextPanelHost from "@/components/panels/ContextPanelHost";
import { useExpenseReactions } from "@/hooks/use-expense-reactions";
import { usePlanActivity } from "@/hooks/use-plan-activity";
import { getEventTheme } from "@/theme/useEventTheme";
import { EventThemeProvider } from "@/themes/ThemeProvider";
import { SignatureEffect } from "@/themes/SignatureEffect";
import { normalizeEvent, getEventArea } from "@/utils/eventUtils";
import { computeSplit, getFairShareForParticipant } from "@/lib/split/calc";
import { getEventCategoryFromData, getEventTheme as getCategoryTheme, getEventThemeStyle } from "@/lib/eventTheme";
import { EventCategoryBadge } from "@/components/event/EventCategoryBadge";
import { getCircleMoodTokens, getCirclePersonalityFromEvent, getDefaultCirclePersonality } from "@/lib/circlePersonality";
import { usePanel } from "@/state/panel";
import {
  getPrivateTemplateById,
  getPrivateTemplateForEvent,
  type PrivateTemplateId,
} from "@/lib/private-event-templates";
import {
  VIBE_THEME,
  type PrivateEventVibeId,
} from "@/lib/event-types";
import { buildWhatsAppShareUrl } from "@/lib/share-message";
import { buildInviteUrl, generateInviteMessage } from "@/lib/invite-share";
import { formatFullDate, formatPlanDateRange } from "@/lib/dates";
import { getPlanWrapUpEndsAt } from "@/lib/plan-lifecycle";
import type { InviteAuthContext } from "@/lib/invite-context";
import { copyText } from "@/lib/copy-text";
import { buildIcs, downloadIcs, inferEventDateRange } from "@/lib/calendar-ics";
import { buildMapsUrl, openMaps } from "@/lib/maps";
import { deriveSplannoBuddyModel, type SplannoBuddyAction } from "@/lib/splanno-buddy";
import { SplannoBuddyLayer } from "@/components/buddy/SplannoBuddyLayer";
import { markPlanSwitchPerf, measurePlanSwitchPerf } from "@/lib/plan-switch-perf";
import { circularActionButtonClass, cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { InlineQueryError, SkeletonAvatar, SkeletonCard, SkeletonLine } from "@/components/ui/load-states";
import { EMPTY_COPY, UI_COPY } from "@/lib/emotional-copy";
import { FEATURE_PUBLIC_PLANS } from "@/lib/features";
import {
  defaultPrivateSuggestionState,
  getNearbyPublicEvents,
  getOrCreateSuggestionDeviceId,
  getSuggestionDistanceLabel,
  isEligibleForLocalSuggestions,
  isSuggestionCacheFresh,
  loadPrivateSuggestionState,
  savePrivateSuggestionState,
  type SuggestionVote,
} from "@/lib/private-event-suggestions";
import { getListingBadgeLabel, isPublicEvent, shouldShowPendingPublish } from "@/lib/public-listing-ui";
import { isPrivateEvent as isPrivateEventVisibility } from "@shared/event-visibility";
import type { EventBannerPresetId } from "@shared/lib/plan-hero-banner";
import {
  derivePlanTypeSelection,
  getEventTypeForPlanType,
  getPlanMainTypeLabel,
  getPlanSubcategoryLabel,
} from "@shared/lib/plan-types";
import type { ExpenseWithParticipant, Barbecue, Participant, FriendInfo, PendingRequestWithBbq } from "@shared/schema";

const PlanDetailsDrawer = lazy(() => import("@/components/event/PlanDetailsDrawer"));
const PlanTypeDrawer = lazy(() => import("@/components/event/PlanTypeDrawer"));
const ActivityDrawer = lazy(() => import("@/components/event/ActivityDrawer"));
const NotificationsDrawer = lazy(() => import("@/components/event/NotificationsDrawer"));

/** Fallback colors for expense chart. Extended for custom categories (hash-based). */
const CATEGORY_COLORS: Record<string, string> = {
  Meat: '#e05c2a', Bread: '#f0c040', Drinks: '#3b82f6',
  Charcoal: '#64748b', Transportation: '#10b981', Other: '#a855f7',
  Food: '#e05c2a', Transport: '#10b981', Tickets: '#8b5cf6', Accommodation: '#0ea5e9',
  Activities: '#06b6d4', Groceries: '#84cc16', Snacks: '#f59e0b', Supplies: '#6b7280',
  Parking: '#6366f1', Tips: '#ec4899', Entertainment: '#14b8a6',
};

type PrivatePlanSort = "recent" | "date";
type ActiveSurface = "chat" | "panel";
const PRIVATE_PLAN_SORT_STORAGE_KEY = "splanno.private-plan-sort.v1";

function initialsFromName(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

function firstNameFromName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

const HOME_DASHBOARD_COPY: Record<Language, {
  greetingMorning: string;
  greetingAfternoon: string;
  greetingEvening: string;
  greetingFallbackName: string;
  activePlans: (count: number) => string;
  sortRecent: string;
  sortDate: string;
  noPlansTitle: string;
  noPlansSubtitle: string;
  dateTba: string;
  locationTba: string;
  newSuffix: string;
  personSingular: string;
  personPlural: string;
  sharedSuffix: string;
  allSettled: string;
  youAreOwed: (amount: string) => string;
  youOwe: (amount: string) => string;
  selectPlanPrompt: string;
}> = {
  en: {
    greetingMorning: "Good morning",
    greetingAfternoon: "Good afternoon",
    greetingEvening: "Good evening",
    greetingFallbackName: "there",
    activePlans: (count) => `You have ${count} active ${count === 1 ? "plan" : "plans"}`,
    sortRecent: "Recent activity",
    sortDate: "Date",
    noPlansTitle: "No plans yet",
    noPlansSubtitle: "Create your first plan and invite your friends",
    dateTba: "Date TBA",
    locationTba: "Location TBA",
    newSuffix: "new",
    personSingular: "person",
    personPlural: "people",
    sharedSuffix: "shared",
    allSettled: "All settled",
    youAreOwed: (amount) => `You are owed ${amount}`,
    youOwe: (amount) => `You owe ${amount}`,
    selectPlanPrompt: "Select or create a plan to get started.",
  },
  es: {
    greetingMorning: "Buenos días",
    greetingAfternoon: "Buenas tardes",
    greetingEvening: "Buenas noches",
    greetingFallbackName: "amigo",
    activePlans: (count) => `Tienes ${count} ${count === 1 ? "plan activo" : "planes activos"}`,
    sortRecent: "Actividad reciente",
    sortDate: "Fecha",
    noPlansTitle: "Todavía no hay planes",
    noPlansSubtitle: "Crea tu primer plan e invita a tus amigos",
    dateTba: "Fecha pendiente",
    locationTba: "Ubicación pendiente",
    newSuffix: "nuevo",
    personSingular: "persona",
    personPlural: "personas",
    sharedSuffix: "compartido",
    allSettled: "Todo saldado",
    youAreOwed: (amount) => `Te deben ${amount}`,
    youOwe: (amount) => `Debes ${amount}`,
    selectPlanPrompt: "Selecciona o crea un plan para empezar.",
  },
  it: {
    greetingMorning: "Buongiorno",
    greetingAfternoon: "Buon pomeriggio",
    greetingEvening: "Buonasera",
    greetingFallbackName: "amico",
    activePlans: (count) => `Hai ${count} ${count === 1 ? "piano attivo" : "piani attivi"}`,
    sortRecent: "Attività recente",
    sortDate: "Data",
    noPlansTitle: "Nessun piano ancora",
    noPlansSubtitle: "Crea il tuo primo piano e invita i tuoi amici",
    dateTba: "Data da definire",
    locationTba: "Luogo da definire",
    newSuffix: "nuovo",
    personSingular: "persona",
    personPlural: "persone",
    sharedSuffix: "condiviso",
    allSettled: "Tutto saldato",
    youAreOwed: (amount) => `Ti spettano ${amount}`,
    youOwe: (amount) => `Devi ${amount}`,
    selectPlanPrompt: "Seleziona o crea un piano per iniziare.",
  },
  nl: {
    greetingMorning: "Goedemorgen",
    greetingAfternoon: "Goedemiddag",
    greetingEvening: "Goedenavond",
    greetingFallbackName: "daar",
    activePlans: (count) => `Je hebt ${count} actieve ${count === 1 ? "plan" : "plannen"}`,
    sortRecent: "Recente activiteit",
    sortDate: "Datum",
    noPlansTitle: "Nog geen plannen",
    noPlansSubtitle: "Maak je eerste plan en nodig je vrienden uit",
    dateTba: "Datum volgt",
    locationTba: "Locatie volgt",
    newSuffix: "nieuw",
    personSingular: "persoon",
    personPlural: "personen",
    sharedSuffix: "gedeeld",
    allSettled: "Alles verrekend",
    youAreOwed: (amount) => `Je krijgt ${amount}`,
    youOwe: (amount) => `Je moet ${amount} betalen`,
    selectPlanPrompt: "Selecteer of maak een plan om te beginnen.",
  },
};

const HOME_DATE_LOCALE: Record<Language, string> = {
  en: "en-GB",
  es: "es-ES",
  it: "it-IT",
  nl: "nl-NL",
};

function getGreetingForCurrentTime(language: Language) {
  const copy = HOME_DASHBOARD_COPY[language];
  const hour = new Date().getHours();
  if (hour < 12) return copy.greetingMorning;
  if (hour < 18) return copy.greetingAfternoon;
  return copy.greetingEvening;
}

function getPrivatePlanGradient(event: Pick<Barbecue, "eventType" | "name">) {
  const eventType = String(event.eventType ?? "").toLowerCase();
  const name = String(event.name ?? "").toLowerCase();
  if (eventType.includes("barbecue") || eventType.includes("dinner") || name.includes("bbq")) {
    return "from-orange-500 via-amber-500 to-rose-500";
  }
  if (eventType.includes("trip") || eventType.includes("vacation") || eventType.includes("camping")) {
    return "from-sky-500 via-cyan-500 to-teal-500";
  }
  if (eventType.includes("birthday")) {
    return "from-pink-500 via-rose-500 to-fuchsia-500";
  }
  return "from-violet-500 via-fuchsia-500 to-indigo-500";
}

function parseIncludedUserIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter((entry) => entry.length > 0);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      const inner = trimmed.slice(1, -1).trim();
      if (!inner) return [];
      return inner.split(",").map((entry) => entry.replace(/^"+|"+$/g, "").trim()).filter(Boolean);
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map((entry) => String(entry).trim()).filter(Boolean);
    } catch {
      return [];
    }
  }
  return [];
}

const PUBLIC_CREATE_CATEGORY_OPTIONS = [
  { key: "party", label: "Party", area: "parties", eventType: "other_party" },
  { key: "live_music", label: "Live music", area: "parties", eventType: "other_party" },
  { key: "networking", label: "Networking", area: "trips", eventType: "business_trip" },
  { key: "workshop", label: "Workshop", area: "trips", eventType: "business_trip" },
  { key: "meetup", label: "Meetup", area: "parties", eventType: "other_party" },
  { key: "conference", label: "Conference", area: "trips", eventType: "business_trip" },
  { key: "training", label: "Training", area: "trips", eventType: "business_trip" },
  { key: "sports", label: "Sports", area: "trips", eventType: "other_trip" },
  { key: "other", label: "Other", area: "parties", eventType: "other_party" },
] as const;

const PUBLIC_BANNER_PRESETS = [
  "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1515169067868-5387ec356754?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1464375117522-1311d6a5b81f?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=1600&q=80",
] as const;

const PUBLIC_TEMPLATE_OPTIONS = [
  { key: "classic", label: "Classic", description: "Balanced hero and details layout" },
  { key: "keynote", label: "Keynote", description: "Large headline, presentation-style hero" },
  { key: "workshop", label: "Workshop", description: "Focused agenda-first structure" },
  { key: "nightlife", label: "Nightlife", description: "Atmospheric, bold hero treatment" },
  { key: "meetup", label: "Meetup", description: "Friendly community event layout" },
] as const;

type PlanMainCategory = "trip" | "party";
type PlanSubcategoryId =
  | "backpacking"
  | "city_trip"
  | "workation"
  | "roadtrip"
  | "beach_trip"
  | "ski_trip"
  | "festival_trip"
  | "weekend_getaway"
  | "barbecue"
  | "cinema_night"
  | "game_night"
  | "dinner"
  | "birthday"
  | "house_party"
  | "club_night"
  | "picnic";

type PlanSubcategoryDef = {
  id: PlanSubcategoryId;
  label: string;
  emoji: string;
  eventTypeValue: string;
  area: "trips" | "parties";
  templateId: PrivateTemplateId;
};

const PLAN_TYPE_OPTIONS: Array<{
  id: PlanMainCategory;
  label: string;
  description: string;
  icon: typeof Plane;
}> = [
  { id: "trip", label: "Trip", description: "Travel plans and shared costs", icon: Plane },
  { id: "party", label: "Party", description: "Celebrate and coordinate with friends", icon: PartyPopper },
];

const TRIP_SUBCATEGORIES: PlanSubcategoryDef[] = [
  { id: "backpacking", label: "Backpacking", emoji: "🎒", eventTypeValue: "backpacking", area: "trips", templateId: "trip" },
  { id: "city_trip", label: "City trip", emoji: "🏙️", eventTypeValue: "city_trip", area: "trips", templateId: "trip" },
  { id: "workation", label: "Workation", emoji: "💻", eventTypeValue: "workation", area: "trips", templateId: "trip" },
  { id: "roadtrip", label: "Roadtrip", emoji: "🚗", eventTypeValue: "road_trip", area: "trips", templateId: "trip" },
  { id: "ski_trip", label: "Ski trip", emoji: "🎿", eventTypeValue: "ski_trip", area: "trips", templateId: "trip" },
  { id: "beach_trip", label: "Beach getaway", emoji: "🏖️", eventTypeValue: "beach_trip", area: "trips", templateId: "trip" },
  { id: "festival_trip", label: "Festival trip", emoji: "🎪", eventTypeValue: "festival_trip", area: "trips", templateId: "trip" },
  { id: "weekend_getaway", label: "Weekend escape", emoji: "🧳", eventTypeValue: "weekend_getaway", area: "trips", templateId: "weekend" },
];

const PARTY_SUBCATEGORIES: PlanSubcategoryDef[] = [
  { id: "barbecue", label: "Barbecue", emoji: "🔥", eventTypeValue: "barbecue", area: "parties", templateId: "party" },
  { id: "cinema_night", label: "Cinema", emoji: "🎬", eventTypeValue: "cinema", area: "parties", templateId: "generic" },
  { id: "game_night", label: "Game night", emoji: "🎮", eventTypeValue: "game_night", area: "parties", templateId: "game_night" },
  { id: "dinner", label: "Dinner", emoji: "🍝", eventTypeValue: "dinner_party", area: "parties", templateId: "dinner" },
  { id: "house_party", label: "House party", emoji: "🏠", eventTypeValue: "house_party", area: "parties", templateId: "party" },
  { id: "birthday", label: "Birthday", emoji: "🎂", eventTypeValue: "birthday", area: "parties", templateId: "party" },
  { id: "club_night", label: "Drinks night", emoji: "🍸", eventTypeValue: "after_party", area: "parties", templateId: "party" },
  { id: "picnic", label: "Picnic", emoji: "🧺", eventTypeValue: "day_out", area: "parties", templateId: "generic" },
];

type PublicTemplateKey = (typeof PUBLIC_TEMPLATE_OPTIONS)[number]["key"];
type PublicRsvpTierDraft = {
  id: string;
  name: string;
  description: string;
  priceLabel: string;
  capacity: string;
  isFree: boolean;
};

type PublicCreateCategoryKey = (typeof PUBLIC_CREATE_CATEGORY_OPTIONS)[number]["key"];

function getCategoryColor(cat: string): string {
  return CATEGORY_COLORS[cat] ?? `hsl(${(cat.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360)}, 60%, 50%)`;
}

// ─── Auth Dialog (exported for LoginShell / Login page) ───────────────────────
export function AuthDialog({
  open,
  onOpenChange,
  isCheckingAuth = false,
  onSuccess,
  googleRedirectTo,
  inviteContext,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isCheckingAuth?: boolean;
  onSuccess?: () => void;
  googleRedirectTo?: string;
  inviteContext?: InviteAuthContext | null;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { login, register, forgotPassword } = useAuth();
  const [tab, setTab] = useState<"login" | "register" | "forgot" | "sent">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);
  const switchTab = (next: typeof tab) => { setTab(next); setError(""); };

  const handleLogin = async () => {
    setError("");
    if (!username || !password) return;
    try {
      await login.mutateAsync({ username, password });
      onSuccess?.();
    } catch (e: any) {
      const msg = e.message;
      setError(msg === "invalid_credentials" ? t.auth.invalidCredentials : msg);
    }
  };

  const handleRegister = async () => {
    setError("");
    if (!username || !email || !password) return;
    if (password.length < 8) { setError(t.auth.passwordHint); return; }
    if (password !== confirm) { setError(t.auth.passwordsNoMatch); return; }
    try {
      const result = await register.mutateAsync({ username, email, displayName: displayName || undefined, password }) as { emailSent?: boolean };
      if (result?.emailSent === false) toast({ title: t.auth.welcomeEmailNotSent, variant: "default" });
      onSuccess?.();
    } catch (e: any) {
      const msg = e.message;
      if (msg === "username_taken") setError(t.auth.usernameTaken);
      else if (msg === "email_taken") setError(t.auth.emailTaken);
      else setError(msg);
    }
  };

  const handleForgot = async () => {
    setError("");
    if (!email) return;
    try {
      await forgotPassword.mutateAsync({ email });
      switchTab("sent");
    } catch (e: any) {
      setError(e.message);
    }
  };

  const isLoading = login.isPending || register.isPending || forgotPassword.isPending;
  const isInviteFlow = !!inviteContext;
  const handleGoogleContinue = () => {
    const redirectSuffix = googleRedirectTo ? `?redirectTo=${encodeURIComponent(googleRedirectTo)}` : "";
    window.location.href = `/api/auth/google${redirectSuffix}`;
  };

  const titles: Record<typeof tab, string> = {
    login: t.auth.loginTitle,
    register: t.auth.registerTitle,
    forgot: t.auth.forgotPasswordTitle,
    sent: t.auth.checkEmail,
  };
  const subtitles: Record<typeof tab, string> = {
    login: t.auth.welcomeBack,
    register: t.auth.createAccount,
    forgot: t.auth.forgotPasswordSubtitle,
    sent: t.auth.checkEmailDesc,
  };

  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      onOpenChange={onOpenChange}
      title={isCheckingAuth ? t.auth.loginTitle : titles[tab]}
      size="sm"
      data-testid="dialog-auth"
    >
      <div className="flex items-center justify-center mb-2">
        <SplannoLogo variant="full" size={56} className="pointer-events-none" />
      </div>
      <p className="text-sm text-muted-foreground text-center mb-4">{isCheckingAuth ? t.auth.welcomeBack : subtitles[tab]}</p>
      {inviteContext ? (
        <div className="mb-4 rounded-2xl border border-border/70 bg-muted/35 px-4 py-3 text-left">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Joining Via Invite
          </p>
          <p className="mt-2 text-sm font-semibold text-foreground">{inviteContext.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {inviteContext.inviterName
              ? `${inviteContext.inviterName} invited you to this ${inviteContext.typeLabel.toLowerCase()}.`
              : `You will go straight into this ${inviteContext.typeLabel.toLowerCase()} after auth.`}
          </p>
        </div>
      ) : null}

      {isCheckingAuth ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{t.auth.welcomeBack}</p>
          </div>
        ) : (
        <>
        {/* Tab selector — only for login/register */}
        {(tab === "login" || tab === "register") && (
          <div className="flex rounded-lg border border-white/10 overflow-hidden mb-2">
            {(["login", "register"] as const).map(tabKey => (
              <button
                key={tabKey}
                onClick={() => switchTab(tabKey)}
                className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                  tab === tabKey ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-white/5'
                }`}
                data-testid={`tab-auth-${tabKey}`}
              >
                {tabKey === "login" ? t.auth.login : t.auth.register}
              </button>
            ))}
          </div>
        )}

        {/* Login form */}
        {tab === "login" && (
          <div className="space-y-3">
            <Button type="button" variant="outline" className="w-full" onClick={handleGoogleContinue} data-testid="button-auth-google">
              {isInviteFlow ? "Continue with Google to join" : "Continue with Google"}
            </Button>
            <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              <span>or</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t.auth.username}</Label>
              <Input
                placeholder={t.user.usernamePlaceholder}
                value={username}
                onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                autoFocus
                data-testid="input-auth-username"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t.auth.password}</Label>
              <div className="relative">
                <Input
                  type={showPw ? "text" : "password"}
                  placeholder="••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleLogin()}
                  data-testid="input-auth-password"
                  className="pr-9"
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button
                className="text-[11px] text-primary hover:underline float-right"
                onClick={() => { setEmail(""); switchTab("forgot"); }}
                data-testid="link-forgot-password"
              >
                {t.auth.forgotPassword}
              </button>
            </div>
            {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2" data-testid="text-auth-error">{error}</p>}
            <Button onClick={handleLogin} disabled={isLoading || !username || !password}
              className="w-full bg-primary text-primary-foreground font-bold" data-testid="button-auth-submit">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isInviteFlow ? "Log in to join plan" : t.auth.login)}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              {t.auth.dontHaveAccount}{" "}
              <button onClick={() => switchTab("register")} className="text-primary hover:underline font-semibold" data-testid="button-auth-switch">
                {t.auth.register}
              </button>
            </p>
          </div>
        )}

        {/* Register form */}
        {tab === "register" && (
          <div className="space-y-3">
            <Button type="button" variant="outline" className="w-full" onClick={handleGoogleContinue} data-testid="button-auth-google-register">
              {isInviteFlow ? "Continue with Google to join" : "Continue with Google"}
            </Button>
            <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              <span>or</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t.auth.displayName}</Label>
              <Input
                placeholder={t.auth.displayNamePlaceholder}
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                autoFocus
                data-testid="input-auth-displayname"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t.auth.username}</Label>
              <Input
                placeholder={t.user.usernamePlaceholder}
                value={username}
                onChange={e => setUsername(e.target.value)}
                data-testid="input-auth-username"
              />
              <p className="text-[10px] text-muted-foreground">{t.auth.usernameHint}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t.auth.email}</Label>
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                data-testid="input-auth-email"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t.auth.password}</Label>
              <div className="relative">
                <Input
                  type={showPw ? "text" : "password"}
                  placeholder="••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  data-testid="input-auth-password"
                  className="pr-9"
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground">{t.auth.passwordHint}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t.auth.confirmPassword}</Label>
              <Input
                type={showPw ? "text" : "password"}
                placeholder="••••••"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleRegister()}
                data-testid="input-auth-confirm"
              />
            </div>
            {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2" data-testid="text-auth-error">{error}</p>}
            <Button onClick={handleRegister} disabled={isLoading || !username || !email || !password || !confirm}
              className="w-full bg-primary text-primary-foreground font-bold" data-testid="button-auth-submit">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isInviteFlow ? "Create account to join" : t.auth.register)}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              {t.auth.alreadyHaveAccount}{" "}
              <button onClick={() => switchTab("login")} className="text-primary hover:underline font-semibold" data-testid="button-auth-switch">
                {t.auth.login}
              </button>
            </p>
          </div>
        )}

        {/* Forgot password form */}
        {tab === "forgot" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t.auth.email}</Label>
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleForgot()}
                autoFocus
                data-testid="input-forgot-email"
              />
            </div>
            {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}
            <Button onClick={handleForgot} disabled={isLoading || !email}
              className="w-full bg-primary text-primary-foreground font-bold" data-testid="button-send-reset">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t.auth.sendResetLink}
            </Button>
            <button onClick={() => switchTab("login")} className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors" data-testid="link-back-to-login">
              ← {t.auth.backToLogin}
            </button>
          </div>
        )}

        {/* Sent confirmation: always generic success (anti-enumeration) */}
        {tab === "sent" && (
          <div className="text-center py-4 space-y-3">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6 text-green-400" />
            </div>
            <p className="text-sm text-muted-foreground">{t.auth.forgotPasswordSuccessGeneric}</p>
            <button onClick={() => switchTab("login")} className="text-xs text-primary hover:underline font-semibold" data-testid="link-back-to-login-sent">
              {t.auth.backToLogin}
            </button>
          </div>
        )}
        </>
        )}
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
type HomeRouteMode = "legacy" | "private" | "public" | "event";
type AccountView = "profile" | "friends" | "addFriend" | "friendProfile" | "editBio" | "changePhoto" | "settings";
type HomeProps = {
  appRouteMode?: HomeRouteMode;
  routeEventId?: number | null;
  debugDisableDiscoverModal?: boolean;
};
const LEAVE_REDIRECT_MARKER_KEY = "splanno.recentlyLeftPlan";

export default function Home({
  appRouteMode = "legacy",
  routeEventId = null,
  debugDisableDiscoverModal = false,
}: HomeProps) {
  const { t, language } = useLanguage();
  const homeCopy = HOME_DASHBOARD_COPY[language];
  const { prefs: eventHeaderPrefs } = useEventHeaderPreferences();
  const { user, isLoading: isAuthLoading, logout, updateProfile, deleteAccount } = useAuth();
  const [, setLocation] = useLocation();
  const username = user?.username ?? null;
  const { toast } = useToast();
  const { toastSuccess, toastError, toastInfo, toastWarning } = useAppToast();
  const { showUpgrade } = useUpgrade();
  const { openNewPlanWizard } = useNewPlanWizard();
  const { panel, openPanel, closePanel } = usePanel();
  const isMobileViewport = useIsMobile();
  const shouldReduceMotion = useReducedMotion();
  const isManagedAppRoute = appRouteMode !== "legacy";
  const isEventChatRoute = isManagedAppRoute && appRouteMode === "event";
  // Managed event route should render the new dashboard layout.
  const useNewManagedEventLayout = true;
  const desktopOverviewInitializedForEventRef = useRef<number | null>(null);
  const lastManagedRouteEventIdRef = useRef<number | null>(null);

  const [area, setArea] = useState<"parties" | "trips">("parties");
  const [eventVisibilityTab, setEventVisibilityTab] = useState<"private" | "public">("private");
  const [selectedBbqId, setSelectedBbqId] = useState<number | null>(null);
  const activeEventId = isManagedAppRoute && appRouteMode === "event"
    ? (routeEventId ?? null)
    : selectedBbqId;
  const mobilePrimaryTab: "chat" | "photos" | "expenses" | "crew" | "overview" = panel == null
    ? "chat"
    : panel.type === "photos"
      ? "photos"
      : (panel.type === "expenses" || panel.type === "expense" || panel.type === "add-expense" || panel.type === "settlement")
      ? "expenses"
      : (panel.type === "crew"
        || (panel.type === "member-profile" && panel.source === "crew")
        || (panel.type === "invite" && panel.source === "crew"))
        ? "crew"
        : "overview";
  const reactionScopeId = activeEventId != null ? `ev-${activeEventId}` : "ev-none";
  const { addReaction, getReactions, getReactionUsers, getUserReaction } = useExpenseReactions(reactionScopeId);
  const [isNewBbqOpen, setIsNewBbqOpen] = useState(false);
  const [newBbqName, setNewBbqName] = useState("");
  const [newBbqDate, setNewBbqDate] = useState(new Date().toISOString().split('T')[0]);
  const [newBbqTime, setNewBbqTime] = useState("");
  const [newBbqCurrency, setNewBbqCurrency] = useState<CurrencyCode>("EUR");
  const [newBbqIsPublic, setNewBbqIsPublic] = useState(true);
  const [newBbqVisibilityOrigin, setNewBbqVisibilityOrigin] = useState<"private" | "public">("public");
  const [newBbqPublicMode, setNewBbqPublicMode] = useState<"marketing" | "joinable">("marketing");
  const [newBbqAllowOptIn, setNewBbqAllowOptIn] = useState(false);
  const [newEventPublicCategory, setNewEventPublicCategory] = useState<PublicCreateCategoryKey>("networking");
  const [newPublicCreateStep, setNewPublicCreateStep] = useState<1 | 2 | 3 | 4>(1);
  const [newPrivateCreateStep, setNewPrivateCreateStep] = useState<1 | 2 | 3>(1);
  const [newEventArea, setNewEventArea] = useState<"parties" | "trips">("parties");
  const [newEventType, setNewEventType] = useState<string>("barbecue");
  const [newPlanMainCategory, setNewPlanMainCategory] = useState<PlanMainCategory | null>(null);
  const [newPlanSubCategory, setNewPlanSubCategory] = useState<PlanSubcategoryId | null>(null);
  const [newPrivateTemplateId, setNewPrivateTemplateId] = useState<PrivateTemplateId>("generic");
  const [newEventLocation, setNewEventLocation] = useState<LocationOption | null>(null);
  const [newEventLocationTouched, setNewEventLocationTouched] = useState(false);
  const [newPublicDescription, setNewPublicDescription] = useState("");
  const [newPublicSubtitle, setNewPublicSubtitle] = useState("");
  const [newPublicOrganizationName, setNewPublicOrganizationName] = useState("");
  const [newPublicBannerUrl, setNewPublicBannerUrl] = useState("");
  const [newPublicTemplate, setNewPublicTemplate] = useState<PublicTemplateKey>("classic");
  const [newPublicCapacity, setNewPublicCapacity] = useState("");
  const [newPublicExternalLink, setNewPublicExternalLink] = useState("");
  const [newPublicListFromAt, setNewPublicListFromAt] = useState("");
  const [newPublicListUntilAt, setNewPublicListUntilAt] = useState("");
  const [newPublicRsvpTiers, setNewPublicRsvpTiers] = useState<PublicRsvpTierDraft[]>([
    { id: "general", name: "General Admission", description: "", priceLabel: "", capacity: "", isFree: true },
  ]);
  const [newPublicListOnExplore, setNewPublicListOnExplore] = useState(false);
  const [privatePlanSort, setPrivatePlanSort] = useState<PrivatePlanSort>("recent");
  const [activeSurface, setActiveSurface] = useState<ActiveSurface>("chat");
  const [mobileSwipeOffset, setMobileSwipeOffset] = useState(0);
  const [mobileSwipeAnimating, setMobileSwipeAnimating] = useState(false);
  const lastActivityReadEventRef = useRef<number | null>(null);
  const activityReadDebounceRef = useRef<number | null>(null);
  const mobileSwipeRef = useRef<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    active: boolean;
    interactive: boolean;
  } | null>(null);
  const mobileSwipeIntroDirectionRef = useRef<"left" | "right" | null>(null);
  const isInteractiveSurfaceTarget = useCallback((target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    return !!target.closest(
      'button,a,input,textarea,select,label,summary,[role="button"],[role="link"],[data-no-surface-focus]',
    );
  }, []);
  const mobileSwipeMainView: "chat" | "expenses" | "overview" | null = panel == null
    ? "chat"
    : panel.type === "expenses"
      ? "expenses"
      : panel.type === "overview"
        ? "overview"
        : null;
  const isMobileOverlayPanelOpen = panel != null && mobileSwipeMainView == null;

  const openMobileMainView = useCallback((view: "chat" | "expenses" | "overview") => {
    if (view === "chat") {
      closePanel();
      return;
    }
    if (view === "expenses") {
      openPanel({ type: "expenses" });
      return;
    }
    openPanel({ type: "overview" });
  }, [closePanel, openPanel]);

  useLayoutEffect(() => {
    if (!isMobileViewport) return;
    const direction = mobileSwipeIntroDirectionRef.current;
    if (!direction) return;
    const initialOffset = direction === "left" ? 28 : -28;
    setMobileSwipeAnimating(false);
    setMobileSwipeOffset(initialOffset);
    const rafId = window.requestAnimationFrame(() => {
      setMobileSwipeAnimating(true);
      setMobileSwipeOffset(0);
      mobileSwipeIntroDirectionRef.current = null;
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [isMobileViewport, mobileSwipeMainView, panel?.type, activeEventId]);

  const handleMobileContentTouchStart = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    if (!isMobileViewport) return;
    mobileSwipeRef.current = {
      startX: event.touches[0]?.clientX ?? 0,
      startY: event.touches[0]?.clientY ?? 0,
      currentX: event.touches[0]?.clientX ?? 0,
      currentY: event.touches[0]?.clientY ?? 0,
      active: true,
      interactive: isInteractiveSurfaceTarget(event.target),
    };
    setMobileSwipeAnimating(false);
  }, [isInteractiveSurfaceTarget, isMobileViewport]);

  const handleMobileContentTouchMove = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    if (!isMobileViewport || !mobileSwipeRef.current?.active || mobileSwipeRef.current.interactive) return;
    const currentX = event.touches[0]?.clientX ?? mobileSwipeRef.current.startX;
    const currentY = event.touches[0]?.clientY ?? mobileSwipeRef.current.startY;
    mobileSwipeRef.current.currentX = currentX;
    mobileSwipeRef.current.currentY = currentY;
    const deltaX = currentX - mobileSwipeRef.current.startX;
    const deltaY = currentY - mobileSwipeRef.current.startY;
    if (Math.abs(deltaY) > 30 && Math.abs(deltaY) > Math.abs(deltaX)) {
      mobileSwipeRef.current.active = false;
      setMobileSwipeOffset(0);
      return;
    }
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaY) < 30) {
      setMobileSwipeOffset(Math.max(-72, Math.min(72, deltaX)));
    }
  }, [isMobileViewport]);

  const handleMobileContentTouchEnd = useCallback(() => {
    const swipe = mobileSwipeRef.current;
    mobileSwipeRef.current = null;
    if (!isMobileViewport || !swipe?.active || swipe.interactive) {
      setMobileSwipeOffset(0);
      return;
    }

    const deltaX = swipe.currentX - swipe.startX;
    const deltaY = swipe.currentY - swipe.startY;
    const isHorizontalSwipe = Math.abs(deltaX) > 50 && Math.abs(deltaY) < 30;

    if (!isHorizontalSwipe) {
      setMobileSwipeAnimating(true);
      setMobileSwipeOffset(0);
      return;
    }

    if (isMobileOverlayPanelOpen) {
      if (deltaX > 50) {
        mobileSwipeIntroDirectionRef.current = "right";
        closePanel();
      } else {
        setMobileSwipeAnimating(true);
        setMobileSwipeOffset(0);
      }
      return;
    }

    if (!mobileSwipeMainView) {
      setMobileSwipeAnimating(true);
      setMobileSwipeOffset(0);
      return;
    }

    const order: Array<"chat" | "expenses" | "overview"> = ["chat", "expenses", "overview"];
    const currentIndex = order.indexOf(mobileSwipeMainView);
    if (deltaX < -50 && currentIndex < order.length - 1) {
      mobileSwipeIntroDirectionRef.current = "left";
      openMobileMainView(order[currentIndex + 1]!);
      return;
    }
    if (deltaX > 50 && currentIndex > 0) {
      mobileSwipeIntroDirectionRef.current = "right";
      openMobileMainView(order[currentIndex - 1]!);
      return;
    }

    setMobileSwipeAnimating(true);
    setMobileSwipeOffset(0);
  }, [closePanel, isMobileOverlayPanelOpen, isMobileViewport, mobileSwipeMainView, mobileSwipeOffset, openMobileMainView]);

  useEffect(() => {
    if (appRouteMode === "private" || !FEATURE_PUBLIC_PLANS) setEventVisibilityTab("private");
    if (appRouteMode === "public" && FEATURE_PUBLIC_PLANS) setEventVisibilityTab("public");
  }, [appRouteMode]);

  useLayoutEffect(() => {
    if (!isManagedAppRoute) return;
    if (appRouteMode !== "private") return;
    setSelectedBbqId(null);
  }, [isManagedAppRoute, appRouteMode]);

  useEffect(() => {
    if (!panel) setActiveSurface("chat");
  }, [panel]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOpenExpense = (event: Event) => {
      const custom = event as CustomEvent<{ eventId?: number; expenseId?: number }>;
      const targetEventId = Number(custom.detail?.eventId);
      const expenseId = Number(custom.detail?.expenseId);
      if (!Number.isFinite(targetEventId) || targetEventId <= 0 || !Number.isFinite(expenseId) || expenseId <= 0) return;
      if (selectedBbqId && Number(selectedBbqId) !== targetEventId) return;
      if (!selectedBbqId) setSelectedBbqId(targetEventId);
      openPanel({ type: "add-expense", source: "expenses", editExpenseId: expenseId });
    };
    const onOpenExpenses = (event: Event) => {
      const custom = event as CustomEvent<{
        eventId?: number;
        initialView?: "overview" | "expense-form";
        prefill?: {
          amount?: number | null;
          item?: string | null;
          paidBy?: string | null;
          splitCount?: number | null;
        };
      }>;
      const targetEventId = Number(custom.detail?.eventId);
      if (!Number.isFinite(targetEventId) || targetEventId <= 0) return;
      if (selectedBbqId && Number(selectedBbqId) !== targetEventId) return;
      if (!selectedBbqId) setSelectedBbqId(targetEventId);
      if (custom.detail?.initialView === "expense-form") {
        openPanel({ type: "add-expense", source: "overview", prefill: custom.detail?.prefill ?? null });
      }
    };
    window.addEventListener("splanno:open-expense", onOpenExpense as EventListener);
    window.addEventListener("splanno:open-expenses", onOpenExpenses as EventListener);
    return () => {
      window.removeEventListener("splanno:open-expense", onOpenExpense as EventListener);
      window.removeEventListener("splanno:open-expenses", onOpenExpenses as EventListener);
    };
  }, [openPanel, selectedBbqId]);

  useEffect(() => {
    if (newEventLocation) {
      setNewBbqCurrency((currencyForCountry(newEventLocation.countryCode) ?? "EUR") as CurrencyCode);
    }
  }, [newEventLocation?.countryCode]);

  useEffect(() => {
    if (newEventLocation) return;
    const userDefault = (user?.defaultCurrencyCode as CurrencyCode | undefined) ?? "EUR";
    setNewBbqCurrency((current) => (current === "EUR" ? userDefault : current));
  }, [user?.defaultCurrencyCode, newEventLocation]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(`${PRIVATE_PLAN_SORT_STORAGE_KEY}:${user?.id ?? user?.username ?? "anon"}`);
      if (raw === "recent" || raw === "date") {
        setPrivatePlanSort(raw);
      } else {
        setPrivatePlanSort("recent");
      }
    } catch {
      // ignore storage read errors
    }
  }, [user?.id, user?.username]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(`${PRIVATE_PLAN_SORT_STORAGE_KEY}:${user?.id ?? user?.username ?? "anon"}`, privatePlanSort);
    } catch {
      // ignore storage write errors
    }
  }, [privatePlanSort, user?.id, user?.username]);

  const [isAddPersonOpen, setIsAddPersonOpen] = useState(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isPlanDetailsOpen, setIsPlanDetailsOpen] = useState(false);
  const [isPlanTypeOpen, setIsPlanTypeOpen] = useState(false);
  const [isActivityDrawerOpen, setIsActivityDrawerOpen] = useState(false);
  const [recommendedExpenseTemplate, setRecommendedExpenseTemplate] = useState<{ item: string; category: string; optInDefault?: boolean } | null>(null);
  const [editingExpense, setEditingExpense] = useState<ExpenseWithParticipant | null>(null);
  const [editingParticipantId, setEditingParticipantId] = useState<number | null>(null);
  const [editingParticipantName, setEditingParticipantName] = useState("");
  const [inviteUsername, setInviteUsername] = useState("");
  const [settleUpModalOpen, setSettleUpModalOpen] = useState(false);
  const [activeEventTab, setActiveEventTab] = useState<string>("expenses");
  const [publicInboxConversationId, setPublicInboxConversationId] = useState<string | null>(null);
  const [publicInboxDraft, setPublicInboxDraft] = useState("");

  const { data: friends = [] } = useFriends();
  const { data: friendRequests = [] } = useFriendRequests();
  const { data: allPendingRequests = [] } = useAllPendingRequests();
  const { data: notificationsPayload } = useNotifications(!!user);
  const pendingPlanInvites = notificationsPayload?.planInvites ?? [];
  const pendingFriendRequests = notificationsPayload?.friendRequests ?? [];
  const acceptPlanInvite = useAcceptPlanInvite();
  const declinePlanInvite = useDeclinePlanInvite();
  const acceptFriendRequestNotif = useAcceptFriendRequestNotification();
  const declineFriendRequestNotif = useDeclineFriendRequestNotification();
  const acceptFriendReq = useAcceptFriendRequest();
  const removeFriendMut = useRemoveFriend();
  const sendFriendRequest = useSendFriendRequest();
  const [profileTargetUsername, setProfileTargetUsername] = useState<string | null>(null);
  const [isAccountDrawerOpen, setIsAccountDrawerOpen] = useState(false);
  const [accountView, setAccountView] = useState<AccountView>("profile");
  const [deleteAccountDialogOpen, setDeleteAccountDialogOpen] = useState(false);
  const [draftBio, setDraftBio] = useState("");
  const [draftProfileImageUrl, setDraftProfileImageUrl] = useState("");
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarUploadFile, setAvatarUploadFile] = useState<File | null>(null);
  const [avatarUploadPreviewUrl, setAvatarUploadPreviewUrl] = useState<string | null>(null);
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null);
  const [avatarUploadPending, setAvatarUploadPending] = useState(false);
  const [useAvatarUrlInput, setUseAvatarUrlInput] = useState(false);
  const [avatarDragActive, setAvatarDragActive] = useState(false);
  const [accountAvatarLoadFailed, setAccountAvatarLoadFailed] = useState(false);
  const [deleteConfirmPhrase, setDeleteConfirmPhrase] = useState("");
  const [selectedFriendId, setSelectedFriendId] = useState<number | null>(null);
  const [addFriendQuery, setAddFriendQuery] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(true);
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const prevPendingCountRef = useRef(allPendingRequests.length);
  const queryClient = useQueryClient();
  const confirmCheckoutSession = useConfirmCheckoutSession();
  const handledPaymentSessionRef = useRef<string | null>(null);
  const [showSettledConfetti, setShowSettledConfetti] = useState(false);
  const settledCelebrationShownRef = useRef<number | null>(null);
  const publicSplitGuardedEventRef = useRef<number | null>(null);
  const missingEventRedirectedRef = useRef<number | null>(null);
  const [whatsAppStarterOpen, setWhatsAppStarterOpen] = useState(false);
  const [whatsAppStarterMessage, setWhatsAppStarterMessage] = useState("");
  const [whatsAppStarterLink, setWhatsAppStarterLink] = useState("");
  const [manualCopyOpen, setManualCopyOpen] = useState(false);
  const [manualCopyValue, setManualCopyValue] = useState("");
  const manualCopyInputRef = useRef<HTMLInputElement | null>(null);
  const [editTripLocationOpen, setEditTripLocationOpen] = useState(false);
  const [eventSettingsOpen, setEventSettingsOpen] = useState(false);
  const [expensesCollapsed, setExpensesCollapsed] = useState(false);
  const [breakdownCollapsed, setBreakdownCollapsed] = useState(false);
  const [dashboardHeroBannerFailed, setDashboardHeroBannerFailed] = useState(false);
  const [dashboardHeroImageLoaded, setDashboardHeroImageLoaded] = useState(false);
  const [displayedDashboardHeroBannerUrl, setDisplayedDashboardHeroBannerUrl] = useState<string | null>(null);
  const [privateHeroBannerFailed, setPrivateHeroBannerFailed] = useState(false);
  const [publicOverviewBannerFailed, setPublicOverviewBannerFailed] = useState(false);
  const [allEventsSelectorOpen, setAllEventsSelectorOpen] = useState(false);
  const [allEventsSearch, setAllEventsSearch] = useState("");
  const [pinnedEventIds, setPinnedEventIds] = useState<number[]>([]);
  const [recentEventIds, setRecentEventIds] = useState<number[]>([]);
  const [recentLocationOptions, setRecentLocationOptions] = useState<LocationOption[]>([]);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const pinnedEventsStorageKey = useMemo(() => `splanno_pinned_events_${user?.id ?? user?.username ?? "anon"}`, [user?.id, user?.username]);
  const recentEventsStorageKey = useMemo(() => `splanno_recent_events_${user?.id ?? user?.username ?? "anon"}`, [user?.id, user?.username]);
  const recentLocationsStorageKey = useMemo(() => `splanno_recent_locations_${user?.id ?? user?.username ?? "anon"}`, [user?.id, user?.username]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const openNotifications = () => setNotifOpen(true);
    const openAccount = () => setIsAccountDrawerOpen(true);
    const openAccountSettings = () => {
      setProfileTargetUsername(null);
      setAccountView("settings");
      setSelectedFriendId(null);
      setIsAccountDrawerOpen(true);
    };
    const openProfile = (event: Event) => {
      const detail = (event as CustomEvent<{ username?: string | null }>).detail;
      const targetUsername = detail?.username?.trim();
      if (!targetUsername) return;
      setProfileTargetUsername(targetUsername);
      setAccountView("profile");
      setSelectedFriendId(null);
      setIsAccountDrawerOpen(true);
    };
    window.addEventListener("splanno:open-notifications", openNotifications as EventListener);
    window.addEventListener("splanno:open-account", openAccount as EventListener);
    window.addEventListener("splanno:open-account-settings", openAccountSettings as EventListener);
    window.addEventListener("splanno:open-profile", openProfile as EventListener);
    return () => {
      window.removeEventListener("splanno:open-notifications", openNotifications as EventListener);
      window.removeEventListener("splanno:open-account", openAccount as EventListener);
      window.removeEventListener("splanno:open-account-settings", openAccountSettings as EventListener);
      window.removeEventListener("splanno:open-profile", openProfile as EventListener);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setExpensesCollapsed(localStorage.getItem("splanno-ui-expenses-collapsed") === "1");
      setBreakdownCollapsed(localStorage.getItem("splanno-ui-breakdown-collapsed") === "1");
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("splanno-ui-expenses-collapsed", expensesCollapsed ? "1" : "0");
      localStorage.setItem("splanno-ui-breakdown-collapsed", breakdownCollapsed ? "1" : "0");
    } catch {
      // ignore
    }
  }, [expensesCollapsed, breakdownCollapsed]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const parsed = JSON.parse(localStorage.getItem(pinnedEventsStorageKey) ?? "[]");
      setPinnedEventIds(Array.isArray(parsed) ? parsed.filter((v): v is number => Number.isInteger(v)) : []);
    } catch {
      setPinnedEventIds([]);
    }
  }, [pinnedEventsStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const parsed = JSON.parse(localStorage.getItem(recentEventsStorageKey) ?? "[]");
      setRecentEventIds(Array.isArray(parsed) ? parsed.filter((v): v is number => Number.isInteger(v)) : []);
    } catch {
      setRecentEventIds([]);
    }
  }, [recentEventsStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(pinnedEventsStorageKey, JSON.stringify(pinnedEventIds.slice(0, 24)));
  }, [pinnedEventIds, pinnedEventsStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(recentEventsStorageKey, JSON.stringify(recentEventIds.slice(0, 20)));
  }, [recentEventIds, recentEventsStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const parsed = JSON.parse(localStorage.getItem(recentLocationsStorageKey) ?? "[]");
      const valid = Array.isArray(parsed)
        ? parsed.filter((entry): entry is LocationOption => (
          !!entry &&
          typeof entry === "object" &&
          typeof (entry as LocationOption).locationName === "string" &&
          typeof (entry as LocationOption).city === "string" &&
          typeof (entry as LocationOption).countryCode === "string" &&
          typeof (entry as LocationOption).countryName === "string"
        ))
        : [];
      setRecentLocationOptions(valid.slice(0, 12));
    } catch {
      setRecentLocationOptions([]);
    }
  }, [recentLocationsStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(recentLocationsStorageKey, JSON.stringify(recentLocationOptions.slice(0, 12)));
  }, [recentLocationOptions, recentLocationsStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Welcome onboarding is disabled for MVP; clear stale client-side trigger flags.
    sessionStorage.removeItem("ortega_show_welcome");
  }, []);

  // TODO: optionally re-add onboarding modal only on first-ever login,
  // gated by a server-backed flag (e.g. user.onboardingSeenAt).

  useEffect(() => {
    if (allPendingRequests.length > prevPendingCountRef.current) {
      toast({
        title: t.notifications.joinRequest,
        description: `${allPendingRequests.length - prevPendingCountRef.current} ${t.notifications.wantsToJoin}`,
      });
    }
    prevPendingCountRef.current = allPendingRequests.length;
  }, [allPendingRequests.length]);

  useEffect(() => {
    if (!isManagedAppRoute) return;
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const next = url.searchParams.get("new");
    if (next !== "private" && next !== "public") return;
    setIsNewBbqOpen(true);
    resetNewEventWizard();
    setNewPublicCreateStep(1);
    url.searchParams.delete("new");
    window.history.replaceState({}, "", url.toString());
  }, [isManagedAppRoute]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const listing = url.searchParams.get("listing");
    const eventIdParam = Number(url.searchParams.get("eventId"));
    if (!listing) return;

    if (listing === "success") {
      toastSuccess("Listing activated");
      queryClient.invalidateQueries({ queryKey: ["/api/barbecues"] });
      queryClient.invalidateQueries({ queryKey: ["/api/explore/events"] });
      if (Number.isFinite(eventIdParam)) {
        setSelectedBbqId(eventIdParam);
        setEventVisibilityTab("public");
      }
    } else if (listing === "cancel") {
      toastWarning("Payment cancelled");
    }

    url.searchParams.delete("listing");
    url.searchParams.delete("session_id");
    window.history.replaceState({}, "", url.toString());
  }, [queryClient, toast]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const payment = url.searchParams.get("payment");
    const sessionId = url.searchParams.get("session_id");
    const eventIdParam = Number(url.searchParams.get("eventId"));
    if (!payment) return;

    const clearPaymentParams = () => {
      url.searchParams.delete("payment");
      url.searchParams.delete("session_id");
      window.history.replaceState({}, "", url.toString());
    };

    if (payment === "cancel") {
      toastWarning("Payment cancelled");
      clearPaymentParams();
      return;
    }

    if (payment !== "success" || !sessionId) {
      clearPaymentParams();
      return;
    }

    if (handledPaymentSessionRef.current === sessionId) {
      clearPaymentParams();
      return;
    }
    handledPaymentSessionRef.current = sessionId;
    clearPaymentParams();

    let cancelled = false;
    void confirmCheckoutSession.mutateAsync({ sessionId })
      .then(async (result) => {
        if (cancelled) return;
        const targetEventId = Number.isFinite(eventIdParam) ? eventIdParam : result.eventId;
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.plans.list() }),
          Number.isFinite(targetEventId) ? queryClient.invalidateQueries({ queryKey: queryKeys.plans.detail(targetEventId) }) : Promise.resolve(),
          Number.isFinite(targetEventId) ? queryClient.invalidateQueries({ queryKey: queryKeys.plans.expenses(targetEventId) }) : Promise.resolve(),
          Number.isFinite(targetEventId) ? queryClient.invalidateQueries({ queryKey: queryKeys.plans.settlements(targetEventId) }) : Promise.resolve(),
          Number.isFinite(targetEventId) ? queryClient.invalidateQueries({ queryKey: queryKeys.plans.settlementLatest(targetEventId) }) : Promise.resolve(),
          Number.isFinite(targetEventId) ? queryClient.invalidateQueries({ queryKey: queryKeys.plans.messages(targetEventId) }) : Promise.resolve(),
        ]);
        await Promise.all([
          Number.isFinite(targetEventId) ? queryClient.refetchQueries({ queryKey: queryKeys.plans.detail(targetEventId) }) : Promise.resolve(),
          Number.isFinite(targetEventId) ? queryClient.refetchQueries({ queryKey: queryKeys.plans.expenses(targetEventId) }) : Promise.resolve(),
          Number.isFinite(targetEventId) ? queryClient.refetchQueries({ queryKey: queryKeys.plans.settlements(targetEventId) }) : Promise.resolve(),
          Number.isFinite(targetEventId) ? queryClient.refetchQueries({ queryKey: queryKeys.plans.settlementLatest(targetEventId) }) : Promise.resolve(),
          Number.isFinite(targetEventId) ? queryClient.refetchQueries({ queryKey: queryKeys.plans.messages(targetEventId) }) : Promise.resolve(),
        ]);
        toastSuccess(result.paymentStatus === "paid" ? "Payment completed" : "Payment confirmation pending");
      })
      .catch((error) => {
        if (cancelled) return;
        if (handledPaymentSessionRef.current === sessionId) {
          handledPaymentSessionRef.current = null;
        }
        const err = error as Error;
        toastWarning(err.message || "Unable to confirm payment");
      })
      .finally(() => {
        if (cancelled && handledPaymentSessionRef.current === sessionId) {
          handledPaymentSessionRef.current = null;
        }
      });

    return () => {
      cancelled = true;
    };
  }, [confirmCheckoutSession.mutateAsync, queryClient, toastSuccess, toastWarning]);

  useEffect(() => {
    if (isAccountDrawerOpen) return;
    setAccountView("profile");
    setDeleteAccountDialogOpen(false);
    setProfileTargetUsername(null);
    setDeleteConfirmPhrase("");
    setSelectedFriendId(null);
    setAddFriendQuery("");
    setAvatarUploadFile(null);
    setAvatarUploadPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setAvatarUploadError(null);
    setAvatarUploadPending(false);
    setUseAvatarUrlInput(false);
    setAvatarDragActive(false);
  }, [isAccountDrawerOpen]);

  useEffect(() => {
    if (!isAccountDrawerOpen) return;
    if (!user) return;
    if (profileTargetUsername) return;
    setDraftBio((user.bio ?? "").slice(0, 160));
    setDraftProfileImageUrl((user.profileImageUrl ?? user.avatarUrl ?? "").trim());
    setAvatarUploadFile(null);
    setAvatarUploadPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setAvatarUploadError(null);
    setAvatarUploadPending(false);
    setUseAvatarUrlInput(false);
    setAvatarDragActive(false);
    setDeleteConfirmPhrase("");
    setSelectedFriendId(null);
  }, [
    isAccountDrawerOpen,
    user?.id,
    user?.bio,
    user?.profileImageUrl,
    user?.avatarUrl,
    profileTargetUsername,
  ]);

  const profileQueryUsername = isAccountDrawerOpen
    ? (profileTargetUsername ?? user?.username ?? null)
    : null;
  const {
    data: profileTargetData,
    isLoading: profileTargetLoading,
    isError: profileTargetError,
    refetch: refetchProfileTarget,
  } = useUserProfile(profileQueryUsername);
  const selectedFriend = useMemo(
    () => friends.find((friend) => friend.userId === selectedFriendId) ?? null,
    [friends, selectedFriendId],
  );
  const {
    data: selectedFriendProfile,
    isLoading: selectedFriendProfileLoading,
    isError: selectedFriendProfileError,
    refetch: refetchSelectedFriendProfile,
  } = useUserProfile(accountView === "friendProfile" ? (selectedFriend?.username ?? null) : null);
  const { data: addFriendResults = [], isLoading: addFriendSearchLoading, isError: addFriendSearchError } = useSearchUsers(addFriendQuery);
  const isViewingOwnAccount = !profileTargetUsername;
  const accountProfileUser = isViewingOwnAccount
    ? {
        id: user?.id ?? profileTargetData?.user.id ?? 0,
        username: user?.username ?? profileTargetData?.user.username ?? "",
        displayName: user?.displayName ?? profileTargetData?.user.displayName ?? null,
        bio: user?.bio ?? profileTargetData?.user.bio ?? null,
        profileImageUrl: user?.profileImageUrl ?? user?.avatarUrl ?? profileTargetData?.user.profileImageUrl ?? profileTargetData?.user.avatarUrl ?? null,
      }
    : profileTargetData?.user ?? null;
  const accountProfileImageSrc = resolveAssetUrl(accountProfileUser?.profileImageUrl);
  const accountFriendsCount = profileTargetData?.stats?.friendsCount ?? friends.length;
  const changePhotoPreview = avatarUploadPreviewUrl
    || (useAvatarUrlInput ? (resolveAssetUrl(draftProfileImageUrl.trim()) ?? "") : "")
    || resolveAssetUrl(user?.profileImageUrl)
    || resolveAssetUrl(user?.avatarUrl)
    || "";
  const hasValidAvatarUrlInput = useMemo(() => {
    if (!useAvatarUrlInput) return false;
    const trimmed = draftProfileImageUrl.trim();
    if (!trimmed) return true;
    const normalized = trimmed.startsWith("/") ? trimmed : (/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    try {
      return !!resolveAssetUrl(normalized);
    } catch {
      return false;
    }
  }, [useAvatarUrlInput, draftProfileImageUrl]);
  const canSaveAvatar = !!avatarUploadFile || hasValidAvatarUrlInput;

  useEffect(() => {
    setAccountAvatarLoadFailed(false);
  }, [accountProfileImageSrc]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  const toVersionToken = (value: string | number | Date | null | undefined) => {
    if (value instanceof Date) return value.getTime();
    return value ?? null;
  };

  const handleAvatarFileChange = (file: File | null) => {
    if (!file) return;
    const isImage = file.type.startsWith("image/");
    if (!isImage) {
      setAvatarUploadError(t.auth.invalidImageType);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarUploadError(t.auth.fileTooLarge);
      return;
    }
    setAvatarUploadPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setAvatarUploadFile(file);
    setAvatarUploadError(null);
    setUseAvatarUrlInput(false);
  };

  useEffect(() => {
    return () => {
      if (avatarUploadPreviewUrl) URL.revokeObjectURL(avatarUploadPreviewUrl);
    };
  }, [avatarUploadPreviewUrl]);

  const {
    data: barbecues = [],
    isLoading: isLoadingBbqs,
    error: barbecuesError,
    refetch: refetchBarbecues,
  } = useBarbecues();
  const privateSuggestedLocations = useMemo(() => {
    const items = barbecues
      .map((event: Barbecue) => {
        const locationName = (event.locationText ?? event.locationName ?? "").trim();
        if (!locationName) return null;
        return {
          locationName,
          city: (event.city ?? locationName).trim(),
          countryCode: (event.countryCode ?? "").trim(),
          countryName: (event.countryName ?? "").trim(),
          lat: event.latitude ?? undefined,
          lng: event.longitude ?? undefined,
        } as LocationOption;
      })
      .filter((item): item is LocationOption => !!item);
    const unique = new Map<string, LocationOption>();
    for (const item of items) {
      const key = item.locationName.toLowerCase();
      if (!unique.has(key)) unique.set(key, item);
    }
    return Array.from(unique.values()).slice(0, 20);
  }, [barbecues]);
  const privateLocationUiText = useMemo(() => ({
    recent: t.privateWizard.locationRecent,
    suggested: t.privateWizard.locationSuggested,
    popular: t.privateWizard.locationPopular,
    clear: t.privateWizard.locationClear,
    noResults: t.privateWizard.locationNoResults,
    useTyped: t.privateWizard.locationUseTyped,
    placeholder: t.privateWizard.locationPlaceholder,
  }), [t.privateWizard]);
  const barbecuesForArea = useMemo(() => barbecues.filter((b: Barbecue) => getEventArea(b) === area), [barbecues, area]);
  const getEventSortTime = (b: Barbecue) => {
    const raw = (b.updatedAt as unknown) ?? (b.date as unknown);
    const t = raw ? new Date(raw as string | number | Date).getTime() : 0;
    return Number.isFinite(t) ? t : 0;
  };
  const privateBarbecuesForArea = useMemo(
    () => barbecuesForArea
      .filter((b: Barbecue) => (b.visibility as string | undefined) !== "public")
      .sort((a: Barbecue, b: Barbecue) => getEventSortTime(b) - getEventSortTime(a)),
    [barbecuesForArea]
  );
  const publicBarbecuesForArea = useMemo(
    () => barbecuesForArea
      .filter((b: Barbecue) => (b.visibility as string | undefined) === "public")
      .sort((a: Barbecue, b: Barbecue) => {
        const aActive = a.publicListingStatus === "active" && !!a.publicListingExpiresAt && new Date(a.publicListingExpiresAt).getTime() > Date.now();
        const bActive = b.publicListingStatus === "active" && !!b.publicListingExpiresAt && new Date(b.publicListingExpiresAt).getTime() > Date.now();
        if (aActive !== bActive) return aActive ? -1 : 1;
        return getEventSortTime(b) - getEventSortTime(a);
      }),
    [barbecuesForArea]
  );
  // Keep Friends plans overview aligned with sidebar dataset:
  // all private plans the user can access, independent of area filter.
  const privatePlansForOverview = useMemo(
    () => barbecues
      .filter((b: Barbecue) => isPrivateEventVisibility(b))
      .sort((a: Barbecue, b: Barbecue) => getEventSortTime(b) - getEventSortTime(a)),
    [barbecues]
  );
  const sortedPrivatePlansForOverview = useMemo(() => {
    const items = [...privatePlansForOverview] as BarbecueListItem[];
    if (privatePlanSort === "date") {
      return items.sort((a, b) => {
        const aDate = a.date ? new Date(a.date).getTime() : 0;
        const bDate = b.date ? new Date(b.date).getTime() : 0;
        if (aDate !== bDate) return bDate - aDate;
        return getEventSortTime(b) - getEventSortTime(a);
      });
    }
    return items.sort((a, b) => {
      const aRecent = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : getEventSortTime(a);
      const bRecent = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : getEventSortTime(b);
      return bRecent - aRecent;
    });
  }, [privatePlanSort, privatePlansForOverview]);
  const listBarbecuesForArea = eventVisibilityTab === "private" ? privateBarbecuesForArea : publicBarbecuesForArea;
  const formatPlanSharedTotal = useCallback((amount: number, currencyCode?: string | null) => {
    const safeAmount = Number.isFinite(amount) ? amount : 0;
    const code = String(currencyCode ?? "").trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(code)) {
      try {
        return new Intl.NumberFormat(undefined, { style: "currency", currency: code }).format(safeAmount);
      } catch {
        // fall through
      }
    }
    return `€${safeAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, []);
  const formatLastActivity = useCallback((value: string | Date | null | undefined) => {
    if (!value) return "Active recently";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "Active recently";
    const diffMs = Date.now() - date.getTime();
    if (!Number.isFinite(diffMs) || diffMs < 0) return "Active just now";
    const minutes = Math.floor(diffMs / 60_000);
    if (minutes < 1) return "Active just now";
    if (minutes < 60) return `Active ${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Active ${hours}h ago`;
    if (hours < 48) return "Active yesterday";
    const days = Math.floor(hours / 24);
    return `Active ${days}d ago`;
  }, []);
  const allEventsForArea = useMemo(
    () => [...barbecuesForArea].sort((a: Barbecue, b: Barbecue) => {
      const aRecentIdx = recentEventIds.indexOf(a.id);
      const bRecentIdx = recentEventIds.indexOf(b.id);
      const aRecentRank = aRecentIdx === -1 ? Number.MAX_SAFE_INTEGER : aRecentIdx;
      const bRecentRank = bRecentIdx === -1 ? Number.MAX_SAFE_INTEGER : bRecentIdx;
      if (aRecentRank !== bRecentRank) return aRecentRank - bRecentRank;
      return getEventSortTime(b) - getEventSortTime(a);
    }),
    [barbecuesForArea, recentEventIds]
  );
  const allEventsFilteredForArea = useMemo(() => {
    const q = allEventsSearch.trim().toLowerCase();
    if (!q) return allEventsForArea;
    return allEventsForArea.filter((b: Barbecue) =>
      [b.name, b.city, b.countryName, b.organizationName]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [allEventsForArea, allEventsSearch]);
  const createBbq = useCreateBarbecue();
  const deleteBbq = useDeleteBarbecue();
  const leaveBbq = useLeaveBarbecue();
  const updateBbq = useUpdateBarbecue();
  const uploadEventBanner = useUploadEventBanner(activeEventId);
  const deleteEventBanner = useDeleteEventBanner(activeEventId);
  const ensureInviteToken = useEnsureInviteToken();
  const settleUp = useSettleUp();
  const checkoutPublicListing = useCheckoutPublicListing();
  const deactivateListing = useDeactivateListing();
  const selectedPlanQuery = usePlan(activeEventId);

  const selectedBbq = selectedPlanQuery.data
    ?? barbecuesForArea.find((b: Barbecue) => Number(b.id) === activeEventId)
    ?? (barbecues.find((b: Barbecue) => Number(b.id) === activeEventId) || null);
  const removePlanFromClientState = useCallback((planId: number) => {
    // Only clear local UI references. Authoritative plans list should come from server refetch.
    setPinnedEventIds((prev) => prev.filter((id) => id !== planId));
    setRecentEventIds((prev) => prev.filter((id) => id !== planId));
    if (typeof window !== "undefined") {
      const sidebarRecentKey = `splanno.sidebar.recent-opened.v1:${user?.id ?? user?.username ?? "anon"}`;
      try {
        const parsed = JSON.parse(localStorage.getItem(sidebarRecentKey) ?? "[]");
        if (Array.isArray(parsed)) {
          const next = parsed.filter((id): id is number => Number.isInteger(id) && id !== planId);
          localStorage.setItem(sidebarRecentKey, JSON.stringify(next));
        }
      } catch {
        // ignore malformed local state
      }
    }
  }, [user?.id, user?.username]);

  useEffect(() => {
    if (!barbecues.length) return;
    const validIds = new Set(
      barbecues
        .map((plan) => Number(plan.id))
        .filter((id) => Number.isFinite(id))
    );
    setPinnedEventIds((prev) => prev.filter((id) => validIds.has(id)));
    setRecentEventIds((prev) => prev.filter((id) => validIds.has(id)));
    if (selectedBbqId != null && !validIds.has(selectedBbqId)) {
      setSelectedBbqId(null);
    }
  }, [barbecues, selectedBbqId]);
  const eventViewRef = useRef<HTMLDivElement | null>(null);
  const resolvedDashboardBannerUrl = useMemo(() => {
    if (!selectedBbq) return null;
    return withCacheBust(
      resolveAssetUrl(selectedBbq.bannerImageUrl),
      toVersionToken((selectedBbq as { updatedAt?: string | Date | null }).updatedAt ?? selectedBbq.id),
    ) ?? null;
  }, [selectedBbq?.id, selectedBbq?.bannerImageUrl, selectedBbq?.updatedAt]);

  useEffect(() => {
    setDashboardHeroBannerFailed(false);
    setPrivateHeroBannerFailed(false);
    setPublicOverviewBannerFailed(false);
  }, [selectedBbq?.id, selectedBbq?.bannerImageUrl]);

  useEffect(() => {
    let cancelled = false;
    if (!resolvedDashboardBannerUrl) {
      setDisplayedDashboardHeroBannerUrl(null);
      return () => {
        cancelled = true;
      };
    }
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      setDisplayedDashboardHeroBannerUrl(resolvedDashboardBannerUrl);
      setDashboardHeroBannerFailed(false);
    };
    img.onerror = () => {
      if (cancelled) return;
      setDashboardHeroBannerFailed(true);
    };
    img.src = resolvedDashboardBannerUrl;
    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [resolvedDashboardBannerUrl]);

  useEffect(() => {
    setDashboardHeroImageLoaded(false);
  }, [selectedBbq?.id, displayedDashboardHeroBannerUrl]);

  useLayoutEffect(() => {
    if (!isManagedAppRoute || appRouteMode !== "event" || !routeEventId) return;
    setSelectedBbqId(routeEventId);
  }, [isManagedAppRoute, appRouteMode, routeEventId]);

  useEffect(() => {
    if (!isManagedAppRoute || appRouteMode !== "event") {
      lastManagedRouteEventIdRef.current = null;
      return;
    }

    const previousEventId = lastManagedRouteEventIdRef.current;
    const nextEventId = routeEventId ?? null;
    lastManagedRouteEventIdRef.current = nextEventId;

    if (!nextEventId || previousEventId == null || previousEventId === nextEventId) return;

    closePanel();
    setActiveSurface("chat");
    setIsPlanDetailsOpen(false);
    setIsPlanTypeOpen(false);
    setIsActivityDrawerOpen(false);
    setIsAddExpenseOpen(false);
    setIsAddPersonOpen(false);
    setRecommendedExpenseTemplate(null);
    setEditingExpense(null);
    setEditingParticipantId(null);
    setPublicInboxConversationId(null);
    setPublicInboxDraft("");
    setAllEventsSelectorOpen(false);
    setEditTripLocationOpen(false);
    setEventSettingsOpen(false);
    setDashboardHeroBannerFailed(false);
    setDashboardHeroImageLoaded(false);
    setDisplayedDashboardHeroBannerUrl(null);
    setPrivateHeroBannerFailed(false);
    setPublicOverviewBannerFailed(false);
    desktopOverviewInitializedForEventRef.current = null;
  }, [appRouteMode, closePanel, isManagedAppRoute, routeEventId]);

  useEffect(() => {
    setIsMobileChatOpen(false);
  }, [selectedBbq?.id, appRouteMode]);

  useEffect(() => {
    if (!isManagedAppRoute || appRouteMode !== "event") return;
    if (!selectedBbq) return;
    setEventVisibilityTab(isPublicEvent(selectedBbq) ? "public" : "private");
  }, [isManagedAppRoute, appRouteMode, selectedBbq]);

  useEffect(() => {
    if (!useNewManagedEventLayout || !isManagedAppRoute || appRouteMode !== "event") return;
    if (!selectedBbq || selectedBbq.isPublic) return;

    const eventId = Number(selectedBbq.id);
    if (!Number.isFinite(eventId) || desktopOverviewInitializedForEventRef.current === eventId) return;

    const isDesktop = typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
    desktopOverviewInitializedForEventRef.current = eventId;

    if (isDesktop) {
      openPanel({ type: "overview" });
      return;
    }

    closePanel();
  }, [
    appRouteMode,
    closePanel,
    isManagedAppRoute,
    openPanel,
    selectedBbq,
    useNewManagedEventLayout,
  ]);
  const selectedEventLabel = selectedBbq?.name ?? "All events";
  const customCategories = useMemo(
    () => (getTemplateData(selectedBbq, defaultBarbecueTemplateData) as BarbecueTemplateData).customCategories ?? [],
    [selectedBbq],
  );
  const handleAddCustomCategory = (name: string) => {
    if (!selectedBbqId || !selectedBbq || !isCreator) return;
    const current = (selectedBbq.templateData as Record<string, unknown>) ?? {};
    const currentCustom = Array.isArray(current.customCategories) ? current.customCategories : [];
    if (currentCustom.includes(name)) return;
    updateBbq.mutate({
      id: selectedBbqId,
      templateData: { ...current, customCategories: [...currentCustom, name] },
    });
  };
  const defaultCurrency = ((user?.defaultCurrencyCode as CurrencyCode | undefined) ?? "EUR");
  const currency = (selectedBbq?.currency as CurrencyCode) || defaultCurrency;
  const currencyInfo = getCurrency(currency) ?? getCurrency("EUR")!;
  const [displayCurrency, setDisplayCurrency] = useState<CurrencyCode>(currency);
  const displayCurrencyInfo = getCurrency(displayCurrency) ?? getCurrency("EUR")!;
  const isCreator = !!(user?.id && selectedBbq?.creatorUserId === user.id);
  const isPrivate = selectedBbq ? !selectedBbq.isPublic : false;
  const isPrivateContext = !!selectedBbq && isPrivate;
  const isPublicBuilderContext = isPublicEvent(selectedBbq);
  const showPrivateChatTab = import.meta.env.VITE_ENABLE_PRIVATE_CHAT === "true";
  const privateMood = getCircleMoodTokens(isPrivateContext ? getCirclePersonalityFromEvent(selectedBbq) : "minimal");

  const planCrewQuery = usePlanCrew(activeEventId);
  const participants = planCrewQuery.data?.participants ?? [];
  const eventMembers = planCrewQuery.data?.members ?? [];
  const usernameByUserId = useMemo(() => {
    const map = new Map<number, string>();
    for (const member of eventMembers) {
      if (member.userId && member.username) map.set(member.userId, member.username);
    }
    return map;
  }, [eventMembers]);
  const expensesQuery = usePlanExpenses(activeEventId);
  const expenses = expensesQuery.data ?? [];
  const { data: realtimeBalancesSnapshot } = useRealtimePlanBalances(activeEventId);
  const [showLocalSuggestionsModal, setShowLocalSuggestionsModal] = useState(false);
  const [privateSuggestionState, setPrivateSuggestionState] = useState(defaultPrivateSuggestionState());
  const { data: expenseSharesList = [] } = useExpenseShares(selectedBbq?.allowOptInExpenses ? activeEventId : null);
  const setExpenseShare = useSetExpenseShare(activeEventId);
  const { data: pendingRequests = [] } = usePendingRequests(isCreator ? activeEventId : null);
  const { data: publicRsvpRequests = [] } = usePublicEventRsvpRequests(activeEventId, isCreator && isPublicBuilderContext);
  const updatePublicRsvpRequest = useUpdatePublicEventRsvpRequest(activeEventId);
  const publicInboxList = useConversations(isCreator && isPublicBuilderContext ? activeEventId : null);
  const publicInboxThread = useConversation(publicInboxConversationId, isCreator && isPublicBuilderContext && activeEventTab === "inbox" && !!publicInboxConversationId);
  const sendPublicInboxMessage = useSendConversationMessage(publicInboxConversationId);
  const updateConversationStatus = useUpdateConversationStatus(publicInboxConversationId);
  const publicInboxConversations = (publicInboxList.data?.conversations ?? []).filter((c) => c.barbecueId === activeEventId);
  const { data: invitedParticipants = [] } = useInvitedParticipants(isPrivate ? activeEventId : null);
  const { items: planActivityItems, unreadCount: planActivityUnreadCount, loading: planActivityLoading, highlightedId: highlightedActivityId, markAllAsRead } =
    usePlanActivity(selectedBbq?.id ?? null, !!selectedBbq?.id && isPrivateContext);
  const { data: memberships = [] } = useMemberships(username);
  const privateSuggestionsEligible = isEligibleForLocalSuggestions({
    city: selectedBbq?.city ?? null,
    locationName: selectedBbq?.locationName ?? null,
    startAt: selectedBbq?.date ?? null,
    area: selectedBbq?.area ?? null,
    eventType: selectedBbq?.eventType ?? null,
  });
  const exploreSuggestionsQuery = useExploreEvents(isPrivateContext && privateSuggestionsEligible);

  const deleteParticipant = useDeleteParticipant(activeEventId);
  const updateParticipantName = useUpdateParticipantName(activeEventId);
  const deleteExpense = useDeleteExpense(activeEventId);
  const joinBbq = useJoinBarbecue();
  const acceptParticipant = useAcceptParticipant(activeEventId);
  const rejectParticipant = useRejectParticipant(activeEventId);
  const inviteParticipant = useInviteParticipant(activeEventId);
  const acceptInvite = useAcceptInvite();
  const declineInvite = useDeclineInvite();

  useEffect(() => {
    if (appRouteMode !== "event" || !selectedBbqId || !isPrivateContext) return;
    if (lastActivityReadEventRef.current === selectedBbqId) return;
    lastActivityReadEventRef.current = selectedBbqId;
    queryClient.setQueryData(queryKeys.plans.list(), (prev: unknown) => {
      if (!Array.isArray(prev)) return prev;
      return prev.map((plan) => {
        if (!plan || typeof plan !== "object") return plan;
        const currentId = Number((plan as { id?: number }).id);
        if (!Number.isFinite(currentId) || currentId !== selectedBbqId) return plan;
        return { ...(plan as Record<string, unknown>), unreadCount: 0 };
      });
    });
    void markAllAsRead();
  }, [appRouteMode, isPrivateContext, markAllAsRead, queryClient, selectedBbqId]);

  useEffect(() => {
    if (appRouteMode !== "event" || !selectedBbqId || !isPrivateContext) return;
    if (planActivityUnreadCount <= 0) return;
    if (activityReadDebounceRef.current != null) {
      window.clearTimeout(activityReadDebounceRef.current);
      activityReadDebounceRef.current = null;
    }
    activityReadDebounceRef.current = window.setTimeout(() => {
      void markAllAsRead();
      activityReadDebounceRef.current = null;
    }, 700);
    return () => {
      if (activityReadDebounceRef.current != null) {
        window.clearTimeout(activityReadDebounceRef.current);
        activityReadDebounceRef.current = null;
      }
    };
  }, [appRouteMode, isPrivateContext, markAllAsRead, planActivityUnreadCount, queryClient, selectedBbqId]);

  useEffect(() => {
    setDisplayCurrency(currency);
  }, [currency]);

  useEffect(() => {
    if (!selectedBbq) return;
    if (isPublicBuilderContext) {
      if (activeEventTab === "split") {
        setActiveEventTab("overview");
        if (publicSplitGuardedEventRef.current !== selectedBbq.id) {
          toastInfo("Split Check is available only for private events.");
          publicSplitGuardedEventRef.current = selectedBbq.id;
        }
        return;
      }
      const valid = new Set(["overview", "attendees", "content"]);
      if (isCreator) valid.add("inbox");
      if (!valid.has(activeEventTab)) setActiveEventTab("overview");
      return;
    }
    const valid = new Set(["expenses", "people", "split", "notes"]);
    if (showPrivateChatTab) valid.add("chat");
    if (!valid.has(activeEventTab)) setActiveEventTab("expenses");
  }, [selectedBbq?.id, isPublicBuilderContext, activeEventTab, isCreator, showPrivateChatTab, toast]);

  useEffect(() => {
    if (!selectedBbqId) {
      setPrivateSuggestionState(defaultPrivateSuggestionState());
      return;
    }
    setPrivateSuggestionState(loadPrivateSuggestionState(selectedBbqId));
  }, [selectedBbqId]);

  useEffect(() => {
    if (!selectedBbqId) return;
    savePrivateSuggestionState(selectedBbqId, privateSuggestionState);
  }, [selectedBbqId, privateSuggestionState]);

  useEffect(() => {
    if (import.meta.env.PROD) return;
    if (!selectedBbq || !eventViewRef.current) return;
    const text = eventViewRef.current.textContent ?? "";
    const has = (needle: string) => text.includes(needle);
    if (isPrivateContext) {
      const leaks = ["Pending publish", "Public mode", "Open public page"].filter(has);
      if (leaks.length > 0) {
        console.error("[private-event-ui-invariant] Public-only copy leaked into private event UI", {
          eventId: selectedBbq.id,
          leaks,
        });
      }
      return;
    }
    if (isPublicBuilderContext) {
      const leaks = ["Split Check", "Settle up"].filter(has);
      if (leaks.length > 0) {
        console.error("[public-event-ui-invariant] Private-only copy leaked into public event UI", {
          eventId: selectedBbq.id,
          leaks,
        });
      }
    }
  }, [selectedBbq?.id, isPrivateContext, isPublicBuilderContext, activeEventTab]);

  const getMembershipStatus = (bbqId: number): { status: string; participantId: number } | null => {
    const m = memberships.find(m => m.bbqId === bbqId);
    return m ? { status: m.status, participantId: m.participantId } : null;
  };

  const formatMoney = (amount: number) => {
    if (!Number.isFinite(amount)) return `${displayCurrencyInfo.symbol}—`;
    const converted = convertCurrency(amount, currency, displayCurrency);
    const num = Number.isFinite(converted) ? converted : 0;
    return `${displayCurrencyInfo.symbol}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  const formatHeroDateEnglish = (value: string | Date | null | undefined) => {
    if (!value) return "Date TBA";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "Date TBA";
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  };
  const totalSpent = expenses.reduce(
    (sum: number, exp: ExpenseWithParticipant) => sum + (Number.isFinite(Number(exp.amount)) ? Number(exp.amount) : 0),
    0
  );
  const splitExpenses = useMemo(
    () => expenses.map((expense: ExpenseWithParticipant) => ({ ...expense, amount: Number(expense.amount || 0) })),
    [expenses],
  );
  const participantCount = participants.length;
  const allowOptIn = isPrivateContext && !!selectedBbq?.allowOptInExpenses;
  const hasCustomIncludedUsers = expenses.some((expense: ExpenseWithParticipant) => parseIncludedUserIds(expense.includedUserIds).length > 0);
  const shouldUseCustomSplit = allowOptIn || hasCustomIncludedUsers;
  const effectiveExpenseShares = useMemo(() => {
    const participantIds = participants.map((participant: Participant) => participant.id);
    const legacyByExpense = new Map<number, number[]>();
    for (const share of expenseSharesList) {
      const current = legacyByExpense.get(share.expenseId);
      if (current) current.push(share.participantId);
      else legacyByExpense.set(share.expenseId, [share.participantId]);
    }
    const rows: Array<{ expenseId: number; participantId: number }> = [];
    for (const expense of expenses) {
      const parsedIncludedIds = parseIncludedUserIds(expense.includedUserIds);
      if (parsedIncludedIds.length > 0) {
        const ids = parsedIncludedIds
          .map((value: string) => Number(value))
          .filter((value: number) => Number.isInteger(value) && participantIds.includes(value));
        for (const participantId of ids) rows.push({ expenseId: expense.id, participantId });
        continue;
      }
      if (allowOptIn) {
        const legacy = legacyByExpense.get(expense.id) ?? [];
        for (const participantId of legacy) rows.push({ expenseId: expense.id, participantId });
        continue;
      }
      if (hasCustomIncludedUsers) {
        for (const participantId of participantIds) rows.push({ expenseId: expense.id, participantId });
      }
    }
    return rows;
  }, [allowOptIn, expenseSharesList, expenses, hasCustomIncludedUsers, participants]);
  const shareSet = new Set(effectiveExpenseShares.map((s) => `${s.expenseId}:${s.participantId}`));
  const _getFairShareForParticipant = (participantId: number) =>
    getFairShareForParticipant(participantId, splitExpenses, effectiveExpenseShares, participants, shouldUseCustomSplit);
  const myParticipant = user?.id ? participants.find((p: Participant) => p.userId === user.id) : null;
  const creatorLeaveSuccessorName = useMemo(() => {
    if (!selectedBbqId || !user?.id) return null;
    const successor = [...eventMembers]
      .filter((member) => member.userId !== user.id)
      .sort((a, b) => {
        const aJoined = a.joinedAt ? new Date(a.joinedAt).getTime() : Number.MAX_SAFE_INTEGER;
        const bJoined = b.joinedAt ? new Date(b.joinedAt).getTime() : Number.MAX_SAFE_INTEGER;
        return aJoined - bJoined;
      })[0];
    return successor?.name ?? null;
  }, [eventMembers, selectedBbqId, user?.id]);
  const fairShare = myParticipant ? _getFairShareForParticipant(myParticipant.id) : (participantCount > 0 ? totalSpent / participantCount : 0);

  const canLeave = (p: Participant) => {
    if (p.userId !== username) return false;
    if (!selectedBbq?.startDate && !selectedBbq?.date) return false;
    const bbqDate = new Date(selectedBbq.startDate ?? selectedBbq.date ?? "");
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return bbqDate >= today;
  };
  const visibleExploreSuggestions = useMemo(() => {
    if (!isPrivateContext || !selectedBbq || !privateSuggestionsEligible || !privateSuggestionState.enabled || privateSuggestionState.muted) return [] as ExploreEvent[];
    const base = privateSuggestionState.cachedResults ?? [];
    return base.filter((e) => !privateSuggestionState.dismissedIds.includes(e.id));
  }, [isPrivateContext, selectedBbq, privateSuggestionsEligible, privateSuggestionState]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedBbqId || !isPrivateContext || !selectedBbq || !privateSuggestionsEligible || !privateSuggestionState.enabled || privateSuggestionState.muted) return;
    if (isSuggestionCacheFresh(privateSuggestionState.lastFetchedAt) && (privateSuggestionState.cachedResults?.length ?? 0) > 0) return;
    const sourceEvents = (exploreSuggestionsQuery.data ?? []) as ExploreEvent[];
    if (!sourceEvents.length) return;

    getNearbyPublicEvents({
      city: selectedBbq.city ?? null,
      startAt: selectedBbq.startDate ?? selectedBbq.date ?? new Date().toISOString(),
      endAt: selectedBbq.endDate ?? selectedBbq.startDate ?? selectedBbq.date ?? null,
      radiusKm: 25,
      sourceEvents,
    }).then((results) => {
      if (cancelled) return;
      setPrivateSuggestionState((prev) => ({
        ...prev,
        lastFetchedAt: Date.now(),
        cachedResults: results.slice(0, 10),
      }));
    }).catch(() => {
      // fail quietly (serendipity layer only)
    });

    return () => { cancelled = true; };
  }, [
    selectedBbqId,
    isPrivateContext,
    selectedBbq,
    privateSuggestionsEligible,
    privateSuggestionState.enabled,
    privateSuggestionState.muted,
    privateSuggestionState.lastFetchedAt,
    privateSuggestionState.cachedResults,
    exploreSuggestionsQuery.data,
  ]);

  const inlineExploreSuggestions = visibleExploreSuggestions.slice(0, 3);
  const modalExploreSuggestions = visibleExploreSuggestions.slice(0, 10);
  const localSuggestionsMuted = privateSuggestionState.muted || privateSuggestionState.dismissedIds.length >= 3;

  useEffect(() => {
    if (!selectedBbqId) return;
    if (privateSuggestionState.dismissedIds.length >= 3 && !privateSuggestionState.muted) {
      setPrivateSuggestionState((prev) => ({ ...prev, muted: true }));
    }
  }, [selectedBbqId, privateSuggestionState.dismissedIds.length, privateSuggestionState.muted]);
  const getParticipantInitials = (name: string) =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?";
  const suggestionDeviceId = useMemo(() => getOrCreateSuggestionDeviceId(), []);
  const suggestionVoterKey = user?.id ? `uid:${user.id}` : `dev:${suggestionDeviceId ?? "anon"}`;
  const suggestionVoterLabel = ((): string => {
    if (user?.id) {
      const participant = participants.find((p: Participant) => p.userId === user.id);
      return participant?.name || user?.displayName || username || "You";
    }
    return user?.displayName || "You";
  })();
  const setSuggestionVote = (suggestionId: number, vote: SuggestionVote | null) => {
    setPrivateSuggestionState((prev) => {
      const key = String(suggestionId);
      const current = { ...(prev.votesBySuggestionId[key] ?? {}) };
      if (vote == null) {
        delete current[suggestionVoterKey];
      } else {
        current[suggestionVoterKey] = { vote, label: suggestionVoterLabel };
      }
      return {
        ...prev,
        votesBySuggestionId: {
          ...prev.votesBySuggestionId,
          [key]: current,
        },
      };
    });
  };
  useEffect(() => {
    if (!selectedBbqId) return;
    if (!username && !user?.id) return;
    const legacyKeys = [username ? `user:${username}` : null, user?.id ? `guest:${user.id}` : null].filter(Boolean) as string[];
    if (legacyKeys.length === 0) return;
    setPrivateSuggestionState((prev) => {
      let changed = false;
      const nextVotesBySuggestionId = { ...prev.votesBySuggestionId };
      for (const [suggestionId, voteMap] of Object.entries(prev.votesBySuggestionId)) {
        const nextVoteMap = { ...voteMap };
        for (const legacyKey of legacyKeys) {
          if (nextVoteMap[suggestionVoterKey] || !nextVoteMap[legacyKey]) continue;
          nextVoteMap[suggestionVoterKey] = nextVoteMap[legacyKey];
          delete nextVoteMap[legacyKey];
          changed = true;
        }
        nextVotesBySuggestionId[suggestionId] = nextVoteMap;
      }
      return changed ? { ...prev, votesBySuggestionId: nextVotesBySuggestionId } : prev;
    });
  }, [selectedBbqId, username, user?.id, suggestionVoterKey]);

  const suggestionVoteSummaryById = useMemo(() => {
    const result: Record<number, {
      all: Array<{ userKey: string; vote: SuggestionVote; label: string; legacy: boolean }>;
      up: Array<{ userKey: string; vote: SuggestionVote; label: string; legacy: boolean }>;
      maybe: Array<{ userKey: string; vote: SuggestionVote; label: string; legacy: boolean }>;
      down: Array<{ userKey: string; vote: SuggestionVote; label: string; legacy: boolean }>;
      mine: SuggestionVote | null;
    }> = {};
    for (const [suggestionId, rawVoteMap] of Object.entries(privateSuggestionState.votesBySuggestionId)) {
      const all = Object.entries(rawVoteMap ?? {}).map(([userKey, value]) => {
        const legacy = !userKey.startsWith("uid:") && !userKey.startsWith("dev:");
        const fallbackLabel =
          userKey.replace(/^user:/, "").replace(/^guest:/, "Guest").replace(/^uid:/, "User").replace(/^dev:/, "This device");
        return {
          userKey,
          vote: value.vote as SuggestionVote,
          label: `${value.label ?? fallbackLabel}${legacy ? " (legacy)" : ""}`,
          legacy,
        };
      });
      result[Number(suggestionId)] = {
        all,
        up: all.filter((v) => v.vote === "up"),
        maybe: all.filter((v) => v.vote === "maybe"),
        down: all.filter((v) => v.vote === "down"),
        mine: all.find((v) => v.userKey === suggestionVoterKey)?.vote ?? null,
      };
    }
    return result;
  }, [privateSuggestionState.votesBySuggestionId, suggestionVoterKey]);
  const getSuggestionVotes = (suggestionId: number) =>
    suggestionVoteSummaryById[suggestionId] ?? { all: [], up: [], maybe: [], down: [], mine: null };

  const expensesByCategory = expenses.reduce((acc: Record<string, number>, exp: ExpenseWithParticipant) => {
    acc[exp.category] = (acc[exp.category] || 0) + Number(exp.amount);
    return acc;
  }, {} as Record<string, number>);

  const chartData = (Object.entries(expensesByCategory) as [string, number][]).map(([name, value]) => ({
    name, value, translatedName: t.categories[name as keyof typeof t.categories] || name
  })).filter(d => d.value > 0);

  const { balances, settlements } = useMemo(() => {
    if (realtimeBalancesSnapshot?.planId === selectedBbqId) {
      return {
        balances: realtimeBalancesSnapshot.balances,
        settlements: realtimeBalancesSnapshot.suggestedPaybacks,
      };
    }
    if (!selectedBbqId) {
      return computeSplit(participants, splitExpenses, effectiveExpenseShares, shouldUseCustomSplit);
    }
    return measurePlanSwitchPerf(
      selectedBbqId,
      "balances",
      () => computeSplit(participants, splitExpenses, effectiveExpenseShares, shouldUseCustomSplit),
    );
  }, [effectiveExpenseShares, participants, realtimeBalancesSnapshot, selectedBbqId, shouldUseCustomSplit, splitExpenses]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (appRouteMode !== "event" || !selectedBbqId || !selectedBbq || !isPrivateContext) return;
    if (isLoadingBbqs || selectedPlanQuery.isLoading || planCrewQuery.isLoading || expensesQuery.isLoading) return;
    const rafId = window.requestAnimationFrame(() => {
      markPlanSwitchPerf(selectedBbqId, "event view interactive", {
        planName: selectedBbq.name,
        participants: participants.length,
        expenses: expenses.length,
      });
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [
    appRouteMode,
    expenses.length,
    expensesQuery.isLoading,
    isLoadingBbqs,
    isPrivateContext,
    participants.length,
    planCrewQuery.isLoading,
    selectedBbq,
    selectedBbqId,
    selectedPlanQuery.isLoading,
  ]);
  useLayoutEffect(() => {
    if (!import.meta.env.DEV) return;
    if (appRouteMode !== "event" || !selectedBbqId || !selectedBbq || !isPrivateContext) return;
    markPlanSwitchPerf(selectedBbqId, "event view first render commit", {
      planName: selectedBbq.name,
    });
  }, [appRouteMode, isPrivateContext, selectedBbq, selectedBbqId]);
  const lastExpenseForRepeat = useMemo(() => {
    if (!expenses.length) return null;
    return [...expenses].sort((a: ExpenseWithParticipant, b: ExpenseWithParticipant) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (aTime !== bTime) return bTime - aTime;
      return b.id - a.id;
    })[0] ?? null;
  }, [expenses]);

  const handleJoin = (bbqId: number) => {
    if (!username || !user?.id) return;
    joinBbq.mutate({ bbqId, name: username, userId: Number(user.id) }, {
      onSuccess: () => toastInfo(`${t.user.joinBbq}. ${t.user.pending}...`),
      onError: (err: unknown) => {
        if (err instanceof UpgradeRequiredError) { showUpgrade(err.payload); return; }
        const msg = (err as Error).message;
        if (msg === "already_joined") toastInfo(t.user.joined);
        else if (msg === "already_pending") toastInfo(t.user.pending);
        else toastError("Couldn’t join event. Try again.");
      },
    });
  };

  const handleDiscoverJoin = (bbq: Barbecue) => {
    if (!username || !user?.id) return;
    joinBbq.mutate(
      { bbqId: bbq.id, name: username, userId: Number(user.id) },
      {
        onSuccess: () => {
          toastInfo(`${t.user.joinBbq}. ${t.user.pending}...`);
          queryClient.invalidateQueries({ queryKey: ["/api/barbecues"] });
          queryClient.invalidateQueries({ queryKey: ["/api/barbecues/public"] });
          setSelectedBbqId(bbq.id);
          setArea(getEventArea(bbq));
          setDiscoverOpen(false);
        },
        onError: (err: unknown) => {
          if (err instanceof UpgradeRequiredError) { showUpgrade(err.payload); return; }
          const msg = (err as Error).message;
          if (msg === "already_joined") toastInfo(t.user.joined);
          else if (msg === "already_pending") toastInfo(t.user.pending);
          else toastError("Couldn’t join event. Try again.");
        },
      }
    );
  };

  const handleCreateBbq = () => {
    if (!newBbqName.trim()) return;
    if (!newEventLocation?.locationName.trim()) {
      setNewEventLocationTouched(true);
      toastError("Location is required.");
      return;
    }
    const forcePrivateCreate = appRouteMode === "private";
    const requestedPublicOnCreate = forcePrivateCreate ? false : newBbqIsPublic;
    const requestedPublicModeOnCreate = forcePrivateCreate ? "marketing" : newBbqPublicMode;
    const requestedVisibilityOriginOnCreate = forcePrivateCreate ? "private" : newBbqVisibilityOrigin;
    // Template-specific default data at creation time
    let templateData: unknown | null = null;
    if (newEventType === "barbecue") {
      templateData = defaultBarbecueTemplateData;
    } else if (newEventType === "birthday") {
      templateData = defaultBirthdayTemplateData;
    }
    if (requestedVisibilityOriginOnCreate === "public") {
      const baseTemplate = (templateData && typeof templateData === "object") ? templateData as Record<string, unknown> : {};
      templateData = {
        ...baseTemplate,
        publicCategory: newEventPublicCategory,
        publicSubtitle: newPublicSubtitle.trim() || null,
        publicListOnExplore: newPublicListOnExplore,
        publicCapacity: newPublicCapacity ? Number(newPublicCapacity) : null,
        publicExternalLink: newPublicExternalLink.trim() || null,
        publicRsvpTiers: newPublicRsvpTiers
          .map((tier) => ({
            id: tier.id,
            name: tier.name.trim(),
            description: tier.description.trim() || null,
            priceLabel: tier.isFree ? null : (tier.priceLabel.trim() || null),
            capacity: tier.capacity ? Number(tier.capacity) : null,
            isFree: tier.isFree,
          }))
          .filter((tier) => tier.name),
      };
    } else {
      const baseTemplate = (templateData && typeof templateData === "object") ? templateData as Record<string, unknown> : {};
      const selectedPrivateSubcategory = [...TRIP_SUBCATEGORIES, ...PARTY_SUBCATEGORIES].find((item) => item.id === newPlanSubCategory) ?? null;
      templateData = {
        ...baseTemplate,
        personality: getDefaultCirclePersonality({ area: newEventArea, eventType: newEventType }),
        mainCategory: newPlanMainCategory ?? "party",
        subCategory: newPlanSubCategory ?? "barbecue",
        privateMainCategory: newPlanMainCategory ?? "party",
        privateSubCategory: newPlanSubCategory ?? "barbecue",
        privateEventTypeId: newPlanSubCategory ?? "barbecue",
        privateTemplateId: newPrivateTemplateId,
        emoji: selectedPrivateSubcategory?.emoji ?? selectedCreatePrivateTemplate.emoji,
      };
    }
    const payload: Parameters<typeof createBbq.mutate>[0] & { currencySource?: "auto" | "manual" } = {
      name: newBbqName.trim(),
      date: new Date(`${newBbqDate}T${newBbqTime || "19:00"}`).toISOString(),
      creatorUserId: user?.id || undefined,
      isPublic: false,
      visibility: "private",
      visibilityOrigin: requestedVisibilityOriginOnCreate,
      publicMode: requestedPublicModeOnCreate,
      publicTemplate: requestedVisibilityOriginOnCreate === "public" ? newPublicTemplate : undefined,
      allowOptInExpenses: newBbqAllowOptIn,
      area: newEventArea,
      eventType: newEventType,
      templateData,
      status: requestedVisibilityOriginOnCreate === "public" ? "draft" : undefined,
      organizationName: requestedVisibilityOriginOnCreate === "public" ? (newPublicOrganizationName.trim() || null) : undefined,
      publicDescription: requestedVisibilityOriginOnCreate === "public" ? (newPublicDescription.trim() || null) : undefined,
      bannerImageUrl: requestedVisibilityOriginOnCreate === "public" ? (newPublicBannerUrl.trim() || null) : undefined,
      publicListFromAt: requestedVisibilityOriginOnCreate === "public" && newPublicListFromAt ? new Date(newPublicListFromAt).toISOString() : undefined,
      publicListUntilAt: requestedVisibilityOriginOnCreate === "public" && newPublicListUntilAt ? new Date(newPublicListUntilAt).toISOString() : undefined,
    };
    if (newEventLocation) {
      const normalizedCountryCode = normalizeCountryCode(newEventLocation.countryCode);
      payload.locationName = newEventLocation.locationName;
      payload.locationText = newEventLocation.locationName;
      payload.city = newEventLocation.city;
      if (normalizedCountryCode) payload.countryCode = normalizedCountryCode;
      payload.countryName = newEventLocation.countryName;
      payload.latitude = newEventLocation.lat ?? undefined;
      payload.longitude = newEventLocation.lng ?? undefined;
      payload.locationMeta = {
        city: newEventLocation.city || undefined,
        countryCode: normalizedCountryCode,
        countryName: newEventLocation.countryName || undefined,
        lat: newEventLocation.lat,
        lng: newEventLocation.lng,
      };
      const autoCurrency = currencyForCountry(normalizedCountryCode ?? "");
      if (newBbqCurrency !== autoCurrency) {
        payload.currency = newBbqCurrency;
        payload.currencySource = "manual";
      } else {
        payload.currencySource = "auto";
      }
    } else {
      payload.currency = newBbqCurrency;
      payload.currencySource = "manual";
    }
    createBbq.mutate(payload, {
      onSuccess: (data: Barbecue) => {
        if (newEventLocation) {
          rememberRecentLocation(newEventLocation);
        }
        setSelectedBbqId(data.id);
        setArea(getEventArea(data));
        setEventVisibilityTab("private");
        if (requestedPublicOnCreate) {
          const slug = data.publicSlug;
          setIsNewBbqOpen(false);
          resetNewEventWizard();
          setNewBbqName("");
          setNewBbqDate(new Date().toISOString().split('T')[0]);
          setNewBbqTime("");
          setNewBbqAllowOptIn(false);
          setNewBbqCurrency(((user?.defaultCurrencyCode as CurrencyCode | undefined) ?? "EUR"));
          if (slug) {
            setLocation(`/events/${slug}?created=1`);
            return;
          }
          toastSuccess("Public page created");
        } else {
          setNewBbqName(""); setNewBbqDate(new Date().toISOString().split('T')[0]); setNewBbqTime(""); setNewBbqAllowOptIn(false);
          setNewEventArea("parties"); setNewEventType("barbecue"); setNewEventLocation(null); setNewBbqPublicMode("marketing");
          resetNewEventWizard();
          setNewBbqCurrency(((user?.defaultCurrencyCode as CurrencyCode | undefined) ?? "EUR"));
          setIsNewBbqOpen(false);
        }
      },
      onError: (err: unknown) => {
        if (err instanceof UpgradeRequiredError) { showUpgrade(err.payload); return; }
        const message = err instanceof Error ? err.message : "Couldn’t create event. Try again.";
        toastError(message || "Couldn’t create event. Try again.");
      },
    });
  };

  const handleDeleteBbq = async (id: number) => {
    try {
      await deleteBbq.mutateAsync(id);
      if (selectedBbqId === id) setSelectedBbqId(null);
      setEventSettingsOpen(false);
      setIsPlanDetailsOpen(false);
      setLocation("/app/private");
      toastSuccess("Plan deleted");
    } catch (error) {
      const message = (error as Error)?.message ?? "Failed to delete plan";
      if (/only the creator/i.test(message)) {
        toastError("Only the creator can delete this plan");
        return;
      }
      if (/not found/i.test(message)) {
        toastError("Plan not found");
        return;
      }
      toastError("Failed to delete plan");
    }
  };

  const handleLeaveBbq = async (id: number) => {
    try {
      await leaveBbq.mutateAsync(id);
      if (typeof window !== "undefined") {
        sessionStorage.setItem(LEAVE_REDIRECT_MARKER_KEY, JSON.stringify({ id, at: Date.now() }));
      }
      removePlanFromClientState(id);
      await queryClient.invalidateQueries({ queryKey: ['/api/barbecues'] });
      await queryClient.refetchQueries({ queryKey: ['/api/barbecues'] });
      if (selectedBbqId === id) setSelectedBbqId(null);
      setEventSettingsOpen(false);
      setIsPlanDetailsOpen(false);
      setLocation("/app/private", { replace: true });
      toastSuccess("You left the plan");
    } catch (error) {
      const message = (error as Error)?.message ?? "Failed to leave plan";
      if (/not a member/i.test(message)) {
        toastError("You are not a member of this plan");
        return;
      }
      if (/not found/i.test(message)) {
        toastError("Plan not found");
        return;
      }
      toastError("Failed to leave plan");
    }
  };

  useEffect(() => {
    if (!isManagedAppRoute || appRouteMode !== "event" || !routeEventId) return;
    if (isLoadingBbqs || barbecuesError || selectedBbq) {
      if (selectedBbq) missingEventRedirectedRef.current = null;
      return;
    }
    if (missingEventRedirectedRef.current === routeEventId) return;
    missingEventRedirectedRef.current = routeEventId;

    if (typeof window !== "undefined") {
      const raw = sessionStorage.getItem(LEAVE_REDIRECT_MARKER_KEY);
      if (raw) {
        try {
          const marker = JSON.parse(raw) as { id?: number; at?: number };
          void marker;
        } catch {
          // ignore malformed marker
        }
      }
      sessionStorage.removeItem(LEAVE_REDIRECT_MARKER_KEY);
    }

    setPinnedEventIds((prev) => prev.filter((id) => id !== routeEventId));
    setRecentEventIds((prev) => prev.filter((id) => id !== routeEventId));
    setSelectedBbqId(null);
    setLocation("/app/private", { replace: true });
  }, [
    appRouteMode,
    barbecuesError,
    isLoadingBbqs,
    isManagedAppRoute,
    routeEventId,
    selectedBbq,
    setLocation,
  ]);

  const resetNewEventWizard = () => {
    setNewPublicCreateStep(1);
    setNewPrivateCreateStep(1);
    setNewEventPublicCategory("networking");
    setNewPublicDescription("");
    setNewPublicSubtitle("");
    setNewPublicOrganizationName("");
    setNewPublicBannerUrl("");
    setNewPublicTemplate("classic");
    setNewPublicCapacity("");
    setNewPublicExternalLink("");
    setNewPublicListFromAt("");
    setNewPublicListUntilAt("");
    setNewPublicRsvpTiers([{ id: "general", name: "General Admission", description: "", priceLabel: "", capacity: "", isFree: true }]);
    setNewPublicListOnExplore(false);
    setNewPrivateTemplateId("generic");
    setNewPlanMainCategory(null);
    setNewPlanSubCategory(null);
    setNewBbqVisibilityOrigin("private");
    setNewBbqIsPublic(false);
    setNewEventLocationTouched(false);
  };

  const handleNewEventLocationInput = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setNewEventLocation(null);
      return;
    }
    setNewEventLocation({
      locationName: value,
      city: "",
      countryCode: "",
      countryName: "",
    });
  };

  const closeNewEventWizard = () => {
    setIsNewBbqOpen(false);
    setNewEventArea(area);
    setNewEventType(area === "trips" ? "city_trip" : "barbecue");
    setNewEventLocation(null);
    setNewEventLocationTouched(false);
    resetNewEventWizard();
  };

  const handleNewEventOpenChange = (open: boolean) => {
    setIsNewBbqOpen(open);
    if (!open) {
      closeNewEventWizard();
      return;
    }
    resetNewEventWizard();
  };

  const applyPublicCreateCategory = (categoryKey: PublicCreateCategoryKey) => {
    const preset = PUBLIC_CREATE_CATEGORY_OPTIONS.find((c) => c.key === categoryKey);
    if (!preset) return;
    setNewEventPublicCategory(categoryKey);
    setNewEventArea(preset.area);
    setNewEventType(preset.eventType);
  };

  const updatePublicRsvpTier = (id: string, patch: Partial<PublicRsvpTierDraft>) => {
    setNewPublicRsvpTiers((prev) => prev.map((tier) => (tier.id === id ? { ...tier, ...patch } : tier)));
  };

  const addPublicRsvpTier = () => {
    const nextId = `tier_${Math.random().toString(36).slice(2, 8)}`;
    setNewPublicRsvpTiers((prev) => [...prev, { id: nextId, name: "", description: "", priceLabel: "", capacity: "", isFree: true }].slice(0, 8));
  };

  const removePublicRsvpTier = (id: string) => {
    setNewPublicRsvpTiers((prev) => (prev.length <= 1 ? prev : prev.filter((tier) => tier.id !== id)));
  };

  const rememberRecentLocation = (location: LocationOption | null) => {
    if (!location?.locationName?.trim()) return;
    setRecentLocationOptions((prev) => {
      const next = [location, ...prev.filter((item) => item.locationName.toLowerCase() !== location.locationName.toLowerCase())];
      return next.slice(0, 12);
    });
  };

  const applyPlanMainCategory = (mainCategory: PlanMainCategory) => {
    setNewPlanMainCategory(mainCategory);
    setNewPlanSubCategory(null);
  };

  const applyPlanSubCategory = (subcategoryId: PlanSubcategoryId) => {
    const all = [...TRIP_SUBCATEGORIES, ...PARTY_SUBCATEGORIES];
    const selected = all.find((item) => item.id === subcategoryId);
    if (!selected) return;
    setNewPlanSubCategory(subcategoryId);
    setNewEventArea(selected.area);
    setNewEventType(selected.eventTypeValue);
    setNewPrivateTemplateId(selected.templateId);
  };

  const markEventRecent = (eventId: number) => {
    setRecentEventIds((prev) => [eventId, ...prev.filter((id) => id !== eventId)].slice(0, 20));
  };

  const handleSelectEvent = (eventId: number | null) => {
    if (isManagedAppRoute) {
      if (eventId != null) {
        markEventRecent(eventId);
        // In managed /app/private, selecting a card should only navigate.
        // Setting selectedBbqId here hides the list before route transition.
        if (appRouteMode === "private") {
          setLocation(`/app/e/${eventId}`);
          return;
        }
      }
      setSelectedBbqId(eventId);
      if (eventId != null) setLocation(`/app/e/${eventId}`);
      else if (appRouteMode === "public") setLocation("/app/public");
      else if (appRouteMode === "private") setLocation("/app/private");
      else setLocation("/app/private");
      return;
    }
    setSelectedBbqId(eventId);
    if (eventId != null) markEventRecent(eventId);
  };

  const shouldIgnorePlanDetailsOpen = (target: EventTarget | null): boolean => {
    if (typeof document !== "undefined" && document.body.dataset.sharedCostsDrawerOpen === "true") {
      return true;
    }
    if (!(target instanceof HTMLElement)) return false;
    const interactive = target.closest("button, a, input, textarea, select, [data-prevent-plan-details-open]");
    if (interactive) return true;
    return !!target.closest("[data-radix-dialog-content], [data-radix-dialog-overlay]");
  };

  const togglePinnedEvent = (eventId: number) => {
    setPinnedEventIds((prev) => (
      prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [...prev, eventId].slice(-20)
    ));
  };

  const handleInvite = () => {
    if (!inviteUsername.trim()) return;
    inviteParticipant.mutate(inviteUsername.trim(), {
      onSuccess: () => {
        setInviteUsername("");
        toastSuccess(t.bbq.inviteSent);
      },
      onError: (err: unknown) => {
        if (err instanceof UpgradeRequiredError) { showUpgrade(err.payload); return; }
        const msg = (err as Error).message;
        toastError(msg === "already_member" ? t.bbq.alreadyMember : "Couldn’t send invite. Try again.");
      },
    });
  };

  const canManage = isCreator || (!!selectedBbq && !!myParticipant);
  const canEditEvent = canManage;
  const isAcceptedMember = !isCreator && !!myParticipant;

  const rawEventStatus = String(selectedBbq?.status ?? "active");
  const eventStatus: "draft" | "active" | "closed" | "settled" | "archived" =
    rawEventStatus === "draft"
      ? "draft"
      : rawEventStatus === "archived"
        ? "archived"
      : rawEventStatus === "settled"
        ? "settled"
        : rawEventStatus === "closed"
          ? "closed"
          : "active";
  const hasLegacySettlingState = rawEventStatus === "settling";
  const wrapUpEndsAt = getPlanWrapUpEndsAt(selectedBbq?.settledAt ?? null);
  const wrapUpEndsLabel = formatFullDate(wrapUpEndsAt);
  const showEventStatusPill = isPublicBuilderContext || eventStatus !== "active";
  const publicListingActive = !!(
    selectedBbq?.publicListingStatus === "active" &&
    selectedBbq?.publicListingExpiresAt &&
    new Date(selectedBbq.publicListingExpiresAt).getTime() > Date.now()
  );
  const selectedBbqVisibilityOriginLocked = selectedBbq?.visibilityOrigin === "private";
  const publicPeopleTabValue = isPublicBuilderContext ? "attendees" : "people";
  const privateNotesTabValue = "notes";
  const privateChatTabValue = "chat";
  const handleSettleUp = () => {
    if (!selectedBbqId) return;
    settleUp.mutate(selectedBbqId, {
      onSuccess: () => {
        setSettleUpModalOpen(false);
        toastSuccess(`${t.settleUp.toastSuccess} 💸`);
      },
      onError: () => toastError("Couldn’t settle up. Try again."),
    });
  };

  const settleSnapshot = (selectedBbq?.templateData as { settleSnapshot?: { total: number; expenseCount: number } })?.settleSnapshot;
  const showUpdatedAfterBadge = !!settleSnapshot && (
    totalSpent !== settleSnapshot.total || expenses.length !== settleSnapshot.expenseCount
  );
  const allBalancesZero = balances.every((b: { balance: number }) => Math.abs(b.balance) < 0.01);
  const splannoBuddyModel = useMemo(() => deriveSplannoBuddyModel({
    expenseCount: expenses.length,
    participantCount: participants.length,
    pendingCount: invitedParticipants.length + pendingRequests.length,
    planStatus: selectedBbq?.status ?? null,
    canSettle: settlements.length > 0 && !allBalancesZero,
    hasActiveSettlement: hasLegacySettlingState,
    settledAt: selectedBbq?.settledAt ?? null,
    createdAt: selectedBbq?.createdAt ?? null,
  }), [
    allBalancesZero,
    expenses.length,
    hasLegacySettlingState,
    invitedParticipants.length,
    participants.length,
    pendingRequests.length,
    selectedBbq?.createdAt,
    selectedBbq?.settledAt,
    selectedBbq?.status,
    settlements.length,
  ]);
  const handleSplannoBuddyAction = useCallback((action: SplannoBuddyAction) => {
    switch (action.intent) {
      case "overview":
        openPanel({ type: "overview" });
        break;
      case "expenses":
        openPanel({ type: "expenses" });
        break;
      case "crew":
        openPanel({ type: "crew" });
        break;
      case "invite":
        openPanel({ type: "invite", source: "overview" });
        break;
      case "settlement":
        openPanel({ type: "settlement" });
        break;
      case "add-expense":
        openPanel({ type: "add-expense", source: "overview" });
        break;
      case "plan-details":
        openPanel({ type: "plan-details" });
        break;
      case "ai-assistant":
        openPanel({ type: "ai-assistant" });
        break;
      case "chat":
        closePanel();
        break;
      default:
        break;
    }
  }, [closePanel, openPanel]);
  const selectedPlanTypeSelection = useMemo(
    () => derivePlanTypeSelection({ templateData: selectedBbq?.templateData, eventType: selectedBbq?.eventType }),
    [selectedBbq?.templateData, selectedBbq?.eventType],
  );
  const selectedPlanTypeHeadline = useMemo(() => {
    const { mainType, subcategory } = selectedPlanTypeSelection;
    if (!mainType) return "Set your plan type ✨";
    const mainLabel = getPlanMainTypeLabel(mainType);
    if (!subcategory) return `You’re planning a ${mainLabel} ✨`;
    return `You’re planning a ${mainLabel} — ${getPlanSubcategoryLabel(subcategory)} ✨`;
  }, [selectedPlanTypeSelection]);
  const selectedPlanCategoryMeta = useMemo(() => {
    const { mainType, subcategory } = selectedPlanTypeSelection;
    const mainLabel = mainType ? getPlanMainTypeLabel(mainType) : "Plan";
    const subLabel = subcategory ? getPlanSubcategoryLabel(subcategory) : "General";
    const [categoryIcon, subcategoryIcon] = getPlanIcons(mainType, subcategory);

    return {
      label: `${mainLabel} — ${subLabel}`,
      icons: [categoryIcon, subcategoryIcon] as LucideIcon[],
    };
  }, [selectedPlanTypeSelection]);

  const heroMetaLine = useMemo(() => {
    if (!selectedBbq) return "";
    const date = selectedBbq.date ? new Date(selectedBbq.date) : null;
    const dateLabel = formatPlanDateRange(selectedBbq.startDate, selectedBbq.endDate, selectedBbq.date);
    const timeLabel = date && Number.isFinite(date.getTime())
      && (selectedBbq.startDate ?? selectedBbq.date) === (selectedBbq.endDate ?? selectedBbq.startDate ?? selectedBbq.date)
      ? date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
      : "";
    const locationLabel = selectedBbq.locationName ?? selectedBbq.city ?? selectedBbq.countryName ?? "Location TBD";
    return [dateLabel, timeLabel, locationLabel].filter(Boolean).join(" • ");
  }, [selectedBbq]);
  const selectedPrivateTemplate = getPrivateTemplateForEvent(selectedBbq);
  const selectedEventVibeTheme = VIBE_THEME[(selectedBbq?.eventVibe as PrivateEventVibeId) ?? "cozy"] ?? VIBE_THEME.cozy;
  const selectedCreatePrivateTemplate = getPrivateTemplateById(newPrivateTemplateId);
  const selectedSubcategoryList = newPlanMainCategory === "trip" ? TRIP_SUBCATEGORIES : newPlanMainCategory === "party" ? PARTY_SUBCATEGORIES : [];
  const selectedSubcategoryDef = [...TRIP_SUBCATEGORIES, ...PARTY_SUBCATEGORIES].find((item) => item.id === newPlanSubCategory) ?? null;
  const isPrivateBasicsValid = !!newBbqName.trim() && !!newBbqDate && !!newEventLocation?.locationName.trim();
  const headerPrimaryActionLabel = !isPublicBuilderContext && activeEventTab === "people" ? "Invite" : UI_COPY.actions.addExpense;
  const headerPrimaryActionVisible = !isPublicBuilderContext && (activeEventTab === "expenses" || activeEventTab === "people");
  const handleHeaderPrimaryAction = () => {
    if (isPublicBuilderContext) return;
    if (activeEventTab === "people") {
      setIsAddPersonOpen(true);
      return;
    }
    setRecommendedExpenseTemplate(null);
    setEditingExpense(null);
    setIsAddExpenseOpen(true);
  };
  const newEventWizardFooter = (
    <div className="w-full space-y-2">
      {newBbqVisibilityOrigin === "public" && newPublicCreateStep <= 4 && (
        <p className="text-xs text-muted-foreground text-right">
          Your plan is created as a private draft. Publish to Explore when ready.
        </p>
      )}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 w-full">
        <Button
          variant="ghost"
          onClick={() => {
            if (newBbqVisibilityOrigin === "public" && newPublicCreateStep > 1) {
              setNewPublicCreateStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s));
              return;
            }
            if (newBbqVisibilityOrigin === "private" && newPrivateCreateStep > 1) {
              setNewPrivateCreateStep((s) => (s > 1 ? ((s - 1) as 1 | 2) : s));
              return;
            }
            closeNewEventWizard();
          }}
          className="w-full sm:w-auto order-2 sm:order-1"
          data-testid="button-cancel-bbq"
        >
          {(newBbqVisibilityOrigin === "public" && newPublicCreateStep > 1) || (newBbqVisibilityOrigin === "private" && newPrivateCreateStep > 1)
            ? "Back"
            : t.modals.cancel}
        </Button>
        {newBbqVisibilityOrigin === "public" && newPublicCreateStep < 4 ? (
          <Button
            onClick={() => setNewPublicCreateStep((s) => ((s + 1) as 2 | 3 | 4))}
            disabled={
              (newPublicCreateStep === 1 && !newBbqName.trim()) ||
              (newPublicCreateStep === 2 && (!newBbqName.trim() || !newEventLocation?.locationName.trim()))
            }
            className="w-full sm:w-auto bg-primary text-primary-foreground font-semibold transition-all duration-150 order-1 sm:order-2"
            data-testid="button-public-builder-next"
          >
            Next
          </Button>
        ) : newBbqVisibilityOrigin === "private" && newPrivateCreateStep < 3 ? (
          <Button
            onClick={() => {
              setNewPrivateCreateStep((s) => ((s + 1) as 2 | 3));
            }}
            disabled={
              (newPrivateCreateStep === 1 && !isPrivateBasicsValid) ||
              (newPrivateCreateStep === 2 && !newPlanMainCategory)
            }
            className="w-full sm:w-auto bg-primary text-primary-foreground font-semibold transition-all duration-150 order-1 sm:order-2"
            data-testid="button-private-builder-next"
          >
            Next
          </Button>
        ) : newBbqVisibilityOrigin === "public" && newPublicCreateStep === 4 ? (
          <Button
            onClick={() => handleCreateBbq()}
            disabled={!newBbqName.trim() || !newEventLocation?.locationName.trim() || createBbq.isPending}
            className="w-full sm:w-auto min-w-[188px] bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5 transition-all duration-150 order-1 sm:order-2"
            data-testid="button-create-public-event"
          >
            {createBbq.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="w-4 h-4 inline-block" aria-hidden />}
            <span>{createBbq.isPending ? "Starting plan..." : "Start public plan"}</span>
          </Button>
        ) : (
          <Button
            onClick={() => handleCreateBbq()}
            disabled={!isPrivateBasicsValid || !newPlanMainCategory || !newPlanSubCategory || createBbq.isPending}
            className="w-full sm:w-auto min-w-[188px] bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5 transition-all duration-150 order-1 sm:order-2"
            data-testid="button-create-bbq"
          >
            {createBbq.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="w-4 h-4 inline-block" aria-hidden />}
            <span>{createBbq.isPending ? "Starting plan..." : "Start plan"}</span>
          </Button>
        )}
      </div>
    </div>
  );

  useEffect(() => {
    const status = (selectedBbq?.status as string) ?? "active";
    if (status !== "settled" || !selectedBbqId) return;
    if (settledCelebrationShownRef.current === selectedBbqId) return;
    settledCelebrationShownRef.current = selectedBbqId;
    if (!shouldReduceMotion) setShowSettledConfetti(true);
  }, [selectedBbq?.status, selectedBbqId, shouldReduceMotion]);

  // Always render shell so /app never shows a blank page; show login dialog when not authenticated (or still loading auth)
  return (
    <div className="min-h-screen pb-20">
      <AuthDialog
        open={isAuthLoading || (!user && showAuthDialog)}
        onOpenChange={(open) => { if (!open) setShowAuthDialog(false); }}
        isCheckingAuth={isAuthLoading}
      />

      {!debugDisableDiscoverModal && (
        <DiscoverModal
          open={discoverOpen}
          onOpenChange={setDiscoverOpen}
          username={username}
          onSelectEvent={(bbq) => {
            setSelectedBbqId(bbq.id);
            setArea(getEventArea(bbq));
            setDiscoverOpen(false);
          }}
          onJoin={handleDiscoverJoin}
        />
      )}

      {/* Header */}
      {!isManagedAppRoute && (
      <header className="hidden md:block md:sticky md:top-0 z-30 bg-[hsl(var(--surface-0))]/90 backdrop-blur-lg border-b border-[hsl(var(--border-subtle))]" data-testid="header">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <SplannoLogo variant="icon" size={40} className="flex-shrink-0" />
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl md:text-3xl font-bold font-display text-primary tracking-tight truncate" data-testid="text-app-title">
                {t.title}
              </h1>
              <p className="hidden md:block text-xs text-muted-foreground uppercase tracking-widest font-medium">
                {t.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {/* User area */}
            {user ? (
              <div className="flex items-center gap-1">
                {/* Notification Bell */}
                <Button
                  size="icon"
                  variant="ghost"
                  className="relative"
                  data-testid="button-notifications"
                  onClick={() => setNotifOpen(true)}
                >
                  <Bell className="w-4 h-4" />
                  {(pendingFriendRequests.length + pendingPlanInvites.length > 0) && (
                    <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center" data-testid="badge-notifications">
                      {pendingFriendRequests.length + pendingPlanInvites.length}
                    </span>
                  )}
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="sm:hidden relative"
                  data-testid="button-profile-drawer-mobile"
                  onClick={() => setIsAccountDrawerOpen(true)}
                >
                  <UserCircle className="w-4 h-4" />
                  {friendRequests.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center" data-testid="badge-friend-requests">
                      {friendRequests.length}
                    </span>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10"
                  data-testid="button-profile-drawer"
                  onClick={() => setIsAccountDrawerOpen(true)}
                >
                  <span className="font-medium max-w-[100px] truncate" data-testid="text-username">{user.username}</span>
                  <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                </Button>
              </div>
            ) : !showAuthDialog ? (
              <Button
                size="sm"
                onClick={() => setShowAuthDialog(true)}
                className="bg-primary text-primary-foreground font-bold"
                data-testid="button-open-auth"
              >
                {t.auth.login}
              </Button>
            ) : null}

          </div>
        </div>
      </header>
      )}

      {notifOpen ? (
        <Suspense fallback={null}>
          <NotificationsDrawer
            open={notifOpen}
            onOpenChange={setNotifOpen}
            pendingFriendRequests={pendingFriendRequests}
            pendingPlanInvites={pendingPlanInvites}
            acceptFriendPending={acceptFriendRequestNotif.isPending}
            declineFriendPending={declineFriendRequestNotif.isPending}
            acceptPlanPending={acceptPlanInvite.isPending}
            declinePlanPending={declinePlanInvite.isPending}
            onAcceptFriend={(friendshipId) => {
              acceptFriendRequestNotif.mutate(friendshipId, {
                onSuccess: () => toastSuccess("Friend request accepted"),
                onError: (error) => toastError(error instanceof Error ? error.message : "Couldn’t accept request."),
              });
            }}
            onDeclineFriend={(friendshipId) => {
              declineFriendRequestNotif.mutate(friendshipId, {
                onSuccess: () => toastInfo("Friend request declined"),
                onError: (error) => toastError(error instanceof Error ? error.message : "Couldn’t decline request."),
              });
            }}
            onAcceptPlan={(invite) => {
              acceptPlanInvite.mutate(invite.id, {
                onSuccess: async (payload) => {
                  await Promise.all([
                    queryClient.invalidateQueries({ queryKey: ["/api/memberships"] }),
                    queryClient.invalidateQueries({ queryKey: ["/api/barbecues"] }),
                    queryClient.invalidateQueries({ queryKey: ["/api/events", payload.eventId, "members"] }),
                    queryClient.refetchQueries({ queryKey: ["/api/barbecues"] }),
                  ]);
                  setSelectedBbqId(payload.eventId);
                  setNotifOpen(false);
                  setLocation(`/app/e/${payload.eventId}`);
                  toastSuccess("Invite accepted");
                },
                onError: (error) => toastError(error instanceof Error ? error.message : "Couldn’t accept invite."),
              });
            }}
            onDeclinePlan={(inviteId) => {
              declinePlanInvite.mutate(inviteId, {
                onSuccess: () => toastInfo("Invite declined"),
                onError: (error) => toastError(error instanceof Error ? error.message : "Couldn’t decline invite."),
              });
            }}
          />
        </Suspense>
      ) : null}

      {isAccountDrawerOpen ? (
      <Sheet open={isAccountDrawerOpen} onOpenChange={(next) => setIsAccountDrawerOpen(next)}>
        <SheetContent
          side="right"
          className="h-full w-[420px] max-w-[92vw] border-l border-slate-200 bg-white p-0 shadow-2xl dark:border-[hsl(var(--border-subtle))] dark:bg-[hsl(var(--surface-1))]"
        >
          <div className="flex h-full flex-col">
            <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur dark:border-[hsl(var(--border-subtle))] dark:bg-[hsl(var(--surface-1))]/95">
              <div className="flex items-start justify-between gap-3">
                <SheetHeader className="space-y-1 text-left">
                  <SheetTitle className="text-lg font-semibold text-slate-900 dark:text-neutral-100">Account</SheetTitle>
                  <SheetDescription className="text-sm text-slate-500 dark:text-neutral-400">
                    {accountView === "profile"
                      ? "Profile"
                      : accountView === "friends"
                        ? "Friends"
                        : accountView === "addFriend"
                          ? "Add friend"
                          : accountView === "friendProfile"
                            ? "Friend profile"
                            : accountView === "editBio"
                              ? "Edit bio"
                              : accountView === "changePhoto"
                                ? "Change photo"
                                : "Settings"}
                  </SheetDescription>
                </SheetHeader>
                {isViewingOwnAccount ? (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className={`h-9 w-9 ${circularActionButtonClass()}`}
                      onClick={() => setAccountView("settings")}
                      aria-label="Open settings"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 rounded-full border-red-200/80 bg-red-50/70 text-red-600 hover:border-red-300 hover:bg-red-100 hover:text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40"
                      onClick={() => {
                        setDeleteConfirmPhrase("");
                        setDeleteAccountDialogOpen(true);
                      }}
                      aria-label="Delete account"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {accountView === "profile" ? (
                <div className="flex min-h-full flex-col gap-4">
                  {profileTargetLoading ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-[hsl(var(--border-subtle))] dark:bg-[hsl(var(--surface-2))]">
                      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-neutral-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading profile…
                      </div>
                    </div>
                  ) : profileTargetError ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50/70 p-4 dark:border-red-900/50 dark:bg-red-950/30">
                      <p className="text-sm text-red-700 dark:text-red-300">Couldn’t load profile details.</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => {
                          void refetchProfileTarget();
                        }}
                      >
                        Retry
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
                        <div className="p-4">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                if (!isViewingOwnAccount) return;
                                setAccountView("changePhoto");
                              }}
                              className={`grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/10 text-base font-semibold text-primary ${isViewingOwnAccount ? "cursor-pointer ring-2 ring-transparent transition hover:ring-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" : "cursor-default"}`}
                            >
                              {accountProfileImageSrc && !accountAvatarLoadFailed ? (
                                <img
                                  src={accountProfileImageSrc}
                                  alt=""
                                  className="h-full w-full object-cover"
                                  onError={() => setAccountAvatarLoadFailed(true)}
                                />
                              ) : (
                                (accountProfileUser?.displayName || accountProfileUser?.username || "U").slice(0, 2).toUpperCase()
                              )}
                            </button>
                            <div className="min-w-0">
                              <p className="truncate text-base font-semibold text-foreground">
                                {accountProfileUser?.displayName || accountProfileUser?.username || "User"}
                              </p>
                              {accountProfileUser?.username ? (
                                <p className="truncate text-sm text-muted-foreground">@{accountProfileUser.username}</p>
                              ) : null}
                              {isViewingOwnAccount && user?.email ? (
                                <p className="mt-0.5 truncate text-xs text-muted-foreground">{user.email}</p>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-border/70">
                          <button
                            type="button"
                            onClick={() => setAccountView("friends")}
                            className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            <div>
                              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Friends</p>
                              <p className="mt-1 text-sm font-semibold text-foreground">{accountFriendsCount}</p>
                            </div>
                            <ChevronDown className="-rotate-90 h-4 w-4 text-muted-foreground" />
                          </button>
                        </div>

                        <div className="border-t border-border/70">
                          <button
                            type="button"
                            onClick={() => {
                              if (!isViewingOwnAccount) return;
                              setAccountView("editBio");
                            }}
                            className={`flex w-full items-center justify-between px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isViewingOwnAccount ? "hover:bg-muted/50" : ""}`}
                            disabled={!isViewingOwnAccount}
                            aria-label="Edit bio"
                          >
                            <div className="min-w-0">
                              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Bio</p>
                              <p className="mt-1 truncate text-sm text-foreground/90">
                                {(accountProfileUser?.bio && accountProfileUser.bio.trim().length > 0)
                                  ? accountProfileUser.bio
                                  : "Add a bio…"}
                              </p>
                            </div>
                            <ChevronDown className="-rotate-90 h-4 w-4 text-muted-foreground" />
                          </button>
                        </div>
                      </div>

                    </>
                  )}
                </div>
              ) : accountView === "friends" ? (
                <div className="space-y-4">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-fit px-2"
                    onClick={() => setAccountView("profile")}
                  >
                    <ArrowLeft className="mr-1.5 h-4 w-4" />
                    Back to profile
                  </Button>
                  <Button
                    type="button"
                    className="w-full bg-primary text-primary-foreground font-medium hover:bg-primary/90"
                    onClick={() => setAccountView("addFriend")}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add friend
                  </Button>
                  {!isViewingOwnAccount ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-[hsl(var(--border-subtle))] dark:bg-[hsl(var(--surface-2))] dark:text-[hsl(var(--text-secondary))]">
                      Friends feature coming soon for viewed profiles.
                    </div>
                  ) : friends.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-[hsl(var(--border-subtle))] dark:bg-[hsl(var(--surface-2))] dark:text-[hsl(var(--text-secondary))]">
                      No friends yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {friends.map((friend) => (
                        <button
                          type="button"
                          key={`account-friend-${friend.friendshipId}`}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-[hsl(var(--border-subtle))] dark:bg-[hsl(var(--surface-2))] dark:hover:bg-[hsl(var(--surface-1))]"
                          onClick={() => {
                            setSelectedFriendId(friend.userId);
                            setAccountView("friendProfile");
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-slate-900 dark:text-neutral-100">
                                {friend.displayName || friend.username}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-neutral-400">@{friend.username}</p>
                            </div>
                            <ChevronDown className="-rotate-90 h-4 w-4 text-slate-400" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : accountView === "addFriend" ? (
                <div className="space-y-4">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-fit px-2"
                    onClick={() => setAccountView("friends")}
                  >
                    <ArrowLeft className="mr-1.5 h-4 w-4" />
                    Back to friends
                  </Button>
                  <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-[hsl(var(--border-subtle))] dark:bg-[hsl(var(--surface-2))]">
                    <Label htmlFor="account-add-friend-search" className="text-sm font-medium">Search users</Label>
                    <Input
                      id="account-add-friend-search"
                      value={addFriendQuery}
                      onChange={(event) => setAddFriendQuery(event.target.value)}
                      className="mt-2"
                      placeholder="Search by name or username…"
                    />
                    <p className="mt-2 text-xs text-muted-foreground">Type at least 2 characters.</p>
                    <div className="mt-3 space-y-2">
                      {addFriendQuery.trim().length < 2 ? (
                        <p className="text-xs text-slate-500 dark:text-neutral-400">Start typing to find people.</p>
                      ) : addFriendSearchLoading ? (
                        <p className="text-xs text-slate-500 dark:text-neutral-400">Searching…</p>
                      ) : addFriendSearchError ? (
                        <p className="text-xs text-red-600 dark:text-red-400">Couldn’t search right now. Try again.</p>
                      ) : addFriendResults.length === 0 ? (
                        <p className="text-xs text-slate-500 dark:text-neutral-400">No users found.</p>
                      ) : (
                        addFriendResults.map((result) => {
                          const alreadyFriend = friends.some((friend) => friend.userId === result.id);
                          return (
                            <div key={`account-add-friend-${result.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-2.5 py-2 dark:border-neutral-700">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-slate-900 dark:text-neutral-100">
                                  {result.displayName || result.username}
                                </p>
                                <p className="truncate text-xs text-slate-500 dark:text-neutral-400">@{result.username}</p>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                disabled={alreadyFriend || sendFriendRequest.isPending}
                                onClick={() =>
                                  sendFriendRequest.mutate(result.username, {
                                    onSuccess: () => {
                                      toastSuccess("Friend request sent");
                                      setAddFriendQuery("");
                                      setAccountView("friends");
                                    },
                                    onError: (error) => {
                                      toastError(error instanceof Error ? error.message : "Couldn’t send friend request.");
                                    },
                                  })
                                }
                              >
                                {alreadyFriend ? "Added" : "Add"}
                              </Button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              ) : accountView === "friendProfile" ? (
                <div className="space-y-4">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-fit px-2"
                    onClick={() => setAccountView("friends")}
                  >
                    <ArrowLeft className="mr-1.5 h-4 w-4" />
                    Back to friends
                  </Button>
                  {!selectedFriend ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-[hsl(var(--border-subtle))] dark:bg-[hsl(var(--surface-2))] dark:text-[hsl(var(--text-secondary))]">
                      Friend not found.
                    </div>
                  ) : selectedFriendProfileLoading ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-[hsl(var(--border-subtle))] dark:bg-[hsl(var(--surface-2))] dark:text-[hsl(var(--text-secondary))]">
                      Loading profile…
                    </div>
                  ) : selectedFriendProfileError ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-[hsl(var(--border-subtle))] dark:bg-[hsl(var(--surface-2))]">
                      <p className="text-sm text-red-600 dark:text-red-400">Couldn’t load friend profile.</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => {
                          void refetchSelectedFriendProfile();
                        }}
                      >
                        Retry
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-[hsl(var(--border-subtle))] dark:bg-[hsl(var(--surface-2))]">
                      <div className="flex items-center gap-3">
                        <span className="grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-amber-100 text-sm font-semibold text-slate-700 dark:bg-amber-300/25 dark:text-amber-100">
                          {selectedFriendProfile?.user?.avatarUrl || selectedFriendProfile?.user?.profileImageUrl ? (
                            <img
                              src={resolveAssetUrl(selectedFriendProfile.user.profileImageUrl || selectedFriendProfile.user.avatarUrl || "") ?? ""}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            (selectedFriendProfile?.user?.displayName || selectedFriend.displayName || selectedFriend.username || "U").slice(0, 2).toUpperCase()
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-slate-900 dark:text-neutral-100">
                            {selectedFriendProfile?.user?.displayName || selectedFriend.displayName || selectedFriend.username}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-neutral-400">@{selectedFriendProfile?.user?.username || selectedFriend.username}</p>
                        </div>
                      </div>
                      {selectedFriendProfile?.user?.bio ? (
                        <p className="mt-3 text-sm text-slate-700 dark:text-neutral-300">{selectedFriendProfile.user.bio}</p>
                      ) : (
                        <p className="mt-3 text-sm text-slate-500 dark:text-neutral-400">No bio yet.</p>
                      )}
                    </div>
                  )}
                </div>
              ) : accountView === "editBio" ? (
                <div className="space-y-4">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-fit px-2"
                    onClick={() => setAccountView("profile")}
                  >
                    <ArrowLeft className="mr-1.5 h-4 w-4" />
                    Back to profile
                  </Button>
                  <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-[hsl(var(--border-subtle))] dark:bg-[hsl(var(--surface-2))]">
                    <Label htmlFor="account-bio" className="text-sm font-medium">Bio</Label>
                    <Textarea
                      id="account-bio"
                      value={draftBio}
                      onChange={(event) => setDraftBio(event.target.value.slice(0, 160))}
                      rows={4}
                      className="mt-2"
                      placeholder="Add a short bio…"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">{draftBio.length}/160</p>
                    <div className="mt-3 flex items-center justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setAccountView("profile")}>
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={updateProfile.isPending}
                        onClick={() =>
                          updateProfile.mutate(
                            { bio: draftBio.trim().slice(0, 160) || null },
                            {
                              onSuccess: () => {
                                toastSuccess("Bio updated");
                                setAccountView("profile");
                              },
                              onError: () => toastError("Couldn’t update bio. Try again."),
                            },
                          )
                        }
                      >
                        {updateProfile.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                        Save
                      </Button>
                    </div>
                  </div>
                </div>
              ) : accountView === "changePhoto" ? (
                <div className="space-y-4">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-fit px-2"
                    onClick={() => setAccountView("profile")}
                  >
                    <ArrowLeft className="mr-1.5 h-4 w-4" />
                    Back to profile
                  </Button>
                  <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-[hsl(var(--border-subtle))] dark:bg-[hsl(var(--surface-2))]">
                    <Label htmlFor="account-photo-upload" className="text-sm font-medium">{t.auth.uploadImage}</Label>
                    <input
                      ref={avatarFileInputRef}
                      id="account-photo-upload"
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(event) => {
                        handleAvatarFileChange(event.target.files?.[0] ?? null);
                        event.currentTarget.value = "";
                      }}
                    />
                    <div
                      role="button"
                      tabIndex={0}
                      className={`mt-2 rounded-lg border border-dashed p-3 transition ${avatarDragActive ? "border-primary bg-primary/5" : "border-slate-300 bg-slate-50/70 dark:border-neutral-700 dark:bg-neutral-900/60"}`}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setAvatarDragActive(true);
                      }}
                      onDragLeave={() => setAvatarDragActive(false)}
                      onDrop={(event) => {
                        event.preventDefault();
                        setAvatarDragActive(false);
                        const file = event.dataTransfer.files?.[0] ?? null;
                        handleAvatarFileChange(file);
                      }}
                      onClick={() => avatarFileInputRef.current?.click()}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          avatarFileInputRef.current?.click();
                        }
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-neutral-100">{t.auth.uploadDropHint}</p>
                          <p className="text-xs text-muted-foreground">{t.auth.uploadImageMax}</p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          className="bg-primary text-primary-foreground hover:bg-primary/90"
                          onClick={(event) => {
                            event.stopPropagation();
                            avatarFileInputRef.current?.click();
                          }}
                        >
                          {t.auth.chooseImage}
                        </Button>
                      </div>
                      {avatarUploadFile ? (
                        <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-900">
                          <p className="truncate text-slate-700 dark:text-neutral-200">
                            {avatarUploadFile.name} · {formatFileSize(avatarUploadFile.size)}
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1.5 text-xs"
                            onClick={(event) => {
                              event.stopPropagation();
                              setAvatarUploadFile(null);
                              setAvatarUploadPreviewUrl((prev) => {
                                if (prev) URL.revokeObjectURL(prev);
                                return null;
                              });
                              setAvatarUploadError(null);
                            }}
                          >
                            {t.auth.removeImage}
                          </Button>
                        </div>
                      ) : null}
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-2 h-7 px-2 text-xs"
                      onClick={() => {
                        setUseAvatarUrlInput((prev) => !prev);
                        setAvatarUploadError(null);
                      }}
                    >
                      {useAvatarUrlInput ? t.auth.hideUrlInput : t.auth.useUrlInstead}
                    </Button>

                    {useAvatarUrlInput ? (
                      <div className="mt-2">
                        <Label htmlFor="account-photo-url" className="text-xs font-medium text-muted-foreground">{t.auth.profilePictureUrl}</Label>
                        <Input
                          id="account-photo-url"
                          value={draftProfileImageUrl}
                          onChange={(event) => {
                            setDraftProfileImageUrl(event.target.value);
                            setAvatarUploadFile(null);
                            setAvatarUploadPreviewUrl((prev) => {
                              if (prev) URL.revokeObjectURL(prev);
                              return null;
                            });
                            setAvatarUploadError(null);
                          }}
                          className="mt-1"
                          placeholder="https://example.com/photo.jpg"
                        />
                      </div>
                    ) : null}

                    {avatarUploadError ? (
                      <p className="mt-2 text-xs text-red-600 dark:text-red-400">{avatarUploadError}</p>
                    ) : null}

                    <div className="mt-3 flex justify-center">
                      <span className="grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-amber-100 text-lg font-semibold text-slate-700 dark:bg-amber-300/25 dark:text-amber-100">
                        {changePhotoPreview ? (
                          <img src={changePhotoPreview} alt="" className="h-full w-full object-cover" />
                        ) : (
                          (user?.displayName || user?.username || "U").slice(0, 2).toUpperCase()
                        )}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setAccountView("profile")}>
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={!canSaveAvatar || updateProfile.isPending || avatarUploadPending}
                        onClick={async () => {
                          setAvatarUploadError(null);
                          try {
                            let nextAvatarUrl: string | null = null;
                            let nextAvatarAssetId: string | null = null;
                            if (avatarUploadFile) {
                              setAvatarUploadPending(true);
                              const dataUrl = await new Promise<string>((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onload = () => {
                                  const result = typeof reader.result === "string" ? reader.result : null;
                                  if (!result || !result.startsWith("data:image/")) {
                                    reject(new Error(t.auth.invalidImageType));
                                    return;
                                  }
                                  resolve(result);
                                };
                                reader.onerror = () => reject(new Error(t.auth.invalidImageType));
                                reader.readAsDataURL(avatarUploadFile);
                              });
                              const uploadRes = await fetch("/api/uploads/avatar", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                credentials: "include",
                                body: JSON.stringify({ dataUrl }),
                              });
                              const uploadPayload = await uploadRes.json().catch(() => ({}));
                              if (!uploadRes.ok) {
                                throw new Error((uploadPayload as { message?: string }).message || t.auth.avatarUploadFailed);
                              }
                              const uploadedPath = String((uploadPayload as { path?: string; url?: string }).path ?? (uploadPayload as { url?: string }).url ?? "").trim();
                              if (!uploadedPath) throw new Error(t.auth.avatarUploadFailed);
                              nextAvatarUrl = uploadedPath;
                              nextAvatarAssetId = null;
                            } else if (useAvatarUrlInput) {
                              const trimmed = draftProfileImageUrl.trim();
                              if (!trimmed) {
                                nextAvatarUrl = null;
                                nextAvatarAssetId = null;
                              } else {
                                const normalized = trimmed.startsWith("/") ? trimmed : (/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
                                if (!resolveAssetUrl(normalized)) {
                                  throw new Error(t.auth.invalidImageUrl);
                                }
                                nextAvatarUrl = normalized;
                                nextAvatarAssetId = null;
                              }
                            } else {
                              throw new Error(t.auth.chooseImageOrUrl);
                            }

                            const profileUpdates: {
                              avatarUrl?: string | null;
                              avatarAssetId?: string | null;
                              profileImageUrl?: string | null;
                            } = {};

                            if (nextAvatarAssetId) {
                              profileUpdates.avatarAssetId = nextAvatarAssetId;
                            } else {
                              profileUpdates.avatarUrl = nextAvatarUrl;
                              profileUpdates.profileImageUrl = nextAvatarUrl;
                            }

                            await updateProfile.mutateAsync(profileUpdates);
                            toastSuccess(t.modals.profileSaved);
                            setAvatarUploadFile(null);
                            setAvatarUploadPreviewUrl((prev) => {
                              if (prev) URL.revokeObjectURL(prev);
                              return null;
                            });
                            setAvatarUploadPending(false);
                            setAccountView("profile");
                          } catch (error) {
                            setAvatarUploadPending(false);
                            setAvatarUploadError(error instanceof Error ? error.message : t.auth.avatarUpdateFailed);
                            toastError(error instanceof Error ? error.message : t.auth.avatarUpdateFailed);
                          }
                        }}
                      >
                        {updateProfile.isPending || avatarUploadPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                        Save
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-fit px-2"
                    onClick={() => setAccountView("profile")}
                  >
                    <ArrowLeft className="mr-1.5 h-4 w-4" />
                    Back to profile
                  </Button>
                  <AccountSettingsContent compact />
                </div>
              )}
            </div>

            <footer className="border-t border-slate-200 bg-white px-5 py-3 dark:border-[hsl(var(--border-subtle))] dark:bg-[hsl(var(--surface-1))]">
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                data-testid="drawer-item-logout"
                onClick={() => {
                  setIsAccountDrawerOpen(false);
                  logout.mutate();
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                {t.auth.logout}
              </Button>
            </footer>
            <AlertDialog open={deleteAccountDialogOpen} onOpenChange={setDeleteAccountDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes your account and cannot be undone. Type DELETE to confirm.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-1.5">
                  <Label htmlFor="delete-account-confirm" className="text-xs text-muted-foreground">
                    Confirmation
                  </Label>
                  <Input
                    id="delete-account-confirm"
                    value={deleteConfirmPhrase}
                    onChange={(event) => setDeleteConfirmPhrase(event.target.value)}
                    placeholder="DELETE"
                    className="h-9"
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleteAccount.isPending}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={deleteConfirmPhrase.trim().toUpperCase() !== "DELETE" || deleteAccount.isPending}
                    onClick={(event) => {
                      event.preventDefault();
                      deleteAccount.mutate(undefined, {
                        onSuccess: () => {
                          setDeleteAccountDialogOpen(false);
                          setIsAccountDrawerOpen(false);
                          window.location.href = "/";
                        },
                        onError: () => toastError("Couldn’t delete account. Try again."),
                      });
                    }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleteAccount.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                    Delete account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </SheetContent>
      </Sheet>
      ) : null}

      {/* Legacy top controls (hidden in managed /app routes, moved to sidebar) */}
      {!isManagedAppRoute && (
      <div className="sticky top-[57px] z-40 bg-[hsl(var(--surface-0))]/90 backdrop-blur-md border-b border-[hsl(var(--border-subtle))]" data-testid="section-area-tabs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0 overflow-x-auto">
              <div className="flex rounded-lg border border-white/10 overflow-hidden inline-flex flex-shrink-0">
                <button
                  onClick={() => setArea("parties")}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                    area === "parties" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  }`}
                  data-testid="tab-parties"
                >
                  {t.nav.parties}
                </button>
                <button
                  onClick={() => setArea("trips")}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                    area === "trips" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  }`}
                  data-testid="tab-trips"
                >
                  {t.nav.trips}
                </button>
              </div>

              {!isManagedAppRoute && FEATURE_PUBLIC_PLANS && (
                <div className="inline-flex rounded-lg border border-white/10 overflow-hidden flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setEventVisibilityTab("private")}
                    className={`px-3 py-1.5 text-xs font-semibold transition-colors ${eventVisibilityTab === "private" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-white/5"}`}
                    data-testid="tab-events-private"
                  >
                    Private ({privateBarbecuesForArea.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setEventVisibilityTab("public")}
                    className={`px-3 py-1.5 text-xs font-semibold transition-colors ${eventVisibilityTab === "public" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-white/5"}`}
                    data-testid="tab-events-public"
                  >
                    Public ({publicBarbecuesForArea.length})
                  </button>
                </div>
              )}

              <Popover open={allEventsSelectorOpen} onOpenChange={setAllEventsSelectorOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 min-w-[180px] max-w-[280px] justify-between border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/5 flex-shrink-0"
                    data-testid="button-all-events-selector"
                  >
                    <span className="truncate text-left">{selectedBbq ? selectedEventLabel : "All plans"}</span>
                    <ChevronDown className="w-3.5 h-3.5 ml-2 shrink-0 opacity-70" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[320px] p-2">
                  <div className="space-y-2">
                    <p className="px-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">All plans</p>
                    <Input
                      value={allEventsSearch}
                      onChange={(e) => setAllEventsSearch(e.target.value)}
                      placeholder="Search plans, city, country..."
                      className="h-8"
                    />
                    <div className="max-h-72 overflow-y-auto space-y-1">
                      {allEventsFilteredForArea.length === 0 ? (
                        <p className="px-2 py-2 text-xs text-muted-foreground">No plans found</p>
                      ) : (
                        allEventsFilteredForArea.map((bbq: Barbecue) => {
                          const isSelected = bbq.id === selectedBbqId;
                          const isPinned = pinnedEventIds.includes(bbq.id);
                          const isPublicItem = (bbq.visibility as string | undefined) === "public";
                          return (
                            <button
                              key={`all-events-${bbq.id}`}
                              type="button"
                              onClick={() => {
                                handleSelectEvent(bbq.id);
                                setAllEventsSelectorOpen(false);
                              }}
                              className={`w-full text-left rounded-md border px-2 py-2 transition-colors ${isSelected ? "border-primary bg-primary/10" : "border-transparent hover:border-border hover:bg-muted/40"}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{bbq.name}</p>
                                  <p className="text-[11px] text-muted-foreground truncate">
                                    {bbq.city && bbq.countryName ? `${bbq.city}, ${bbq.countryName}` : (bbq.countryName || bbq.city || (isPublicItem ? "Public plan" : "Friends plan"))}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${isPublicItem ? "border-sky-400/30 text-sky-300" : "border-amber-400/30 text-amber-300"}`}>
                                    {isPublicItem ? "Public" : "Friends"}
                                  </span>
                                  <button
                                    type="button"
                                    aria-label={isPinned ? "Unpin event" : "Pin event"}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      togglePinnedEvent(bbq.id);
                                    }}
                                    className={`p-1 rounded hover:bg-muted ${isPinned ? "text-yellow-400" : "text-muted-foreground"}`}
                                  >
                                    <Star className={`w-3.5 h-3.5 ${isPinned ? "fill-current" : ""}`} />
                                  </button>
                                </div>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Link href="/explore">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/5"
                  data-testid="button-explore-route"
                >
                  <Compass className="w-4 h-4 mr-1.5" />
                  Explore
                </Button>
              </Link>
              {user && (
                <Button
                  size="sm"
                  onClick={() => { setNewEventArea(area); setNewEventType(area === "trips" ? "city_trip" : "barbecue"); openNewPlanWizard("TYPE"); }}
                  className="font-semibold"
                  data-testid="button-new-bbq"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Start a plan
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      <main className={isEventChatRoute
        ? "h-[calc(100dvh-56px)] md:h-[100dvh] w-full overflow-hidden px-2 py-2 sm:px-3 sm:py-3"
        : "max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-6 sm:space-y-8"}
      >
        {
        <>
        {/* Pending Requests Panel */}
        {!isEventChatRoute && isCreator && pendingRequests.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 sm:p-6"
            data-testid="section-pending-requests"
          >
            <h3 className="text-base font-bold font-display text-yellow-400 flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5" />
              {t.user.pendingRequests} ({pendingRequests.length})
            </h3>
            <div className="flex flex-wrap gap-3">
              {pendingRequests.map((p: Participant) => (
                <div key={p.id} className="flex items-center gap-2 border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-2))]/50 rounded-[var(--radius-md)] px-3 py-2" data-testid={`pending-request-${p.id}`}>
                  <UserCheck className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{p.name}</span>
                  <div className="flex gap-1 ml-1">
                    <Button size="icon" variant="ghost"
                      className="w-7 h-7 text-green-400 hover:bg-green-500/20"
                      onClick={() => acceptParticipant.mutate(p.id)} disabled={acceptParticipant.isPending}
                      data-testid={`button-accept-${p.id}`} title={t.user.accept}>
                      <UserCheck className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost"
                      className="w-7 h-7 text-red-400 hover:bg-red-500/20"
                      onClick={() => rejectParticipant.mutate(p.id)} disabled={rejectParticipant.isPending}
                      data-testid={`button-reject-${p.id}`} title={t.user.reject}>
                      <UserX className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Main Content */}
        {activeEventId && isLoadingBbqs ? (
          <div className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6 space-y-5">
            <SkeletonCard className="h-44 rounded-2xl" />
            <div className="flex items-start gap-3">
              <SkeletonAvatar className="h-12 w-12 rounded-xl" />
              <div className="flex-1 space-y-2">
                <SkeletonLine className="h-6 w-1/2" />
                <SkeletonLine className="h-4 w-1/3" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <SkeletonCard className="h-9 w-24 rounded-lg" />
              <SkeletonCard className="h-9 w-28 rounded-lg" />
              <SkeletonCard className="h-9 w-20 rounded-lg" />
            </div>
            <SkeletonCard className="h-64 rounded-xl" />
          </div>
        ) : activeEventId && barbecuesError ? (
          <InlineQueryError
            message="Couldn’t load this plan. Try again."
            onRetry={() => {
              void refetchBarbecues();
            }}
          />
        ) : activeEventId ? (() => {
          if (appRouteMode === "event" && !selectedBbq) {
            return (
              <div className="mx-auto w-full max-w-[1400px] rounded-2xl border border-border/60 bg-background px-4 py-6 sm:px-6 lg:px-10">
                <div className="space-y-4">
                  <SkeletonCard className="h-64 rounded-3xl" />
                  <div className="grid gap-4 md:grid-cols-3">
                    <SkeletonCard className="h-40 rounded-2xl" />
                    <SkeletonCard className="h-40 rounded-2xl" />
                    <SkeletonCard className="h-40 rounded-2xl" />
                  </div>
                </div>
              </div>
            );
          }

          if (appRouteMode === "event" && selectedBbq && !isPrivateContext) {
            if (import.meta.env.DEV) {
              console.warn("[LEGACY] Prevented legacy plan dashboard render for non-private event route", {
                eventId: selectedBbq.id,
                routeEventId,
              });
            }
            return (
              <div className="rounded-2xl border border-border/60 bg-card p-6 text-sm text-muted-foreground">
                This plan is not available in this view.
              </div>
            );
          }

          if (useNewManagedEventLayout && appRouteMode === "event" && isPrivateContext && selectedBbq) {
            if (isMobileViewport) {
              return (
                <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
                  <div
                    className="min-h-0 flex-1 overflow-hidden"
                    onTouchStart={handleMobileContentTouchStart}
                    onTouchMove={handleMobileContentTouchMove}
                    onTouchEnd={handleMobileContentTouchEnd}
                    onTouchCancel={handleMobileContentTouchEnd}
                  >
                    <div
                      className="h-full min-h-0 will-change-transform"
                      style={{
                        transform: `translateX(${mobileSwipeOffset}px)`,
                        transition: mobileSwipeAnimating ? "transform 200ms ease" : undefined,
                      }}
                    >
                    {mobilePrimaryTab === "chat" ? (
                      <ChatSidebar
                        key={`mobile-chat-${selectedBbq.id}`}
                        eventId={selectedBbq.id}
                        eventName={selectedBbq.name}
                        eventType={selectedBbq.eventType ?? null}
                        planStatus={selectedBbq.status ?? null}
                        settledAt={selectedBbq.settledAt ?? null}
                        planEndDate={selectedBbq.endDate ?? selectedBbq.date ?? null}
                        templateData={selectedBbq.templateData}
                        location={
                          selectedBbq.locationText
                          ?? selectedBbq.locationName
                          ?? ([selectedBbq.city, selectedBbq.countryName].filter(Boolean).join(", ") || null)
                        }
                        dateTime={selectedBbq.date ?? null}
                        participantCount={participants.length}
                        sharedTotal={Number(totalSpent)}
                        expenseCount={expenses.length}
                        currency={(selectedBbq.currency as string) || defaultCurrency}
                        onSummaryClick={() => openPanel({ type: "plan-details" })}
                        currentUser={{
                          id: user?.id ?? null,
                          username: user?.username ?? null,
                          avatarUrl: user?.avatarUrl ?? null,
                        }}
                        enabled={!!user}
                        className="h-full min-w-0 bg-[hsl(var(--surface-1))]"
                      />
                    ) : (
                      <ContextPanelHost
                        key={`mobile-panel-host-${selectedBbq.id}`}
                        mobile
                        shellClassName="bg-[hsl(var(--surface-1))]"
                      />
                    )}
                    </div>
                  </div>
                  <SplannoBuddyLayer
                    model={splannoBuddyModel}
                    onAction={handleSplannoBuddyAction}
                    bottomOffset="calc(env(safe-area-inset-bottom) + 5.5rem)"
                  />
                  <nav className="sticky bottom-0 z-20 border-t border-border/60 bg-background/98 px-2 pb-[max(env(safe-area-inset-bottom),0.35rem)] pt-1 backdrop-blur-md lg:hidden">
                    <div className="grid grid-cols-5 gap-1 rounded-[20px] border border-border/60 bg-[hsl(var(--surface-1))]/98 p-1.5 shadow-[0_-10px_26px_rgba(15,23,42,0.08)] dark:shadow-[0_-10px_24px_rgba(0,0,0,0.18)]">
                      {[
                        { key: "chat", label: "Chat", icon: MessageCircle, onClick: () => closePanel() },
                        { key: "photos", label: "Photos", icon: ImageIcon, onClick: () => openPanel({ type: "photos" }) },
                        { key: "expenses", label: "Expenses", icon: Receipt, onClick: () => openPanel({ type: "expenses" }) },
                        { key: "crew", label: "Crew", icon: Users, onClick: () => openPanel({ type: "crew" }) },
                        { key: "overview", label: "Overview", icon: LayoutGrid, onClick: () => openPanel({ type: "overview" }) },
                      ].map((item) => {
                        const Icon = item.icon;
                        const active = mobilePrimaryTab === item.key;
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={item.onClick}
                            className={cn(
                              "flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-[16px] px-2 py-1.5 text-[10px] font-medium transition-all duration-200",
                              active
                                ? "scale-[1.01] bg-primary text-slate-900 shadow-[0_10px_22px_rgba(245,166,35,0.22)]"
                                : "text-muted-foreground active:bg-muted/60",
                            )}
                            aria-current={active ? "page" : undefined}
                          >
                            <Icon className={cn("h-4 w-4 transition-transform", active && "scale-105")} />
                            <span className={cn("leading-none", active && "font-semibold")}>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </nav>
                </div>
              );
            }
            return (
              <div className="h-full w-full overflow-hidden px-1 py-1 sm:px-2 sm:py-2 lg:px-3">
                <div className="flex h-full min-h-0 overflow-visible gap-0 p-2 dark:bg-transparent">
                  <div
                    className={cn(
                      "relative h-full min-w-0 flex-1 lg:mr-[-10px]",
                      activeSurface === "chat" ? "z-20 -translate-y-px" : "z-10 translate-y-0",
                    )}
                    onMouseDown={(event) => {
                      if (isInteractiveSurfaceTarget(event.target)) return;
                      setActiveSurface("chat");
                    }}
                  >
                    <ChatSidebar
                      key={`desktop-chat-${selectedBbq.id}`}
                      eventId={selectedBbq.id}
                      eventName={selectedBbq.name}
                      eventType={selectedBbq.eventType ?? null}
                      planStatus={selectedBbq.status ?? null}
                      settledAt={selectedBbq.settledAt ?? null}
                      planEndDate={selectedBbq.endDate ?? selectedBbq.date ?? null}
                      templateData={selectedBbq.templateData}
                      location={
                        selectedBbq.locationText
                        ?? selectedBbq.locationName
                        ?? ([selectedBbq.city, selectedBbq.countryName].filter(Boolean).join(", ") || null)
                      }
                      dateTime={selectedBbq.date ?? null}
                      participantCount={participants.length}
                      sharedTotal={Number(totalSpent)}
                      expenseCount={expenses.length}
                      currency={(selectedBbq.currency as string) || defaultCurrency}
                      onSummaryClick={() => openPanel({ type: "plan-details" })}
                      currentUser={{
                        id: user?.id ?? null,
                        username: user?.username ?? null,
                        avatarUrl: user?.avatarUrl ?? null,
                      }}
                      enabled={!!user}
                      className={cn(
                        "h-full min-w-0 flex-1 rounded-[28px] border bg-[hsl(var(--surface-1))]",
                        activeSurface === "chat"
                          ? "border-black/5 shadow-[0_8px_20px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-[hsl(var(--surface-1))] dark:shadow-[0_10px_24px_rgba(0,0,0,0.24)]"
                          : "border-black/5 shadow-[0_4px_12px_rgba(15,23,42,0.045)] dark:border-white/6 dark:bg-[hsl(var(--surface-1))]/95 dark:shadow-[0_4px_12px_rgba(0,0,0,0.16)]",
                      )}
                    />
                  </div>
                  <ContextPanelHost
                    key={`panel-host-${selectedBbq.id}`}
                    className={cn(
                      "",
                      activeSurface === "panel" ? "z-20 -translate-y-px" : "z-10 translate-y-0",
                    )}
                    shellClassName={cn(
                      activeSurface === "panel"
                        ? "border-black/5 bg-[hsl(var(--surface-1))] shadow-[0_8px_20px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-[hsl(var(--surface-1))] dark:shadow-[0_10px_24px_rgba(0,0,0,0.24)]"
                        : "border-black/5 bg-[hsl(var(--surface-1))] shadow-[0_4px_12px_rgba(15,23,42,0.05)] dark:border-white/8 dark:bg-[hsl(var(--surface-1))] dark:shadow-[0_5px_14px_rgba(0,0,0,0.18)]",
                    )}
                    onMouseDown={(event) => {
                      if (isInteractiveSurfaceTarget(event.target)) return;
                      setActiveSurface("panel");
                    }}
                  />
                </div>

                {isPlanDetailsOpen ? (
                      <Suspense fallback={null}>
                        <PlanDetailsDrawer
                          open={isPlanDetailsOpen}
                          onOpenChange={setIsPlanDetailsOpen}
                          plan={selectedBbq}
                          saving={updateBbq.isPending}
                          isCreator={isCreator}
                          canEditDates={selectedBbq?.status === "active" && !selectedBbq?.timelineLocked}
                          deleting={deleteBbq.isPending}
                          leaving={leaveBbq.isPending}
                          onDelete={selectedBbq ? () => handleDeleteBbq(selectedBbq.id) : undefined}
                          onLeave={selectedBbq && (isCreator || !!myParticipant) ? () => handleLeaveBbq(selectedBbq.id) : undefined}
                          leaveTransferTargetName={isCreator ? creatorLeaveSuccessorName : null}
                          willDeleteOnLeave={isCreator && !creatorLeaveSuccessorName}
                          onSave={async (updates) => {
                            if (!selectedBbq) return;
                            const payload: {
                              id: number;
                              name: string;
                              locationText: string;
                              startDate: string;
                              endDate: string;
                              bannerImageUrl: string | null;
                            } = {
                              id: selectedBbq.id,
                              name: updates.name,
                              locationText: updates.locationText,
                              startDate: updates.startDate,
                              endDate: updates.endDate,
                              bannerImageUrl: updates.bannerUrl,
                            };
                            await updateBbq.mutateAsync(payload);
                            await queryClient.invalidateQueries({ queryKey: ["/api/barbecues"] });
                            await queryClient.refetchQueries({ queryKey: ["/api/barbecues"] });
                            toastSuccess("Plan details updated");
                          }}
                        />
                      </Suspense>
                    ) : null}
                {isPlanTypeOpen ? (
                      <Suspense fallback={null}>
                        <PlanTypeDrawer
                          open={isPlanTypeOpen}
                          onOpenChange={setIsPlanTypeOpen}
                          plan={selectedBbq}
                          saving={updateBbq.isPending}
                          onSave={async ({ mainType, subcategory }) => {
                            if (!selectedBbq) return;
                            const currentTemplateData = selectedBbq.templateData && typeof selectedBbq.templateData === "object"
                              ? (selectedBbq.templateData as Record<string, unknown>)
                              : {};
                            const nextTemplateData = {
                              ...currentTemplateData,
                              mainCategory: mainType,
                              privateMainCategory: mainType,
                              subCategory: subcategory ?? null,
                              privateSubCategory: subcategory ?? null,
                              privateEventTypeId: subcategory ?? null,
                            };
                            await updateBbq.mutateAsync({
                              id: selectedBbq.id,
                              eventType: getEventTypeForPlanType(mainType, subcategory),
                              templateData: nextTemplateData,
                            });
                            await queryClient.invalidateQueries({ queryKey: ["/api/barbecues"] });
                            await queryClient.refetchQueries({ queryKey: ["/api/barbecues"] });
                            toastSuccess("Plan type updated");
                            setIsPlanTypeOpen(false);
                          }}
                        />
                      </Suspense>
                    ) : null}
                {isActivityDrawerOpen ? (
                      <Suspense fallback={null}>
                        <ActivityDrawer
                          open={isActivityDrawerOpen}
                          onOpenChange={(next) => {
                            setIsActivityDrawerOpen(next);
                            if (next) {
                              void markAllAsRead();
                            }
                          }}
                          items={planActivityItems}
                          loading={planActivityLoading}
                          highlightedId={highlightedActivityId}
                          unreadCount={planActivityUnreadCount}
                          onMarkAllAsRead={markAllAsRead}
                        />
                      </Suspense>
                    ) : null}
              </div>
            );
          }

          if (import.meta.env.DEV && appRouteMode === "event") {
            console.warn("[LEGACY] Plan dashboard legacy render path reached in event mode");
          }

          const eventTemplate = getEventTemplate(selectedBbq?.eventType);
          const eventCategory = normalizeEvent(selectedBbq ?? {}).category;
          const eventKind = eventCategory === "trip" ? "trip" : "party";
          const headerProps = {
            category: normalizeEvent(selectedBbq ?? {}).category,
            type: normalizeEvent(selectedBbq ?? {}).type,
            themeCategoryKey: getEventCategoryFromData({
              eventType: selectedBbq?.eventType,
              templateData: selectedBbq?.templateData,
              visibilityOrigin: selectedBbq?.visibilityOrigin,
            }),
            title: selectedBbq?.name ?? "",
            dateStr: formatPlanDateRange(selectedBbq?.startDate, selectedBbq?.endDate, selectedBbq?.date) ?? undefined,
            locationDisplay:
              selectedBbq?.locationName ??
              (selectedBbq?.city && selectedBbq?.countryName
                ? `${selectedBbq.city}, ${selectedBbq.countryName}`
                : selectedBbq?.countryName ?? null),
            onAddExpense: handleHeaderPrimaryAction,
            addExpenseLabel: headerPrimaryActionLabel,
            isCreator: isCreator,
            eventStatus: eventStatus,
            showStatusPill: showEventStatusPill,
            showAddExpenseAction: headerPrimaryActionVisible,
            onOpenSettings: canEditEvent ? () => setEventSettingsOpen(true) : undefined,
            onAddToCalendar:
              selectedBbq?.date && isPrivateContext
                ? () => {
                    const range = inferEventDateRange(selectedBbq.date as unknown as string);
                    if (!range) {
                      toastInfo("Event date is missing or invalid.");
                      return;
                    }
                    const location =
                      selectedBbq.locationName ??
                      (selectedBbq.city && selectedBbq.countryName
                        ? `${selectedBbq.city}, ${selectedBbq.countryName}`
                        : selectedBbq.countryName ?? selectedBbq.city ?? null);
                    const origin = typeof window !== "undefined" ? window.location.origin : "";
                    const url = isPublicBuilderContext && selectedBbq.publicSlug
                      ? `${origin}/events/${selectedBbq.publicSlug}`
                      : selectedBbq.inviteToken
                        ? buildInviteUrl(selectedBbq.inviteToken)
                        : `${origin}/app/e/${selectedBbq.id}`;
                    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                    const ics = buildIcs({
                      uid: `event-${selectedBbq.id}@splanno`,
                      title: selectedBbq.name ?? "Splanno event",
                      start: range.start,
                      end: range.end,
                      allDay: range.allDay,
                      location,
                      description: selectedBbq.publicDescription ?? null,
                      url,
                      timezone,
                    });
                    const safeName = (selectedBbq.name ?? "event")
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-+|-+$/g, "")
                      .slice(0, 64) || "event";
                    downloadIcs(`${safeName}.ics`, ics);
                    toastSuccess("Calendar file downloaded");
                  }
                : undefined,
            onOpenInMaps:
              selectedBbq &&
              (selectedBbq.locationName || selectedBbq.city || selectedBbq.countryName)
                ? () => {
                    const query = selectedBbq.locationName
                      ?? [selectedBbq.city, selectedBbq.countryName].filter(Boolean).join(", ");
                    if (!query) return;
                    const url = buildMapsUrl({
                      query,
                      label: selectedBbq.name ?? query,
                      lat: selectedBbq.latitude ?? undefined,
                      lng: selectedBbq.longitude ?? undefined,
                    });
                    openMaps(url);
                  }
                : undefined,
            onShare:
              selectedBbq
                ? async () => {
                    const inviteToken = selectedBbq.inviteToken ?? null;
                    const url = isPublicBuilderContext && selectedBbq.publicSlug
                      ? `${typeof window !== "undefined" ? window.location.origin : ""}/events/${selectedBbq.publicSlug}`
                      : inviteToken
                        ? buildInviteUrl(inviteToken)
                        : null;
                    if (!url) {
                      toastInfo("Link not ready yet. Open Event Settings to generate an invite link.");
                      return;
                    }
                    const ok = await copyText(url);
                    if (ok) {
                      toastSuccess(t.bbq.copySuccess);
                      return;
                    }
                    setManualCopyValue(url);
                    setManualCopyOpen(true);
                    toastInfo("Copy failed — select and copy manually.");
                  }
                : undefined,
            onShareWhatsApp:
              selectedBbq && !isPublicBuilderContext
                ? async () => {
                    const inviteToken = selectedBbq.inviteToken
                      ? selectedBbq.inviteToken
                      : (canEditEvent ? (await ensureInviteToken.mutateAsync(selectedBbq.id))?.inviteToken : null);
                    const url = inviteToken
                      ? buildInviteUrl(inviteToken)
                      : null;
                    if (!url) return;
                    const message = generateInviteMessage({
                      name: selectedBbq.name,
                      locationName: selectedBbq.locationName,
                      locationText: selectedBbq.locationText,
                      city: selectedBbq.city,
                      countryName: selectedBbq.countryName,
                      eventType: selectedBbq.eventType,
                      date: selectedBbq.date ?? null,
                    }, url);
                    const shareUrl = buildWhatsAppShareUrl(message);
                    window.open(shareUrl, "_blank", "noopener,noreferrer");
                    toastInfo("Opening WhatsApp…");
                  }
                : undefined,
            onCreateWhatsAppGroup:
              selectedBbq && !isPublicBuilderContext
                ? async () => {
                    const inviteToken = selectedBbq.inviteToken
                      ? selectedBbq.inviteToken
                      : (canEditEvent ? (await ensureInviteToken.mutateAsync(selectedBbq.id))?.inviteToken : null);
                    const url = inviteToken
                      ? buildInviteUrl(inviteToken)
                      : null;
                    if (!url) return;
                    const message = generateInviteMessage({
                      name: selectedBbq.name,
                      locationName: selectedBbq.locationName,
                      locationText: selectedBbq.locationText,
                      city: selectedBbq.city,
                      countryName: selectedBbq.countryName,
                      eventType: selectedBbq.eventType,
                      date: selectedBbq.date ?? null,
                    }, url);
                    setWhatsAppStarterLink(url);
                    setWhatsAppStarterMessage(message);
                    setWhatsAppStarterOpen(true);
                  }
                : undefined,
            shareLabel: isPublicBuilderContext ? "Copy link" : UI_COPY.actions.share,
            shareWhatsAppLabel: "Share to WhatsApp",
            createWhatsAppGroupLabel: "Create WhatsApp group",
            utilityPreferences: eventHeaderPrefs,
          };
          return (
            <EventThemeProvider kind={eventKind} eventType={selectedBbq?.eventType}>
            <div
              ref={eventViewRef}
              className={`grid gap-4 ${appRouteMode === "event" ? "h-[calc(100vh-9rem)] overflow-hidden lg:grid-cols-[minmax(0,1fr)_360px]" : ""}`}
            >
            <div className={`${appRouteMode === "event" ? "min-h-0 overflow-y-auto pr-1" : ""}`}>
            <EventTemplateWrapper
              template={eventTemplate}
              decorationClass={isPartyEventType(selectedBbq?.eventType) ? getPartyTemplate(selectedBbq?.eventType).decorationClass : undefined}
              backgroundStyle={isPartyEventType(selectedBbq?.eventType) ? getPartyTemplate(selectedBbq?.eventType).backgroundStyle : undefined}
            >
              {/* Event header with signature effect overlay */}
              <div className="relative">
                <SignatureEffect />
                {appRouteMode !== "event" && isPrivateContext && selectedBbq ? (
                  <PrivateEventHero
                    event={selectedBbq}
                    template={selectedPrivateTemplate}
                    participantNames={participants.map((p: Participant) => p.name)}
                    participantCount={participantCount}
                    headerProps={headerProps}
                    canEditBanner={canEditEvent}
                    onUploadBanner={canEditEvent ? async (dataUrl) => {
                      await uploadEventBanner.mutateAsync(dataUrl);
                      const currentTemplate = (selectedBbq.templateData && typeof selectedBbq.templateData === "object")
                        ? (selectedBbq.templateData as Record<string, unknown>)
                        : {};
                      const currentBanner = (currentTemplate.banner && typeof currentTemplate.banner === "object")
                        ? (currentTemplate.banner as Record<string, unknown>)
                        : {};
                      await updateBbq.mutateAsync({
                        id: selectedBbq.id,
                        templateData: {
                          ...currentTemplate,
                          banner: {
                            ...currentBanner,
                            type: "upload",
                            presetId: null,
                          },
                        },
                      });
                      toastSuccess("Banner updated");
                    } : undefined}
                    onSelectBannerPreset={canEditEvent ? async (presetId: EventBannerPresetId) => {
                      const currentTemplate = (selectedBbq.templateData && typeof selectedBbq.templateData === "object")
                        ? (selectedBbq.templateData as Record<string, unknown>)
                        : {};
                      const currentBanner = (currentTemplate.banner && typeof currentTemplate.banner === "object")
                        ? (currentTemplate.banner as Record<string, unknown>)
                        : {};
                      await updateBbq.mutateAsync({
                        id: selectedBbq.id,
                        bannerImageUrl: null,
                        templateData: {
                          ...currentTemplate,
                          privateBannerPreset: presetId,
                          banner: {
                            ...currentBanner,
                            type: "preset",
                            presetId,
                          },
                        },
                      });
                      toastSuccess("Banner preset applied");
                    } : undefined}
                    onResetBanner={canEditEvent ? async () => {
                      const currentTemplate = (selectedBbq.templateData && typeof selectedBbq.templateData === "object")
                        ? (selectedBbq.templateData as Record<string, unknown>)
                        : {};
                      const { privateBannerPreset: _privateBannerPreset, banner: _banner, ...restTemplate } = currentTemplate;
                      if (selectedBbq.bannerImageUrl) {
                        await deleteEventBanner.mutateAsync();
                      }
                      await updateBbq.mutateAsync({
                        id: selectedBbq.id,
                        bannerImageUrl: null,
                        templateData: restTemplate,
                      });
                      toastSuccess("Banner reset");
                    } : undefined}
                  />
                ) : (
                  <EventHeader {...headerProps} />
                )}
              </div>

              <EventSettingsModal
                open={eventSettingsOpen}
                onOpenChange={setEventSettingsOpen}
                event={selectedBbq ?? null}
                isCreator={!!canEditEvent}
                updating={updateBbq.isPending}
                publicListingActive={publicListingActive}
                visibilityLocked={selectedBbqVisibilityOriginLocked}
                onUpdate={(updates) => {
                  if (!selectedBbq) return;
                  updateBbq.mutate({ id: selectedBbq.id, ...updates }, {
                    onError: () => toastError("Couldn’t update plan settings. Try again."),
                  });
                }}
                onCopyInviteLink={
                  selectedBbq?.inviteToken
                    ? async () => {
                        const url = buildInviteUrl(selectedBbq.inviteToken);
                        const ok = await copyText(url);
                        if (ok) toastSuccess(t.bbq.copySuccess);
                        else toastInfo("Copy failed — select and copy manually.");
                      }
                    : selectedBbq && canEditEvent
                      ? async () => {
                          const ensured = await ensureInviteToken.mutateAsync(selectedBbq.id);
                          if (!ensured?.inviteToken) return;
                          const url = buildInviteUrl(ensured.inviteToken);
                          const ok = await copyText(url);
                          if (ok) toastSuccess(t.bbq.copySuccess);
                          else toastInfo("Copy failed — select and copy manually.");
                        }
                      : undefined
                }
                onOpenPublicPage={selectedBbq?.publicSlug ? () => window.open(`/events/${selectedBbq.publicSlug}`, "_blank") : undefined}
                onActivateListing={selectedBbq ? () => {
                  checkoutPublicListing.mutate(
                    { id: selectedBbq.id, publicMode: ((selectedBbq.publicMode === "joinable" || selectedBbq.publicMode === "marketing") ? selectedBbq.publicMode : "marketing") },
                    {
                      onSuccess: ({ url }) => { window.location.href = url; },
                      onError: (err) => {
                        const msg = (err as Error).message || "";
                        if (/APP_URL/i.test(msg)) return;
                        toastError("Couldn’t activate listing. Try again.");
                      },
                    },
                  );
                } : undefined}
                onDeactivateListing={selectedBbq ? () => {
                  deactivateListing.mutate(selectedBbq.id, {
                    onSuccess: () => toastSuccess("Listing deactivated"),
                    onError: () => toastError("Couldn’t deactivate listing. Try again."),
                  });
                } : undefined}
                allowOptInExpenses={selectedBbq?.allowOptInExpenses ?? false}
                onSettleUp={canEditEvent && !isPublicBuilderContext ? () => setSettleUpModalOpen(true) : undefined}
                settleUpPending={settleUp.isPending}
              />

              {isPrivateContext && selectedBbq && privateSuggestionsEligible && privateSuggestionState.enabled && !localSuggestionsMuted && inlineExploreSuggestions.length > 0 && (
                <div className={`mt-4 rounded-2xl border border-border/60 bg-card/90 p-4 shadow-sm ${privateMood.backgroundTintClass}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">
                        While you&apos;re in {selectedBbq.city || selectedBbq.countryName || "town"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {inlineExploreSuggestions.length} thing{inlineExploreSuggestions.length === 1 ? "" : "s"} happening around your dates
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setShowLocalSuggestionsModal(true)}
                    >
                      See more
                    </Button>
                  </div>
                  <div className="mt-3 space-y-2.5">
                    {inlineExploreSuggestions.map((suggestion) => {
                      const isSaved = privateSuggestionState.savedIds.includes(suggestion.id);
                      const votes = getSuggestionVotes(suggestion.id);
                      return (
                        <div
                          key={`inline-suggestion-${suggestion.id}`}
                          className="rounded-xl border border-border/50 bg-background/70 px-3 py-2.5"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{suggestion.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {suggestion.date ? new Date(suggestion.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Date TBA"}
                                {" · "}
                                {getSuggestionDistanceLabel({
                                  privateCity: selectedBbq.city,
                                  suggestionCity: suggestion.city,
                                  suggestionCountry: suggestion.countryName,
                                })}
                              </p>
                              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                                <div className="inline-flex items-center gap-1 rounded-lg bg-muted/30 p-0.5">
                                  {([
                                    { key: "up", emoji: "👍", label: "Interested" },
                                    { key: "maybe", emoji: "🤔", label: "Maybe" },
                                    { key: "down", emoji: "👎", label: "Skip" },
                                  ] as const).map((option) => (
                                    <button
                                      key={`${suggestion.id}-${option.key}`}
                                      type="button"
                                      className={`h-7 rounded-md px-2 text-xs transition-colors ${votes.mine === option.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                                      onClick={() => setSuggestionVote(suggestion.id, votes.mine === option.key ? null : option.key)}
                                      title={option.label}
                                    >
                                      {option.emoji}
                                    </button>
                                  ))}
                                </div>
                                {votes.up.length > 0 ? (
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <div className="flex -space-x-1.5">
                                      {votes.up.slice(0, 3).map((v) => (
                                        <span
                                          key={`${suggestion.id}-up-${v.userKey}`}
                                          className="grid h-5 w-5 place-items-center rounded-full border border-background bg-primary/10 text-[9px] font-semibold text-primary"
                                          title={v.label}
                                        >
                                          {getParticipantInitials(v.label)}
                                        </span>
                                      ))}
                                    </div>
                                    <span>{votes.up.length} interested</span>
                                  </div>
                                ) : votes.maybe.length > 0 ? (
                                  <span className="text-xs text-muted-foreground">{votes.maybe.length} maybe</span>
                                ) : null}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className={`h-7 px-2 text-xs ${isSaved ? "text-primary" : "text-muted-foreground"}`}
                                onClick={() =>
                                  setPrivateSuggestionState((prev) => ({
                                    ...prev,
                                    savedIds: prev.savedIds.includes(suggestion.id)
                                      ? prev.savedIds.filter((id) => id !== suggestion.id)
                                      : [...prev.savedIds, suggestion.id],
                                  }))
                                }
                              >
                                {isSaved ? "Saved" : "Save"}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-muted-foreground"
                                onClick={() =>
                                  setPrivateSuggestionState((prev) => ({
                                    ...prev,
                                    dismissedIds: prev.dismissedIds.includes(suggestion.id)
                                      ? prev.dismissedIds
                                      : [...prev.dismissedIds, suggestion.id],
                                  }))
                                }
                              >
                                Not interested
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Participant settling banner: show when status=settling and current user owes */}
              {!isPublicBuilderContext && hasLegacySettlingState && !isCreator && myParticipant && (() => {
                const myBalance = balances.find((b: { id: number }) => b.id === myParticipant.id) as { balance: number } | undefined;
                const amountOwed = myBalance && myBalance.balance < -0.01 ? Math.abs(myBalance.balance) : 0;
                if (amountOwed < 0.01) return null;
                const creatorName = selectedBbq?.creatorUserId === user?.id ? (user?.displayName || user?.username || "Someone") : "Someone";
                return (
                  <button
                    type="button"
                    onClick={() => setActiveEventTab("split")}
                    className="mt-4 w-full text-left rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex items-center gap-3 hover:bg-amber-500/15 transition-colors"
                    data-testid="banner-settle-up"
                  >
                    <span className="text-lg">💸</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {creatorName} {t.settleUp.participantBanner} 💸
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {isPrivateContext
                          ? `${t.settleUp.tapToSettle} ${formatMoney(amountOwed)}. Open settle up when you're ready.`
                          : `${t.settleUp.tapToSettle} ${formatMoney(amountOwed)}. Tap to settle up.`}
                      </p>
                    </div>
                  </button>
                );
              })()}

              {/* Inline stats row */}
              <div className={`mt-2 flex items-center gap-2 flex-wrap ${isPrivateContext ? `rounded-2xl ${privateMood.backgroundTintClass} px-3 py-2` : ""}`}>
                {isPrivateContext && participants.length > 0 && (
                  <div className="flex items-center -space-x-2 mr-1">
                    {participants.slice(0, 4).map((p: Participant) => (
                      <div
                        key={`stats-avatar-${p.id}`}
                        className={`h-6 w-6 rounded-full border border-background bg-primary/10 text-[10px] font-semibold ${privateMood.accentClass} grid place-items-center`}
                        title={p.name}
                        aria-hidden
                      >
                        {getParticipantInitials(p.name)}
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {isPublicBuilderContext
                    ? `${participantCount} ${participantCount === 1 ? "attendee" : "attendees"} · ${selectedBbq?.publicMode === "joinable" ? "Join requests enabled" : "Invite-only joins"} · ${publicListingActive ? "Listed" : "Unlisted"}`
                    : `${formatMoney(totalSpent)} spent · ${participantCount} ${participantCount === 1 ? "person" : "people"} · ${expenses.length} expense${expenses.length !== 1 ? "s" : ""}${!allowOptIn ? ` · ${formatMoney(fairShare)} ${t.fairShare.toLowerCase()}` : ""}`}
                </p>
                {showUpdatedAfterBadge && (
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 font-medium" data-testid="badge-updated-after">
                    {t.settleUp.updatedAfterSummary}
                  </span>
                )}
              </div>

              {/* Completion banner when event is settled */}
              {!isPublicBuilderContext && (eventStatus === "settled" || eventStatus === "archived") && (
                <div className={`mt-4 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-2.5 flex items-center gap-2 ${isPrivateContext ? "rounded-2xl bg-gradient-to-r from-emerald-500/12 to-emerald-500/6 ring-1 ring-emerald-500/10" : ""}`}>
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                  <p className="text-sm font-medium text-foreground">
                    {eventStatus === "archived"
                      ? "Plan archived. Everything is settled and frozen."
                      : `Plan completed. All balances are settled${wrapUpEndsLabel ? `, and chat stays open until ${wrapUpEndsLabel}` : "."}`}
                  </p>
                </div>
              )}

              {/* Creator: Mark as settled when all balances zero */}
              {!isPublicBuilderContext && isCreator && hasLegacySettlingState && allBalancesZero && (
                <div className={`mt-4 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 flex items-center justify-between gap-3 ${isPrivateContext ? "rounded-2xl bg-gradient-to-r from-emerald-500/12 to-transparent ring-1 ring-emerald-500/10" : ""}`}>
                  <p className="text-sm font-medium text-foreground">{isPrivateContext ? "Everything looks settled. You can close this out anytime." : t.settleUp.everyonePaid}</p>
                  <Button
                    size="sm"
                    onClick={() => selectedBbqId && updateBbq.mutate({ id: selectedBbqId, status: "settled" })}
                    disabled={updateBbq.isPending}
                    className="bg-green-600 hover:bg-green-700 text-white"
                    data-testid="button-mark-settled"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    {t.settleUp.markAsSettledButton}
                  </Button>
                </div>
              )}

            {appRouteMode === "event" && isPrivateContext && selectedBbq && (
              <div className="mt-4 space-y-4">
                <div
                  className={`relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-slate-900 dark:to-slate-800 min-h-[220px] transition-all duration-300 ${selectedEventVibeTheme.gradientClass}`}
                >
                  {!privateHeroBannerFailed && selectedBbq.bannerImageUrl ? (
                    <img
                      src={withCacheBust(
                        resolveAssetUrl(selectedBbq.bannerImageUrl),
                        toVersionToken((selectedBbq as { updatedAt?: string | Date | null }).updatedAt ?? selectedBbq.id),
                      ) ?? ""}
                      alt={selectedBbq.name}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
                      onLoad={() => setPrivateHeroBannerFailed(false)}
                      onError={(event) => {
                        const failedUrl = event.currentTarget.currentSrc || event.currentTarget.src || selectedBbq.bannerImageUrl;
                        console.error("BANNER_LOAD_FAILED", failedUrl);
                        setPrivateHeroBannerFailed(true);
                      }}
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-transparent" />
                  <div className="relative z-10 p-6 sm:p-7">
                    <p className="text-xs uppercase tracking-[0.16em] text-white/80">Private plan</p>
                    <h2 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-white">{selectedBbq.name}</h2>
                    <p className="mt-2 text-sm text-white/85">
                      {formatPlanDateRange(selectedBbq.startDate, selectedBbq.endDate, selectedBbq.date) ?? "Date TBD"}
                      {" · "}
                      {(selectedBbq.locationName ?? selectedBbq.city ?? selectedBbq.countryName ?? "Location TBD")}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/50 dark:border-slate-700/70 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{selectedPlanTypeHeadline}</p>
                    </div>
                    <span className="text-lg" aria-hidden>✨</span>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-border/60 bg-card p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Who’s bringing what</p>
                    <div className="mt-3 flex items-center -space-x-2">
                      {participants.slice(0, 5).map((p: Participant) => (
                        <span key={`bringing-${p.id}`} className="h-8 w-8 rounded-full border-2 border-background bg-primary/10 text-[11px] font-semibold grid place-items-center" title={p.name}>
                          {getParticipantInitials(p.name)}
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">Assign dishes and drinks in one tap.</p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-card p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Shared pot</p>
                    <p className="mt-2 text-xl font-semibold">{formatMoney(totalSpent)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{expenses.length} logged expense{expenses.length === 1 ? "" : "s"}</p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-card p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Quick actions</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setRecommendedExpenseTemplate({ item: "Wine", category: "Drinks" }); setIsAddExpenseOpen(true); }}>Add wine</Button>
                      <Button size="sm" variant="outline" onClick={() => setActiveEventTab("people")}>Assign dishes</Button>
                      <Button size="sm" variant="outline" onClick={() => setActiveEventTab("split")}>Start vote</Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Row C: Tabs */}
            <div className="mt-4">
            <EventPageTabsRouter
              isPublicEvent={isPublicBuilderContext}
              activeTab={activeEventTab}
              onTabChange={setActiveEventTab}
              isCreator={isCreator}
              showPrivateChatTab={showPrivateChatTab}
              labels={{
                expenses: t.tabs.expenses,
                people: t.tabs.people,
                split: t.tabs.split,
                notes: t.tabs.notes,
                chat: t.tabs.chat,
              }}
            >

              {isPublicBuilderContext && selectedBbq && (
                <>
                  <EventTabsContent value="overview" className="space-y-4">
                    <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-4 shadow-sm">
                      <div className="aspect-[16/7] rounded-xl border border-border/60 bg-muted/20 overflow-hidden flex items-center justify-center text-xs text-muted-foreground">
                        {!publicOverviewBannerFailed && selectedBbq.bannerImageUrl ? (
                          <img
                            src={withCacheBust(
                              resolveAssetUrl(selectedBbq.bannerImageUrl),
                              toVersionToken((selectedBbq as { updatedAt?: string | Date | null }).updatedAt ?? selectedBbq.id),
                            ) ?? ""}
                            alt={selectedBbq.name}
                            className="h-full w-full object-cover"
                            onLoad={() => setPublicOverviewBannerFailed(false)}
                            onError={(event) => {
                              const failedUrl = event.currentTarget.currentSrc || event.currentTarget.src || selectedBbq.bannerImageUrl;
                              console.error("BANNER_LOAD_FAILED", failedUrl);
                              setPublicOverviewBannerFailed(true);
                            }}
                          />
                        ) : (
                          "Add a banner in Settings to brand your public page"
                        )}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Listing mode</p>
                          <p className="text-sm font-medium mt-1">{selectedBbq.publicMode === "joinable" ? "Joinable" : "Marketing"}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Listing status</p>
                          <p className="text-sm font-medium mt-1">
                            {publicListingActive ? `Listed until ${selectedBbq.publicListingExpiresAt ? new Date(selectedBbq.publicListingExpiresAt).toLocaleDateString() : "—"}` : "Draft / unlisted"}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Description</p>
                        <p className="text-sm text-foreground/90 whitespace-pre-wrap">{selectedBbq.publicDescription || "Add a public description in Settings to explain what attendees should expect."}</p>
                      </div>
                    </div>
                  </EventTabsContent>
                  {isCreator && (
                    <EventTabsContent value="inbox" className="space-y-4">
                      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
                        <div className="rounded-2xl border border-border/60 bg-card p-3 space-y-2">
                          <div className="px-1">
                            <h3 className="text-sm font-semibold">Event inbox</h3>
                            <p className="text-xs text-muted-foreground mt-1">Organizer conversations for this public event only.</p>
                          </div>
                          {publicInboxList.isLoading ? (
                            <div className="space-y-2">
                              <div className="h-14 rounded-lg bg-muted/40 animate-pulse" />
                              <div className="h-14 rounded-lg bg-muted/40 animate-pulse" />
                            </div>
                          ) : publicInboxList.isError ? (
                            <div className="rounded-lg border border-border/50 bg-muted/15 p-4 text-sm text-muted-foreground">
                              Messages unavailable.
                            </div>
                          ) : publicInboxConversations.length === 0 ? (
                            <div className="rounded-lg border border-border/50 bg-muted/15 p-4 text-sm text-muted-foreground">{EMPTY_COPY.publicNoMessages}</div>
                          ) : (
                            <div className="space-y-2">
                              {publicInboxConversations.map((convo) => {
                                const selected = publicInboxConversationId === convo.id;
                                const title = convo.participant?.displayName || convo.participant?.username || convo.participantLabel || convo.participantEmail || "Attendee";
                                return (
                                  <button
                                    key={`public-inbox-convo-${convo.id}`}
                                    type="button"
                                    onClick={() => setPublicInboxConversationId(convo.id)}
                                    className={`w-full rounded-xl border p-3 text-left transition ${selected ? "border-primary bg-primary/5" : "border-border/60 hover:bg-muted/20"}`}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="text-sm font-medium truncate">{title}</p>
                                      <span className={`text-[10px] uppercase tracking-wide ${convo.status === "pending" ? "text-amber-600 dark:text-amber-300" : "text-muted-foreground"}`}>{convo.status}</span>
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{convo.lastMessage?.body || EMPTY_COPY.publicNoMessages}</p>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <div className="rounded-2xl border border-border/60 bg-card p-4 flex min-h-[420px] flex-col">
                          {!publicInboxConversationId ? (
                            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Select a conversation to reply.</div>
                          ) : publicInboxThread.isLoading ? (
                            <div className="space-y-3">
                              <div className="h-12 rounded-lg bg-muted/30 animate-pulse w-2/3" />
                              <div className="h-12 rounded-lg bg-muted/30 animate-pulse w-1/2 ml-auto" />
                              <div className="h-12 rounded-lg bg-muted/30 animate-pulse w-3/5" />
                            </div>
                          ) : publicInboxThread.data ? (
                            <>
                              <div className="flex items-center justify-between gap-3 pb-3 border-b border-border/60">
                                <div>
                                  <p className="text-sm font-semibold">{publicInboxThread.data.conversation.participantLabel || publicInboxThread.data.messages[0]?.sender?.displayName || "Conversation"}</p>
                                  <p className="text-xs text-muted-foreground">Event inbox thread</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {publicInboxThread.data.conversation.status === "pending" && (
                                    <Button size="sm" variant="outline" disabled={updateConversationStatus.isPending} onClick={() => updateConversationStatus.mutate("active")}>Accept</Button>
                                  )}
                                  <Button size="sm" variant="ghost" disabled={updateConversationStatus.isPending} onClick={() => updateConversationStatus.mutate("blocked")}>Block</Button>
                                </div>
                              </div>
                              <div className="flex-1 min-h-0 overflow-y-auto py-3 space-y-2">
                                {publicInboxThread.data.messages.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">{EMPTY_COPY.publicNoMessages}</p>
                                ) : (
                                  publicInboxThread.data.messages.map((msg) => {
                                    const mine = !!user && msg.senderUserId === user.id;
                                    return (
                                      <div key={`public-inbox-msg-${msg.id}`} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                                        <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted/25 border border-border/60"}`}>
                                          <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                                          <p className={`mt-1 text-[10px] ${mine ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{msg.createdAt ? new Date(msg.createdAt).toLocaleString() : ""}</p>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                              <div className="pt-3 border-t border-border/60 flex items-end gap-2">
                                <Textarea value={publicInboxDraft} onChange={(e) => setPublicInboxDraft(e.target.value)} className="min-h-[72px]" placeholder="Reply to attendee…" onKeyDown={(e) => {
                                  if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    const next = publicInboxDraft.trim();
                                    if (!next) return;
                                    sendPublicInboxMessage.mutate(next, {
                                      onSuccess: () => setPublicInboxDraft(""),
                                      onError: () => toastError("Couldn’t update request status. Try again."),
                                    });
                                  }
                                }} />
                                <Button disabled={sendPublicInboxMessage.isPending || !publicInboxDraft.trim()} onClick={() => {
                                  const next = publicInboxDraft.trim();
                                  if (!next) return;
                                  sendPublicInboxMessage.mutate(next, {
                                    onSuccess: () => setPublicInboxDraft(""),
                                    onError: () => toastError("Couldn’t update request status. Try again."),
                                  });
                                }}>Send</Button>
                              </div>
                            </>
                          ) : (
                            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">This conversation is unavailable right now.</div>
                          )}
                        </div>
                      </div>
                    </EventTabsContent>
                  )}
                  <EventTabsContent value="content">
                    <div className="rounded-2xl border border-border/60 bg-card p-6">
                      <EmptyState
                        icon="🗂️"
                        title="No content yet"
                        description="Post updates when you’re ready — your attendees will see them here."
                      />
                    </div>
                  </EventTabsContent>
                </>
              )}

              {/* People Tab */}
              <EventTabsContent value={publicPeopleTabValue} className="space-y-4">
                {isPublicBuilderContext && isCreator && (
                  <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold">RSVP requests</h3>
                        <p className="text-xs text-muted-foreground mt-1">Review requests for joinable public events and manage attendee status.</p>
                      </div>
                    </div>
                    {publicRsvpRequests.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No requests yet — approvals will appear here.</p>
                    ) : (
                      <div className="space-y-2">
                        {publicRsvpRequests.map((req) => (
                          <div key={`public-rsvp-request-${req.id}`} className="rounded-lg border border-border/60 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{req.name || `User #${req.userId ?? "guest"}`}</p>
                              <p className="text-xs text-muted-foreground mt-1">Tier: {req.tierId || "General"} · Status: {req.status}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="outline" disabled={updatePublicRsvpRequest.isPending} onClick={() => updatePublicRsvpRequest.mutate({ rsvpId: req.id, status: "approved" })}>Approve</Button>
                              <Button size="sm" variant="ghost" disabled={updatePublicRsvpRequest.isPending} onClick={() => updatePublicRsvpRequest.mutate({ rsvpId: req.id, status: "declined" })}>Decline</Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {!isPublicBuilderContext && (canManage || isCreator) && (
                  <InviteLink
                    url={
                      selectedBbq?.inviteToken
                        ? buildInviteUrl(selectedBbq.inviteToken)
                        : ""
                    }
                    onEnsureToken={
                      selectedBbq && !selectedBbq.inviteToken && isCreator
                        ? async () => {
                            const bbq = await ensureInviteToken.mutateAsync(selectedBbq.id);
                            return bbq?.inviteToken
                              ? buildInviteUrl(bbq.inviteToken)
                              : null;
                          }
                        : undefined
                    }
                    label={t.bbq.inviteLink}
                    copyLabel={t.bbq.copy}
                    copySuccess={t.bbq.copySuccess}
                    shareLabel={t.bbq.share}
                  />
                )}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t.participants}</h3>
                  <div className="flex items-center gap-2">
                    {!isPublicBuilderContext && canManage && (
                      <Button size="sm" onClick={() => setIsAddPersonOpen(true)} className="btn-interact bg-primary text-primary-foreground font-medium shrink-0" data-testid="button-add-person">
                        <Plus className="w-4 h-4 mr-1.5" />
                        {t.addPerson}
                      </Button>
                    )}
                    {canManage && isPrivate && (
                      <InviteSheet
                        trigger={
                          <Button size="sm" variant="outline" className="border-border shrink-0" data-testid="button-invite-sheet">
                            <UserPlus className="w-4 h-4 mr-1.5" />
                            {t.bbq.inviteUser}
                          </Button>
                        }
                        inviteUsername={inviteUsername}
                        onInviteUsernameChange={setInviteUsername}
                        onInvite={handleInvite}
                        invitePending={inviteParticipant.isPending}
                        title={t.bbq.inviteUser}
                        inviteLabel={t.bbq.invite}
                        placeholder={t.bbq.inviteUsernamePlaceholder}
                        inviteFromFriends={t.friends.inviteFromFriends}
                        pendingInvites={t.bbq.pendingInvites}
                        invited={t.bbq.invited}
                        friends={friends}
                        invitedParticipants={invitedParticipants}
                        participantUserIds={new Set(participants.map((p: Participant) => p.userId).filter((value: Participant["userId"]): value is number => typeof value === "number"))}
                        onInviteFriend={(username) =>
                          inviteParticipant.mutate(username, {
                            onError: (err: unknown) => {
                              if (err instanceof UpgradeRequiredError) showUpgrade(err.payload);
                              else toastError("Couldn’t save attendee update. Try again.");
                            },
                          })
                        }
                        onRejectInvite={(id) => rejectParticipant.mutate(id)}
                        onViewUser={(u) => {
                          setProfileTargetUsername(u);
                          setAccountView("profile");
                          setIsAccountDrawerOpen(true);
                        }}
                      />
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                {participants.map((p: Participant) => {
                    const paid = expenses
                      .filter((e: ExpenseWithParticipant) => e.participantId === p.id)
                      .reduce((s: number, e: ExpenseWithParticipant) => s + Number(e.amount), 0);
                    const isOwn = p.userId === user?.id;
                    const isEditing = editingParticipantId === p.id;
                    return (
                      <div
                        key={p.id}
                        className={`inline-flex items-center gap-2 border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-2))]/50 rounded-[var(--radius-md)] px-2.5 py-1 text-sm ${isPrivateContext ? `rounded-2xl border-border/60 bg-gradient-to-b from-[hsl(var(--surface-2))]/70 to-[hsl(var(--surface-0))]/60 px-3 py-1.5 shadow-sm shadow-neutral-200/25 dark:shadow-black/10 ${privateMood.hoverScaleClass} transition-transform ${privateMood.motionDurationClass} motion-reduce:transition-none` : ""}`}
                        data-testid={`chip-participant-${p.id}`}
                      >
                        {isPrivateContext && !isEditing && (
                          <span className={`grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-[10px] font-semibold ${privateMood.accentClass} flex-shrink-0`}>
                            {getParticipantInitials(p.name)}
                          </span>
                        )}
                        {isEditing ? (
                          <>
                            <Input
                              value={editingParticipantName}
                              onChange={e => setEditingParticipantName(e.target.value)}
                              className="h-7 w-24 text-sm"
                              onKeyDown={e => {
                                if (e.key === "Enter") {
                                  if (editingParticipantName.trim()) {
                                    updateParticipantName.mutate({ id: p.id, name: editingParticipantName.trim() }, {
                                      onSuccess: () => { setEditingParticipantId(null); setEditingParticipantName(""); },
                                      onError: () => {},
                                    });
                                  }
                                }
                                if (e.key === "Escape") { setEditingParticipantId(null); setEditingParticipantName(""); }
                              }}
                              data-testid={`input-edit-participant-${p.id}`}
                            />
                            <button
                              onClick={() => {
                                if (editingParticipantName.trim()) {
                                  updateParticipantName.mutate({ id: p.id, name: editingParticipantName.trim() }, {
                                    onSuccess: () => { setEditingParticipantId(null); setEditingParticipantName(""); },
                                  });
                                }
                              }}
                              disabled={!editingParticipantName.trim() || updateParticipantName.isPending}
                              className="text-primary hover:text-primary/80"
                              title={t.modals.save}
                            >
                              {updateParticipantName.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => { setEditingParticipantId(null); setEditingParticipantName(""); }}
                              className="text-muted-foreground hover:text-foreground"
                              title={t.modals.cancel}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            {p.userId ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const targetUsername = p.userId ? usernameByUserId.get(p.userId) : null;
                                  if (!targetUsername) return;
                                  setProfileTargetUsername(targetUsername);
                                  setAccountView("profile");
                                  setIsAccountDrawerOpen(true);
                                }}
                                className="font-medium text-left hover:text-primary hover:underline"
                                data-testid={`link-participant-profile-${p.id}`}
                              >
                                {p.name}
                              </button>
                            ) : (
                              <span className="font-medium">{p.name}</span>
                            )}
                            {isOwn && (
                              <button
                                onClick={() => { setEditingParticipantId(p.id); setEditingParticipantName(p.name); }}
                                className="text-muted-foreground hover:text-foreground ml-0.5"
                                title={t.user.editNameInBbq}
                                data-testid={`button-edit-name-${p.id}`}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        )}
                        {!isEditing && <span className="text-primary text-xs font-semibold">{formatMoney(paid)}</span>}
                        {!isEditing && canLeave(p) && (
                          <button
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              if (!window.confirm("Leave this plan?")) return;
                              const leavingEventId = selectedBbqId;
                              deleteParticipant.mutate(p.id, {
                                onSuccess: async () => {
                                  await queryClient.invalidateQueries({ queryKey: ['/api/barbecues'] });
                                  await queryClient.invalidateQueries({ queryKey: ['/api/memberships'] });
                                  await queryClient.refetchQueries({ queryKey: ['/api/barbecues'] });
                                  if (leavingEventId != null) {
                                    if (typeof window !== "undefined") {
                                      sessionStorage.setItem(LEAVE_REDIRECT_MARKER_KEY, JSON.stringify({ id: leavingEventId, at: Date.now() }));
                                    }
                                    removePlanFromClientState(leavingEventId);
                                    setSelectedBbqId(null);
                                    setLocation("/app/private", { replace: true });
                                  }
                                },
                              });
                            }}
                            className="text-muted-foreground hover:text-destructive ml-0.5"
                            title={t.user.leave}
                            data-testid={`button-leave-${p.id}`}
                          >
                            <LogOut className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {!isEditing && canManage && p.userId !== username && (
                          <button
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              if (!window.confirm("Remove this member from the plan?")) return;
                              deleteParticipant.mutate(p.id);
                            }}
                            className="text-muted-foreground hover:text-destructive ml-0.5"
                            title={t.bbq.delete}
                            data-testid={`button-remove-${p.id}`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </EventTabsContent>

              {/* Expenses Tab */}
              {!isPublicBuilderContext && <EventTabsContent value="expenses" className="space-y-3">
                {/* Quick add chips — up to 5 + More */}
                {(isCreator || isAcceptedMember) && (isTripEventType(selectedBbq?.eventType) || isPartyEventType(selectedBbq?.eventType)) && (() => {
                  const { category, type } = normalizeEvent(selectedBbq ?? {});
                  return (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-muted-foreground">Quick add:</span>
                      <QuickAddChips
                        theme={getEventTheme(category, type)}
                        presets={isPrivateContext ? selectedPrivateTemplate.defaultQuickAdds : getExpenseTemplates(category, type)}
                        onAdd={(p) => {
                          setRecommendedExpenseTemplate({ item: p.item, category: p.category, optInDefault: p.optInDefault });
                          setEditingExpense(null);
                          setIsAddExpenseOpen(true);
                        }}
                        allowOptIn={allowOptIn}
                      />
                    </div>
                  );
                })()}
                <div className={`rounded-[var(--radius-lg)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-3 shadow-[var(--shadow-sm)] ${isPrivateContext ? `rounded-2xl border-border/60 bg-gradient-to-b from-[hsl(var(--surface-1))] to-[hsl(var(--surface-0))] p-4 shadow-sm shadow-neutral-200/40 dark:shadow-black/20 ${privateMood.ringClass} ring-1` : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-muted-foreground">Expenses</h3>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      onClick={() => setExpensesCollapsed((v) => !v)}
                      data-testid="button-toggle-expenses-list"
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform ${expensesCollapsed ? "" : "rotate-180"}`} />
                    </Button>
                  </div>
                  {!expensesCollapsed && (
                    <div className="mt-3">
                      {expenses.length === 0 ? (
                        (() => {
                          const { category: eventCategory, type: eventType } = normalizeEvent(selectedBbq ?? {});
                          const theme = getEventTheme(eventCategory, eventType);
                          return (
                            <EmptyState
                              icon={theme.icon}
                              title={isPrivateContext ? EMPTY_COPY.privateExpensesTitle : theme.copy.emptyExpensesTitle}
                              description={isPrivateContext ? EMPTY_COPY.privateExpensesBody : theme.copy.emptyExpensesBody}
                              iconClassName={theme.accent.bg}
                              className={isPrivateContext ? "py-20" : undefined}
                              primaryAction={
                                (isCreator || isAcceptedMember)
                                  ? {
                                      label: theme.copy.ctaAddFirstExpense,
                                      icon: <Plus className="w-4 h-4" />,
                                      onClick: () => {
                                        setRecommendedExpenseTemplate(null);
                                        setEditingExpense(null);
                                        setIsAddExpenseOpen(true);
                                      },
                                      testId: "button-add-first-expense",
                                    }
                                  : undefined
                              }
                            />
                          );
                        })()
                      ) : (
                        <div className={isPrivateContext ? "space-y-2.5" : "space-y-2"}>
                          {expenses.map((exp: ExpenseWithParticipant) => {
                      const IconComp = getCategoryDef(exp.category).icon;
                      const color = getCategoryColor(exp.category);
                      const everyoneInByDefault = expenseSharesList.length === 0;
                      const isInForExp = myParticipant
                        ? (everyoneInByDefault ? true : shareSet.has(`${exp.id}:${myParticipant.id}`))
                        : false;
                            const reactionUserKey = username ?? `guest-${user?.id ?? "anon"}`;
                            return (
                        <div
                          key={exp.id}
                          className={`flex flex-col rounded-[var(--radius-lg)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-0))]/70 px-3 py-2.5 group shadow-[var(--shadow-sm)] ${isPrivateContext ? `rounded-2xl border-border/60 bg-gradient-to-b from-[hsl(var(--surface-0))]/90 to-[hsl(var(--surface-1))]/80 px-3.5 py-3 shadow-sm shadow-neutral-200/35 dark:shadow-black/10 ${privateMood.hoverScaleClass} transition-transform ${privateMood.motionDurationClass} motion-reduce:transition-none ${privateMood.ringClass} ring-1` : ""}`}
                          data-testid={`expense-item-${exp.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`flex items-center justify-center flex-shrink-0 bg-muted/40 dark:bg-muted/30 ${isPrivateContext ? "w-8 h-8 rounded-xl" : "w-7 h-7 rounded-md"}`}>
                              <IconComp className="w-4 h-4" style={{ color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">{exp.item}</div>
                              <div className="text-xs text-muted-foreground">
                                {t.categories[exp.category as keyof typeof t.categories] || exp.category}
                                {" · "}
                                {exp.participantUserId ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const targetUsername = exp.participantUserId ? usernameByUserId.get(exp.participantUserId) : null;
                                      if (!targetUsername) return;
                                      setProfileTargetUsername(targetUsername);
                                      setAccountView("profile");
                                      setIsAccountDrawerOpen(true);
                                    }}
                                    className={`hover:text-primary hover:underline ${isPrivateContext ? "decoration-primary/40" : ""}`}
                                    data-testid={`link-expense-payer-${exp.id}`}
                                  >
                                    {exp.participantName}
                                  </button>
                                ) : (
                                  exp.participantName
                                )}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                Split: {(() => {
                                  const ids = parseIncludedUserIds(exp.includedUserIds);
                                  return ids.length > 0 ? `${ids.length} people` : "Everyone";
                                })()}
                              </div>
                              {isPrivateContext && exp.receiptUrl && (
                                <button
                                  type="button"
                                  className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                                  onClick={() => window.open(exp.receiptUrl as string, "_blank", "noopener,noreferrer")}
                                >
                                  <img
                                    src={exp.receiptUrl as string}
                                    alt="Receipt thumbnail"
                                    className="h-5 w-5 rounded border border-border/60 object-cover"
                                  />
                                  Receipt
                                </button>
                              )}
                            </div>
                            {allowOptIn && myParticipant && (
                              <button
                                onClick={() => setExpenseShare.mutate({ expenseId: exp.id, in: !isInForExp })}
                                disabled={setExpenseShare.isPending}
                                className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded border transition-colors ${
                                  isInForExp ? 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/25' : 'bg-muted/30 text-muted-foreground border-border/60 hover:border-border hover:bg-muted/50'
                                }`}
                                data-testid={`expense-share-toggle-${exp.id}`}
                                title={isInForExp ? t.bbq.imOut : t.bbq.imIn}
                              >
                                {isInForExp ? t.bbq.imIn : t.bbq.imOut}
                              </button>
                            )}
                            <div className="text-right flex-shrink-0">
                              <div className="font-bold text-primary">{formatMoney(Number(exp.amount))}</div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {(
                                !String((exp as { linkedSettlementRoundId?: string | null }).linkedSettlementRoundId ?? "").trim()
                                && !(exp as { settledAt?: string | Date | null }).settledAt
                                && !(exp as { excludedFromFinalSettlement?: boolean | null }).excludedFromFinalSettlement
                                && String((exp as { resolutionMode?: string | null }).resolutionMode ?? "").trim().toLowerCase() !== "now"
                              ) ? (
                                <Button size="icon" variant="ghost" className="w-7 h-7 text-muted-foreground hover:text-foreground"
                                  onClick={() => { setEditingExpense(exp); setIsAddExpenseOpen(true); }}
                                  data-testid={`button-edit-expense-${exp.id}`}>
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>
                              ) : null}
                              {Number((exp as { createdByUserId?: number | null }).createdByUserId ?? 0) === Number(user?.id ?? 0) ? (
                                <Button size="icon" variant="ghost" className="w-7 h-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => {
                                    if (!window.confirm("Delete this expense? This will permanently remove it from shared costs.")) return;
                                    deleteExpense.mutate(exp.id);
                                  }}
                                  data-testid={`button-delete-expense-${exp.id}`}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              ) : null}
                            </div>
                          </div>
                          <ExpenseReactionBar
                            expenseId={exp.id}
                            reactions={getReactions(exp.id)}
                            reactionUsers={getReactionUsers(exp.id)}
                            myReaction={getUserReaction(exp.id, reactionUserKey)}
                            onReact={(emoji) => addReaction(exp.id, emoji, reactionUserKey)}
                            reducedMotion={!!shouldReduceMotion}
                          />
                        </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Category Chart */}
                {chartData.length > 0 && (
                  <div className={`rounded-[var(--radius-lg)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-4 shadow-[var(--shadow-sm)] ${isPrivateContext ? `rounded-2xl border-border/60 bg-gradient-to-b from-[hsl(var(--surface-1))] to-[hsl(var(--surface-0))] shadow-sm shadow-neutral-200/40 dark:shadow-black/20 p-[1.1rem] ${privateMood.ringClass} ring-1` : ""}`}>
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <h3 className="text-sm font-semibold text-muted-foreground">{t.bbq.breakdown}</h3>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground"
                        onClick={() => setBreakdownCollapsed((v) => !v)}
                        data-testid="button-toggle-breakdown"
                      >
                        <ChevronDown className={`w-4 h-4 transition-transform ${breakdownCollapsed ? "" : "rotate-180"}`} />
                      </Button>
                    </div>
                    {!breakdownCollapsed && (
                    <div className="flex items-center gap-4 flex-wrap">
                      <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                          <Pie data={chartData} dataKey="value" cx="50%" cy="50%" outerRadius={65} innerRadius={40}>
                            {chartData.map((entry) => (
                              <Cell key={entry.name} fill={getCategoryColor(entry.name)} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number | string) => {
                            const converted = convertCurrency(Number(value), currency, displayCurrency);
                            return [`${displayCurrencyInfo.symbol}${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, ''];
                          }}
                            contentStyle={{ background: 'hsl(var(--surface-1))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 'var(--radius-lg)' }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-1.5 flex-1 min-w-[120px]">
                        {chartData.map(d => {
                          const converted = convertCurrency(d.value, currency, displayCurrency);
                          return (
                            <div key={d.name} className="flex items-center gap-2 text-xs">
                              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: getCategoryColor(d.name) }} />
                              <span className="text-muted-foreground flex-1">{d.translatedName}</span>
                              <span className="font-semibold">{displayCurrencyInfo.symbol}{converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    )}
                  </div>
                )}

                {/* Recent Activity — below expenses */}
                {selectedBbq && (
                  <div className="mt-8 pt-6 border-t border-border/50">
                    <EventActivityFeed
                      items={getEventActivity({
                        event: {
                          id: selectedBbq.id,
                          name: selectedBbq.name,
                          date: selectedBbq.date,
                          currency: selectedBbq.currency,
                          creatorUserId: selectedBbq.creatorUserId,
                        },
                        expenses: expenses.map((e: ExpenseWithParticipant) => ({
                          id: e.id,
                          item: e.item,
                          amount: e.amount,
                          participantName: e.participantName,
                        })),
                        participants: participants.map((p: Participant) => ({
                          id: p.id,
                          name: p.name,
                          userId: p.userId,
                        })),
                        creatorDisplayName: selectedBbq.creatorUserId === user?.id ? user?.displayName : undefined,
                      })}
                      title={t.activity.recentActivity}
                    />
                  </div>
                )}
              </EventTabsContent>}

              {/* Split Check Tab (private only) */}
              {!isPublicBuilderContext && <EventTabsContent value="split" className="space-y-4">
                <IndividualContributions
                  balances={balances}
                  totalSpent={totalSpent}
                  formatMoney={formatMoney}
                  emptyLabel={isPrivateContext ? selectedPrivateTemplate.emptyStates.splitCheck : t.emptyState.title}
                  contributionsLabel={t.split.contributions}
                  reducedMotion={!!shouldReduceMotion}
                  warm={isPrivateContext}
                />

                {totalSpent > 0 && participantCount > 0 && (() => {
                  const { category, type } = normalizeEvent(selectedBbq ?? {});
                  const eventTheme = getEventTheme(category, type);
                  const biggestSpender = [...participants].map((p) => ({
                    name: p.name,
                    paid: expenses.filter((e: ExpenseWithParticipant) => e.participantId === p.id).reduce((s: number, e: ExpenseWithParticipant) => s + Number(e.amount), 0),
                  })).sort((a, b) => b.paid - a.paid)[0];
                  const recapData = generateRecapCardData(
                    { name: selectedBbq?.name ?? "", currency: selectedBbq?.currency ?? defaultCurrency },
                    {
                      totalSpent,
                      participantCount,
                      expenseCount: expenses.length,
                      participantNames: participants.map((p: Participant) => p.name),
                      funStat: biggestSpender?.paid
                        ? { type: "biggest_spender" as const, label: "Biggest spender", value: `${biggestSpender.name} (${formatMoney(biggestSpender.paid)})` }
                        : undefined,
                    }
                  );
                  const shareLink = selectedBbq?.inviteToken
                    ? buildInviteUrl(selectedBbq.inviteToken)
                    : null;
                  return (
                    <div className="mb-2">
                      <ShareRecapWithMenu
                        data={recapData}
                        theme={eventTheme}
                        shareLink={shareLink}
                        shareSummaryLabel={t.split.shareSummary}
                        labels={{
                          share: t.split.share,
                          shareWhatsApp: t.split.shareWhatsApp,
                          shareMore: t.split.shareMore,
                          downloadPng: t.split.downloadPng,
                          copyImage: t.split.copyImage,
                          copyImageUnsupported: t.split.copyImageUnsupported,
                          copyShareLink: t.split.copyShareLink,
                          copied: t.bbq.copySuccess,
                          downloaded: t.split.toastDownloaded,
                          shared: t.split.toastShared,
                          error: t.split.toastError,
                        }}
                      />
                    </div>
                  );
                })()}

                <SettlementPlan
                  settlements={settlements}
                  allSettledLabel={isPrivateContext ? "All settled. Everything feels clear." : t.split.allSettled}
                  owesLabel={t.split.owes}
                  settlementLabel={t.split.settlement}
                  formatMoney={formatMoney}
                  getSettleCardData={(s) => {
                    const { category, type } = normalizeEvent(selectedBbq ?? {});
                    const eventTheme = getEventTheme(category, type);
                    const subtitle = (t.eventTypes as Record<string, string>)[eventTheme.labelKey] ?? eventTheme.copy.tagline;
                    return generateSettleCardData(
                      { name: selectedBbq?.name ?? "", subtitle, currency: selectedBbq?.currency ?? defaultCurrency },
                      s,
                      subtitle
                    );
                  }}
                  getEventTheme={() => {
                    const { category, type } = normalizeEvent(selectedBbq ?? {});
                    return getEventTheme(category, type);
                  }}
                  shareLink={
                    selectedBbq?.inviteToken
                      ? buildInviteUrl(selectedBbq.inviteToken)
                      : null
                  }
                  shareLabels={{
                    share: t.split.share,
                    shareWhatsApp: t.split.shareWhatsApp,
                    shareMore: t.split.shareMore,
                    downloadPng: t.split.downloadPng,
                    copyImage: t.split.copyImage,
                    copyImageUnsupported: t.split.copyImageUnsupported,
                    copyShareLink: t.split.copyShareLink,
                    copied: t.bbq.copySuccess,
                    downloaded: t.split.toastDownloaded,
                    shared: t.split.toastShared,
                    error: t.split.toastError,
                  }}
                  warm={isPrivateContext}
                />
              </EventTabsContent>}

              {/* Notes Tab */}
              {!isPublicBuilderContext && <EventTabsContent value={privateNotesTabValue}>
                <NotesTab
                  eventId={selectedBbqId}
                  myParticipantId={myParticipant?.id ?? null}
                  canAddNote={!!myParticipant}
                  emptySubtitleOverride={isPrivateContext ? selectedPrivateTemplate.emptyStates.notes : undefined}
                />
              </EventTabsContent>}

              {/* Chat Tab — placeholder */}
              {!isPublicBuilderContext && showPrivateChatTab && <EventTabsContent value={privateChatTabValue}>
                <div
                  className="flex flex-col items-center justify-center py-16 px-6 rounded-xl border border-border bg-card/50"
                  style={{
                    background: "linear-gradient(to bottom, hsl(var(--card)), hsl(var(--muted) / 0.15))",
                  }}
                >
                  <div className="w-14 h-14 rounded-full flex items-center justify-center bg-primary/10 text-primary mb-4">
                    <MessageCircle className="w-7 h-7" />
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-primary/15 text-primary mb-2">
                    {t.activity.soon}
                  </span>
                  <h3 className="text-lg font-semibold font-display text-foreground">
                    {t.activity.chatComingSoon}
                  </h3>
                  <p className="text-sm text-muted-foreground text-center max-w-[260px] mt-1">
                    {t.activity.chatSubtitle}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-5 opacity-70 cursor-not-allowed"
                    disabled
                  >
                    {t.activity.enableChat}
                  </Button>
                </div>
              </EventTabsContent>}
            </EventPageTabsRouter>
            </div>
            </EventTemplateWrapper>
            </div>
            {appRouteMode === "event" && selectedBbq && (
              <div className="hidden md:block min-h-[340px] lg:min-h-0 lg:h-full">
                <ChatSidebar
                  eventId={selectedBbq.id}
                  eventName={selectedBbq.name}
                  eventType={selectedBbq.eventType ?? null}
                  planStatus={selectedBbq.status ?? null}
                  settledAt={selectedBbq.settledAt ?? null}
                  planEndDate={selectedBbq.endDate ?? selectedBbq.date ?? null}
                  templateData={selectedBbq.templateData}
                  location={
                    selectedBbq.locationText
                    ?? selectedBbq.locationName
                    ?? ([selectedBbq.city, selectedBbq.countryName].filter(Boolean).join(", ") || null)
                  }
                  dateTime={selectedBbq.date ?? null}
                  participantCount={participants.length}
                  sharedTotal={Number(totalSpent)}
                  expenseCount={expenses.length}
                  currency={(selectedBbq.currency as string) || defaultCurrency}
                  onSummaryClick={() => setIsPlanDetailsOpen(true)}
                  currentUser={{
                    id: user?.id ?? null,
                    username: user?.username ?? null,
                    avatarUrl: user?.avatarUrl ?? null,
                  }}
                  enabled={!!user}
                />
              </div>
            )}
            </div>
            </EventThemeProvider>
          );
        })() : appRouteMode === "private" ? (
          <div className="mx-auto min-h-full w-full max-w-[1400px] px-4 py-6 pb-10 sm:px-6 lg:px-10">
            <div className="mb-6">
              <div>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                  {getGreetingForCurrentTime(language)}, {firstNameFromName(user?.displayName || user?.username || homeCopy.greetingFallbackName)} 👋
                </h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  {homeCopy.activePlans(sortedPrivatePlansForOverview.length)}
                </p>
              </div>
            </div>

            <div className="mb-6 flex flex-wrap gap-2">
              {[
                { id: "recent" as const, label: homeCopy.sortRecent },
                { id: "date" as const, label: homeCopy.sortDate },
              ].map((option) => (
                <button
                  key={`private-plan-sort-${option.id}`}
                  type="button"
                  onClick={() => setPrivatePlanSort(option.id)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                    privatePlanSort === option.id
                      ? "border-primary/40 bg-primary text-primary-foreground shadow-sm"
                      : "border-border/70 bg-background/80 text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {isLoadingBbqs ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div key={`private-plan-skeleton-${idx}`} className="overflow-hidden rounded-[28px] border border-border/60 bg-card shadow-sm">
                    <SkeletonCard className="h-[120px] rounded-none" />
                    <div className="space-y-3 px-3 py-2">
                      <SkeletonLine className="h-4 w-2/3 rounded" />
                      <div className="flex items-center gap-2">
                        <SkeletonAvatar className="h-7 w-7" />
                        <SkeletonAvatar className="h-7 w-7" />
                        <SkeletonCard className="h-4 w-32 rounded-full" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : sortedPrivatePlansForOverview.length === 0 ? (
              <div className="flex min-h-[420px] items-center justify-center rounded-[32px] border border-border/60 bg-card px-6 py-12 text-center shadow-sm">
                <div className="max-w-sm">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-4xl">🗺️</div>
                  <p className="mt-6 text-2xl font-semibold text-slate-900 dark:text-slate-100">{homeCopy.noPlansTitle}</p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{homeCopy.noPlansSubtitle}</p>
                  <Button
                    type="button"
                    className="mt-6 rounded-full px-5 shadow-sm"
                    onClick={() => { setNewEventArea(area); setNewEventType(area === "trips" ? "city_trip" : "barbecue"); openNewPlanWizard("TYPE"); }}
                  >
                    <Plus className="mr-1.5 h-4 w-4" />
                    New Plan +
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {sortedPrivatePlansForOverview.map((plan) => {
                  const planId = Number(plan.id);
                  if (!Number.isFinite(planId)) return null;
                  const dateLabel = plan.date
                    ? new Intl.DateTimeFormat(HOME_DATE_LOCALE[language], { day: "numeric", month: "short", year: "numeric" }).format(new Date(plan.date))
                    : homeCopy.dateTba;
                  const locationLabel = plan.locationText
                    || plan.locationName
                    || [plan.city, plan.countryName].filter(Boolean).join(", ")
                    || homeCopy.locationTba;
                  const participantCountLabel = Number.isFinite(plan.participantCount) ? Number(plan.participantCount) : 0;
                  const sharedTotal = Number(plan.expenseTotal ?? 0);
                  const unreadCount = Number(plan.unreadCount ?? 0);
                  const lastActivityAt = plan.lastActivityAt ?? (plan.updatedAt as unknown as string | null);
                  const balance = Number(plan.myBalance ?? 0);
                  const participantPreview = Array.isArray(plan.participantPreview) ? plan.participantPreview : [];
                  const bannerUrl = resolveAssetUrl(plan.bannerImageUrl ?? null);
                  const shownParticipants = participantPreview.slice(0, 4);
                  const extraCount = Math.max(0, participantCountLabel - shownParticipants.length);
                  const personalStatus = sharedTotal <= 0
                    ? null
                    : balance > 0.009
                      ? {
                        label: homeCopy.youAreOwed(formatPlanSharedTotal(balance, (plan.currency as string) || defaultCurrency)),
                        className: "border-emerald-200/80 bg-emerald-100 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200",
                      }
                      : balance < -0.009
                        ? {
                          label: homeCopy.youOwe(formatPlanSharedTotal(Math.abs(balance), (plan.currency as string) || defaultCurrency)),
                          className: "border-orange-200/80 bg-orange-100 text-orange-800 dark:border-orange-500/30 dark:bg-orange-500/15 dark:text-orange-200",
                        }
                        : {
                          label: homeCopy.allSettled,
                          className: "border-slate-200/80 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200",
                        };
                  return (
                    <a
                      key={`private-plan-card-${planId}`}
                      href={`/app/e/${planId}`}
                      onClick={() => {
                        markEventRecent(planId);
                        if (import.meta.env.DEV) {
                          console.log("[private-plan-card:navigate]", { id: planId, href: `/app/e/${planId}` });
                        }
                      }}
                      className="interactive-card group pointer-events-auto relative z-10 block overflow-hidden rounded-[28px] border border-border/70 bg-card p-0 text-left shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      data-testid={`private-plan-card-${planId}`}
                    >
                      <div className="relative h-[120px] overflow-hidden">
                        {bannerUrl ? (
                          <img
                            src={bannerUrl}
                            alt=""
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                          />
                        ) : (
                          <div className={`h-full w-full bg-gradient-to-br ${getPrivatePlanGradient(plan)}`} />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/18 to-transparent" />
                        {unreadCount > 0 ? (
                          <span className="absolute right-4 top-4 inline-flex items-center rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-sm">
                            {unreadCount > 9 ? "9+" : unreadCount} {homeCopy.newSuffix}
                          </span>
                        ) : null}
                        <div className="absolute inset-x-0 bottom-0 px-4 py-3">
                          <h3 className="text-base font-semibold tracking-tight text-white drop-shadow-md">{plan.name}</h3>
                          <p className="mt-0.5 text-xs text-white/90 drop-shadow-md">{dateLabel}</p>
                          <p className="text-xs text-white/90 drop-shadow-md">{locationLabel}</p>
                        </div>
                      </div>
                      <div className="border-t border-border/50 bg-card px-3 py-2">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="flex -space-x-2">
                              {shownParticipants.map((participant, index) => (
                                <Avatar key={`private-plan-${planId}-participant-${participant.id}`} className="h-7 w-7 border-2 border-background shadow-sm">
                                  <AvatarFallback className={`text-[11px] font-semibold ${
                                    index === 0
                                      ? "bg-primary/20 text-primary dark:bg-primary/25 dark:text-primary-foreground"
                                      : "bg-muted text-foreground"
                                  }`}>
                                    {initialsFromName(participant.name)}
                                  </AvatarFallback>
                                </Avatar>
                              ))}
                              {extraCount > 0 ? (
                                <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-card text-[10px] font-semibold text-muted-foreground shadow-sm">
                                  +{extraCount}
                                </div>
                              ) : null}
                            </div>
                            <span className="truncate text-foreground">
                              {participantCountLabel} {participantCountLabel === 1 ? homeCopy.personSingular : homeCopy.personPlural}
                            </span>
                          </div>
                          <span className="text-border/80">·</span>
                          <span className="text-muted-foreground">{formatLastActivity(lastActivityAt)}</span>
                          <span className="text-border/80">·</span>
                          <span className="font-medium text-foreground">
                            {formatPlanSharedTotal(sharedTotal, (plan.currency as string) || defaultCurrency)} {homeCopy.sharedSuffix}
                          </span>
                          {personalStatus ? (
                            <>
                              <span className="text-border/80">·</span>
                              <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${personalStatus.className}`}>
                              {personalStatus.label}
                              </span>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <Receipt className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">{homeCopy.selectPlanPrompt}</p>
          </div>
        )}
        </>
        }
      </main>

      <Modal
        open={whatsAppStarterOpen}
        onClose={() => setWhatsAppStarterOpen(false)}
        onOpenChange={setWhatsAppStarterOpen}
        title="Create WhatsApp group"
        subtitle="Private events only"
        size="md"
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-2">
            <p className="text-sm font-medium">Step 1</p>
            <p className="text-xs text-muted-foreground">Tap “Open WhatsApp” to open a prefilled starter message.</p>
            <p className="text-sm font-medium">Step 2</p>
            <p className="text-xs text-muted-foreground">Create a new WhatsApp group and paste the message in the chat.</p>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Message</Label>
            <Textarea value={whatsAppStarterMessage} readOnly rows={6} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Event link</Label>
            <Input value={whatsAppStarterLink} readOnly />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Button
              type="button"
              onClick={() => {
                const shareUrl = buildWhatsAppShareUrl(whatsAppStarterMessage);
                window.open(shareUrl, "_blank", "noopener,noreferrer");
                toastInfo("Opening WhatsApp…");
              }}
            >
              Open WhatsApp
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                const ok = await copyText(whatsAppStarterMessage);
                if (ok) toastSuccess("Message copied");
                else toastInfo("Copy failed — select and copy manually.");
              }}
            >
              Copy message
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                const ok = await copyText(whatsAppStarterLink);
                if (ok) toastSuccess("Link copied");
                else toastInfo("Copy failed — select and copy manually.");
              }}
            >
              Copy event link
            </Button>
          </div>
          <p className="text-xs text-muted-foreground break-all">
            Direct link:{" "}
            <a
              className="text-primary hover:underline"
              href={buildWhatsAppShareUrl(whatsAppStarterMessage)}
              target="_blank"
              rel="noreferrer"
            >
              {buildWhatsAppShareUrl(whatsAppStarterMessage)}
            </a>
          </p>
        </div>
      </Modal>

      <Modal
        open={manualCopyOpen}
        onClose={() => setManualCopyOpen(false)}
        onOpenChange={setManualCopyOpen}
        title="Copy link manually"
        size="sm"
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Clipboard is blocked in this browser context. Select and copy the link manually.
          </p>
          <Input
            ref={manualCopyInputRef}
            value={manualCopyValue}
            readOnly
            onFocus={(e) => e.currentTarget.select()}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setManualCopyOpen(false)}
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={() => {
                manualCopyInputRef.current?.focus();
                manualCopyInputRef.current?.select();
              }}
            >
              Select link
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Location Modal (trips + parties with location) */}
      {selectedBbq && (area === "trips" || selectedBbq.city || selectedBbq.countryCode) && (
        <EditTripLocationModal
          open={editTripLocationOpen}
          onOpenChange={setEditTripLocationOpen}
          currentLocation={
            selectedBbq.city || selectedBbq.countryCode
              ? {
                  locationName: selectedBbq.locationName ?? (selectedBbq.city && selectedBbq.countryName ? `${selectedBbq.city}, ${selectedBbq.countryName}` : selectedBbq.countryName ?? selectedBbq.city ?? ""),
                  city: selectedBbq.city ?? "",
                  countryCode: selectedBbq.countryCode ?? "",
                  countryName: selectedBbq.countryName ?? "",
                  lat: selectedBbq.latitude ?? undefined,
                  lng: selectedBbq.longitude ?? undefined,
                }
              : null
          }
          currentCurrency={(selectedBbq.currency as string) || defaultCurrency}
          currencySource={(selectedBbq.currencySource as "auto" | "manual") || "auto"}
          onSave={(opts) => {
            if (!selectedBbqId) return;
            const payload: Parameters<typeof updateBbq.mutate>[0] = {
              id: selectedBbqId,
              locationName: opts.locationName,
              city: opts.city,
              countryCode: opts.countryCode,
              countryName: opts.countryName,
              latitude: opts.latitude ?? null,
              longitude: opts.longitude ?? null,
            };
            if (opts.switchCurrency && opts.newCurrency) {
              payload.currency = opts.newCurrency;
              payload.currencySource = "auto";
            }
            updateBbq.mutate(payload);
          }}
          pending={updateBbq.isPending}
        />
      )}

      {/* Settle Up Modal */}
      <SettleUpModal
        open={settleUpModalOpen}
        onOpenChange={setSettleUpModalOpen}
        onConfirm={handleSettleUp}
        pending={settleUp.isPending}
        title={t.settleUp.modalTitle}
        body1={t.settleUp.modalBody1}
        body2={t.settleUp.modalBody2}
        body3={t.settleUp.modalBody3}
        cancel={t.settleUp.cancel}
        sendSummary={t.settleUp.sendSummary}
      />

      {/* Add Person Dialog */}
      <AddPersonDialog
        open={isAddPersonOpen}
        onOpenChange={setIsAddPersonOpen}
        bbqId={selectedBbqId}
      />

      {/* Add/Edit Expense Dialog */}
      <AddExpenseDialog
        open={isAddExpenseOpen}
        onOpenChange={(open) => {
          setIsAddExpenseOpen(open);
          if (!open) {
            setEditingExpense(null);
            setRecommendedExpenseTemplate(null);
          }
        }}
        bbqId={selectedBbqId}
        editingExpense={editingExpense}
        currencySymbol={currencyInfo.symbol}
        categories={getCategoriesForEvent((selectedBbq as any)?.eventType, customCategories)}
        defaultItem={editingExpense ? undefined : recommendedExpenseTemplate?.item}
        defaultCategory={editingExpense ? undefined : recommendedExpenseTemplate?.category}
        defaultOptIn={editingExpense ? undefined : recommendedExpenseTemplate?.optInDefault}
        allowOptIn={allowOptIn}
        onAddCustomCategory={isCreator ? handleAddCustomCategory : undefined}
        eventType={selectedBbq?.eventType}
        eventKind={area === "trips" ? "trip" : "party"}
        currentUsername={username}
        currencyCode={(selectedBbq?.currency as string) || defaultCurrency}
        groupHomeCurrencyCode={(selectedBbq?.currency as string) || defaultCurrency}
        lastExpense={editingExpense ? null : lastExpenseForRepeat}
        privateTone={isPrivateContext}
        showReceipt={isPrivateContext}
      />

      {selectedBbq && (
        <Modal
          open={showLocalSuggestionsModal}
          onClose={() => setShowLocalSuggestionsModal(false)}
          onOpenChange={setShowLocalSuggestionsModal}
          title={`While you're in ${selectedBbq.city || selectedBbq.countryName || "town"}`}
          size="lg"
          scrollable
          footer={
            <div className="w-full flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">Votes are saved on this device for now.</p>
              <Button type="button" variant="ghost" onClick={() => setShowLocalSuggestionsModal(false)}>
                Close
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Show local suggestions for this trip</p>
                <p className="text-xs text-muted-foreground">We keep this subtle and only show nearby public events around your dates.</p>
              </div>
              <Switch
                checked={privateSuggestionState.enabled}
                onCheckedChange={(checked) => setPrivateSuggestionState((prev) => ({ ...prev, enabled: checked }))}
              />
            </div>

            {!privateSuggestionState.enabled ? (
              <p className="text-sm text-muted-foreground">Suggestions are off for this event.</p>
            ) : modalExploreSuggestions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing nearby for these dates right now.</p>
            ) : (
              <div className="space-y-2">
                {modalExploreSuggestions.map((suggestion) => {
                  const isSaved = privateSuggestionState.savedIds.includes(suggestion.id);
                  const isDismissed = privateSuggestionState.dismissedIds.includes(suggestion.id);
                  const votes = getSuggestionVotes(suggestion.id);
                  if (isDismissed) return null;
                  return (
                    <div key={`modal-suggestion-${suggestion.id}`} className="rounded-xl border border-border/60 bg-card p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{suggestion.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {suggestion.date ? new Date(suggestion.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : "Date TBA"}
                            {" · "}
                            {getSuggestionDistanceLabel({
                              privateCity: selectedBbq.city,
                              suggestionCity: suggestion.city,
                              suggestionCountry: suggestion.countryName,
                            })}
                          </p>
                          {suggestion.organizationName && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">{suggestion.organizationName}</p>
                          )}
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            <div className="inline-flex items-center gap-1 rounded-lg bg-muted/30 p-0.5">
                              {([
                                { key: "up", emoji: "👍", label: "Interested" },
                                { key: "maybe", emoji: "🤔", label: "Maybe" },
                                { key: "down", emoji: "👎", label: "Skip" },
                              ] as const).map((option) => (
                                <button
                                  key={`${suggestion.id}-modal-${option.key}`}
                                  type="button"
                                  className={`h-7 rounded-md px-2 text-xs transition-colors ${votes.mine === option.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                                  onClick={() => setSuggestionVote(suggestion.id, votes.mine === option.key ? null : option.key)}
                                  title={option.label}
                                >
                                  {option.emoji}
                                </button>
                              ))}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {votes.up.length > 0 && (
                                <div className="flex items-center gap-1.5">
                                  <div className="flex -space-x-1.5">
                                    {votes.up.slice(0, 3).map((v) => (
                                      <span
                                        key={`${suggestion.id}-modal-up-${v.userKey}`}
                                        className="grid h-5 w-5 place-items-center rounded-full border border-background bg-primary/10 text-[9px] font-semibold text-primary"
                                        title={v.label}
                                      >
                                        {getParticipantInitials(v.label)}
                                      </span>
                                    ))}
                                  </div>
                                  <span>{votes.up.length} interested</span>
                                </div>
                              )}
                              {votes.maybe.length > 0 && <span>{votes.maybe.length} maybe</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className={`h-8 px-2 text-xs ${isSaved ? "text-primary" : "text-muted-foreground"}`}
                            onClick={() =>
                              setPrivateSuggestionState((prev) => ({
                                ...prev,
                                savedIds: prev.savedIds.includes(suggestion.id)
                                  ? prev.savedIds.filter((id) => id !== suggestion.id)
                                  : [...prev.savedIds, suggestion.id],
                              }))
                            }
                          >
                            {isSaved ? "Saved" : "Save"}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs text-muted-foreground"
                            onClick={() =>
                              setPrivateSuggestionState((prev) => ({
                                ...prev,
                                dismissedIds: prev.dismissedIds.includes(suggestion.id)
                                  ? prev.dismissedIds
                                  : [...prev.dismissedIds, suggestion.id],
                              }))
                            }
                          >
                            Not interested
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Modal>
      )}

      {showSettledConfetti && (
        <ConfettiCelebration onComplete={() => setShowSettledConfetti(false)} reducedMotion={!!shouldReduceMotion} />
      )}

    </div>
  );
}
