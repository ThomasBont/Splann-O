import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { normalizeCountryCode } from "@shared/lib/country-code";
import { useLanguage, getCurrency, SELECTABLE_LANGUAGES, type CurrencyCode, convertCurrency } from "@/hooks/use-language";
import { useAuth } from "@/hooks/use-auth";
import {
  useParticipants, useCreateParticipant, useDeleteParticipant, useUpdateParticipantName,
  usePendingRequests, useMemberships, useJoinBarbecue,
  useAcceptParticipant, useRejectParticipant,
  useInvitedParticipants, useInviteParticipant,
  useAcceptInvite, useDeclineInvite,
} from "@/hooks/use-participants";
import { useExpenses, useDeleteExpense, useExpenseShares, useSetExpenseShare } from "@/hooks/use-expenses";
import { useBarbecues, useCreateBarbecue, useDeleteBarbecue, useUpdateBarbecue, useEnsureInviteToken, useSettleUp, useEventNotifications, useMarkEventNotificationRead, useCheckoutPublicListing, useDeactivateListing, useExploreEvents, usePublicEventRsvpRequests, useUpdatePublicEventRsvpRequest, useConversations, useConversation, useSendConversationMessage, useUpdateConversationStatus, useUploadEventBanner, useDeleteEventBanner, type EventNotification, type ExploreEvent } from "@/hooks/use-bbq-data";
import { useQueryClient } from "@tanstack/react-query";
import { useFriends, useFriendRequests, useAllPendingRequests, useAcceptFriendRequest, useRemoveFriend } from "@/hooks/use-friends";
import { UserProfileModal } from "@/components/user-profile-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EventTabsContent } from "@/components/event/EventTabs";
import { EventPageTabsRouter } from "@/components/event/pages/EventPageTabsRouter";
import { Modal } from "@/components/ui/modal";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AddPersonDialog } from "@/components/add-person-dialog";
import { AddExpenseDialog } from "@/components/add-expense-dialog";
import { CurrencyPicker } from "@/components/currency-picker";
import { type LocationOption, currencyForCountry } from "@/lib/locations-data";
import { EventHeader } from "@/components/event/EventHeader";
import { ChatSidebar } from "@/components/event/ChatSidebar";
import GuestsWidget from "@/components/event/GuestsWidget";
import SharedCostsWidget from "@/components/event/SharedCostsWidget";
import PlanDetailsDrawer from "@/components/event/PlanDetailsDrawer";
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
import { WelcomeModal } from "@/components/welcome-modal";
import { DiscoverModal } from "@/components/discover-modal";
import { SplannoLogo } from "@/components/splanno-logo";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import {
  Receipt, Trash2, Edit2,
  Plus, CheckCircle2,
  CalendarDays, Loader2,
  UserCheck, UserX, LogOut, Crown, Clock, UserCircle, ChevronDown,
  Lock, Globe, UserPlus, X, Eye, EyeOff, Compass,
  Bell, UserPlus2, Search, Heart, Sun, Moon, MessageCircle, Star, Plane, PartyPopper,
} from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useEventHeaderPreferences } from "@/hooks/use-event-header-preferences";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useAppToast } from "@/hooks/use-app-toast";
import { useUpgrade } from "@/contexts/UpgradeContext";
import { UpgradeRequiredError } from "@/lib/upgrade";
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
import {
  getPrivateTemplateById,
  getPrivateTemplateForEvent,
  type PrivateTemplateId,
} from "@/lib/private-event-templates";
import {
  VIBE_THEME,
  type PrivateEventVibeId,
} from "@/lib/event-types";
import { buildWhatsAppMessage, buildWhatsAppShareUrl } from "@/lib/share-message";
import { copyText } from "@/lib/copy-text";
import { buildIcs, downloadIcs, inferEventDateRange } from "@/lib/calendar-ics";
import { buildMapsUrl, openMaps } from "@/lib/maps";
import { InlineQueryError, SkeletonAvatar, SkeletonCard, SkeletonLine } from "@/components/ui/load-states";
import { EMPTY_COPY, UI_COPY } from "@/lib/emotional-copy";
import { FEATURE_PUBLIC_PLANS } from "@/lib/features";
import type { EventBannerPresetId } from "@/lib/event-banner";
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
import type { ExpenseWithParticipant, Barbecue, Participant, FriendInfo, PendingRequestWithBbq } from "@shared/schema";

/** Fallback colors for expense chart. Extended for custom categories (hash-based). */
const CATEGORY_COLORS: Record<string, string> = {
  Meat: '#e05c2a', Bread: '#f0c040', Drinks: '#3b82f6',
  Charcoal: '#64748b', Transportation: '#10b981', Other: '#a855f7',
  Food: '#e05c2a', Transport: '#10b981', Tickets: '#8b5cf6', Accommodation: '#0ea5e9',
  Activities: '#06b6d4', Groceries: '#84cc16', Snacks: '#f59e0b', Supplies: '#6b7280',
  Parking: '#6366f1', Tips: '#ec4899', Entertainment: '#14b8a6',
};

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
  { id: "picnic", label: "Brunch", emoji: "🥐", eventTypeValue: "day_out", area: "parties", templateId: "generic" },
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
}: { open: boolean; onOpenChange: (open: boolean) => void; isCheckingAuth?: boolean; onSuccess?: () => void }) {
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
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t.auth.login}
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
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t.auth.register}
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
type HomeProps = {
  appRouteMode?: HomeRouteMode;
  routeEventId?: number | null;
  debugDisableDiscoverModal?: boolean;
};

export default function Home({ appRouteMode = "legacy", routeEventId = null, debugDisableDiscoverModal = false }: HomeProps) {
  const { language, setLanguage, t } = useLanguage();
  const { theme, setPreference } = useTheme();
  const { prefs: eventHeaderPrefs } = useEventHeaderPreferences();
  const { user, isLoading: isAuthLoading, logout, resendVerification } = useAuth();
  const [, setLocation] = useLocation();
  const username = user?.username ?? null;
  const { toast } = useToast();
  const { toastSuccess, toastError, toastInfo, toastWarning } = useAppToast();
  const { showUpgrade } = useUpgrade();
  const shouldReduceMotion = useReducedMotion();
  const isManagedAppRoute = appRouteMode !== "legacy";

  const [area, setArea] = useState<"parties" | "trips">("parties");
  const [eventVisibilityTab, setEventVisibilityTab] = useState<"private" | "public">("private");
  const [selectedBbqId, setSelectedBbqId] = useState<number | null>(null);
  const reactionScopeId = selectedBbqId != null ? `ev-${selectedBbqId}` : "ev-none";
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

  useEffect(() => {
    if (appRouteMode === "private" || !FEATURE_PUBLIC_PLANS) setEventVisibilityTab("private");
    if (appRouteMode === "public" && FEATURE_PUBLIC_PLANS) setEventVisibilityTab("public");
  }, [appRouteMode]);

  useEffect(() => {
    if (!isManagedAppRoute) return;
    if (appRouteMode !== "private") return;
    setSelectedBbqId(null);
  }, [isManagedAppRoute, appRouteMode]);

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

  const [isAddPersonOpen, setIsAddPersonOpen] = useState(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isPlanDetailsOpen, setIsPlanDetailsOpen] = useState(false);
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
  const { data: eventNotifications = [] } = useEventNotifications(!!user);
  const markEventNotifRead = useMarkEventNotificationRead();
  const acceptFriendReq = useAcceptFriendRequest();
  const removeFriendMut = useRemoveFriend();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [viewedProfileUsername, setViewedProfileUsername] = useState<string | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(true);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const prevPendingCountRef = useRef(allPendingRequests.length);
  const queryClient = useQueryClient();
  const [showSettledConfetti, setShowSettledConfetti] = useState(false);
  const settledCelebrationShownRef = useRef<number | null>(null);
  const publicSplitGuardedEventRef = useRef<number | null>(null);
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
  const [allEventsSelectorOpen, setAllEventsSelectorOpen] = useState(false);
  const [allEventsSearch, setAllEventsSearch] = useState("");
  const [pinnedEventIds, setPinnedEventIds] = useState<number[]>([]);
  const [recentEventIds, setRecentEventIds] = useState<number[]>([]);
  const [recentLocationOptions, setRecentLocationOptions] = useState<LocationOption[]>([]);
  const pinnedEventsStorageKey = useMemo(() => `splanno_pinned_events_${user?.id ?? user?.username ?? "anon"}`, [user?.id, user?.username]);
  const recentEventsStorageKey = useMemo(() => `splanno_recent_events_${user?.id ?? user?.username ?? "anon"}`, [user?.id, user?.username]);
  const recentLocationsStorageKey = useMemo(() => `splanno_recent_locations_${user?.id ?? user?.username ?? "anon"}`, [user?.id, user?.username]);

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
    if (user) {
      try {
        if (sessionStorage.getItem("ortega_show_welcome") === "1") {
          setShowWelcomeModal(true);
        }
      } catch {
        // ignore
      }
    }
  }, [user]);

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
  const listBarbecuesForArea = eventVisibilityTab === "private" ? privateBarbecuesForArea : publicBarbecuesForArea;
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
  const pinnedBarbecuesForArea = useMemo(() => {
    return listBarbecuesForArea.filter((b: Barbecue) => pinnedEventIds.includes(b.id));
  }, [listBarbecuesForArea, pinnedEventIds]);
  const hasPinnedEvents = pinnedEventIds.length > 0;
  const createBbq = useCreateBarbecue();
  const deleteBbq = useDeleteBarbecue();
  const updateBbq = useUpdateBarbecue();
  const uploadEventBanner = useUploadEventBanner(selectedBbqId);
  const deleteEventBanner = useDeleteEventBanner(selectedBbqId);
  const ensureInviteToken = useEnsureInviteToken();
  const settleUp = useSettleUp();
  const checkoutPublicListing = useCheckoutPublicListing();
  const deactivateListing = useDeactivateListing();

  const selectedBbq = barbecuesForArea.find((b: Barbecue) => b.id === selectedBbqId) ?? (barbecues.find((b: Barbecue) => b.id === selectedBbqId) || null);
  const eventViewRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isManagedAppRoute || appRouteMode !== "event" || !routeEventId) return;
    setSelectedBbqId(routeEventId);
  }, [isManagedAppRoute, appRouteMode, routeEventId]);

  useEffect(() => {
    if (!isManagedAppRoute || appRouteMode !== "event") return;
    if (!selectedBbq) return;
    setEventVisibilityTab(isPublicEvent(selectedBbq) ? "public" : "private");
  }, [isManagedAppRoute, appRouteMode, selectedBbq]);
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
  const currency = (selectedBbq?.currency as CurrencyCode) || "EUR";
  const currencyInfo = getCurrency(currency) ?? getCurrency("EUR")!;
  const [displayCurrency, setDisplayCurrency] = useState<CurrencyCode>(currency);
  const displayCurrencyInfo = getCurrency(displayCurrency) ?? getCurrency("EUR")!;
  const isCreator = !!(username && selectedBbq?.creatorId === username);
  const isPrivate = selectedBbq ? !selectedBbq.isPublic : false;
  const isPrivateContext = !!selectedBbq && isPrivate;
  const isPublicBuilderContext = isPublicEvent(selectedBbq);
  const showPrivateChatTab = import.meta.env.VITE_ENABLE_PRIVATE_CHAT === "true";
  const privateMood = getCircleMoodTokens(isPrivateContext ? getCirclePersonalityFromEvent(selectedBbq) : "minimal");

  const { data: participants = [] } = useParticipants(selectedBbqId);
  const { data: expenses = [] } = useExpenses(selectedBbqId);
  const [showLocalSuggestionsModal, setShowLocalSuggestionsModal] = useState(false);
  const [privateSuggestionState, setPrivateSuggestionState] = useState(defaultPrivateSuggestionState());
  const { data: expenseSharesList = [] } = useExpenseShares(selectedBbq?.allowOptInExpenses ? selectedBbqId : null);
  const setExpenseShare = useSetExpenseShare(selectedBbqId);
  const { data: pendingRequests = [] } = usePendingRequests(isCreator ? selectedBbqId : null);
  const { data: publicRsvpRequests = [] } = usePublicEventRsvpRequests(selectedBbqId, isCreator && isPublicBuilderContext);
  const updatePublicRsvpRequest = useUpdatePublicEventRsvpRequest(selectedBbqId);
  const publicInboxList = useConversations(isCreator && isPublicBuilderContext ? selectedBbqId : null);
  const publicInboxThread = useConversation(publicInboxConversationId, isCreator && isPublicBuilderContext && activeEventTab === "inbox" && !!publicInboxConversationId);
  const sendPublicInboxMessage = useSendConversationMessage(publicInboxConversationId);
  const updateConversationStatus = useUpdateConversationStatus(publicInboxConversationId);
  const publicInboxConversations = (publicInboxList.data?.conversations ?? []).filter((c) => c.barbecueId === selectedBbqId);
  const { data: invitedParticipants = [] } = useInvitedParticipants(isPrivate ? selectedBbqId : null);
  const { latestItems: latestPlanActivity, loading: planActivityLoading, highlightedId: highlightedActivityId } =
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

  const deleteParticipant = useDeleteParticipant(selectedBbqId);
  const updateParticipantName = useUpdateParticipantName(selectedBbqId);
  const deleteExpense = useDeleteExpense(selectedBbqId);
  const joinBbq = useJoinBarbecue();
  const acceptParticipant = useAcceptParticipant(selectedBbqId);
  const rejectParticipant = useRejectParticipant(selectedBbqId);
  const inviteParticipant = useInviteParticipant(selectedBbqId);
  const acceptInvite = useAcceptInvite();
  const declineInvite = useDeclineInvite();

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
  const formatRelativeShort = (value?: string | null) => {
    if (!value) return "";
    const ts = new Date(value).getTime();
    if (!Number.isFinite(ts)) return "";
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60_000);
    if (mins <= 0) return "Just now";
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  const totalSpent = expenses.reduce(
    (sum: number, exp: ExpenseWithParticipant) => sum + (Number.isFinite(Number(exp.amount)) ? Number(exp.amount) : 0),
    0
  );
  const participantCount = participants.length;
  const allowOptIn = isPrivateContext && !!selectedBbq?.allowOptInExpenses;
  const shareSet = new Set(expenseSharesList.map(s => `${s.expenseId}:${s.participantId}`));
  const _getFairShareForParticipant = (participantId: number) =>
    getFairShareForParticipant(participantId, expenses, expenseSharesList, participants, allowOptIn);
  const myParticipant = username ? participants.find((p: Participant) => p.userId === username) : null;
  const fairShare = myParticipant ? _getFairShareForParticipant(myParticipant.id) : (participantCount > 0 ? totalSpent / participantCount : 0);

  const canLeave = (p: Participant) => {
    if (p.userId !== username) return false;
    if (!selectedBbq?.date) return false;
    const bbqDate = new Date(selectedBbq.date);
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
      startAt: selectedBbq.date ?? new Date().toISOString(),
      endAt: selectedBbq.date ?? null,
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
    if (username) {
      const participant = participants.find((p: Participant) => p.userId === username);
      return participant?.name || user?.displayName || username;
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

  const { balances, settlements } = useMemo(
    () => computeSplit(participants, expenses, expenseSharesList, allowOptIn),
    [participants, expenses, expenseSharesList, allowOptIn]
  );
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
    if (!username) return;
    joinBbq.mutate({ bbqId, name: username, userId: username }, {
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
    if (!username) return;
    joinBbq.mutate(
      { bbqId: bbq.id, name: username, userId: username },
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
    const requestedPublicOnCreate = newBbqIsPublic;
    const requestedPublicModeOnCreate = newBbqPublicMode;
    const requestedVisibilityOriginOnCreate = newBbqVisibilityOrigin;
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
      creatorId: username || undefined,
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
        toastError("Couldn’t create event. Try again.");
      },
    });
  };

  const handleDeleteBbq = (id: number) => {
    deleteBbq.mutate(id);
    if (selectedBbqId === id) setSelectedBbqId(null);
  };

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
    setSelectedBbqId(eventId);
    if (eventId != null) markEventRecent(eventId);
    if (isManagedAppRoute) {
      if (eventId != null) setLocation(`/app/e/${eventId}`);
      else if (appRouteMode === "public") setLocation("/app/public");
      else if (appRouteMode === "private") setLocation("/app/private");
      else setLocation("/app/home");
    }
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
  const verifyBannerFlag = import.meta.env.VITE_SHOW_VERIFY_BANNER;
  const showVerifyBanner = verifyBannerFlag != null ? verifyBannerFlag !== "false" : !import.meta.env.DEV;

  const eventStatus = (selectedBbq?.status as "draft" | "active" | "settling" | "settled") ?? "active";
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
  const selectedPrivateTemplate = getPrivateTemplateForEvent(selectedBbq);
  const selectedEventVibeTheme = VIBE_THEME[(selectedBbq?.eventVibe as PrivateEventVibeId) ?? "cozy"] ?? VIBE_THEME.cozy;
  const selectedCreatePrivateTemplate = getPrivateTemplateById(newPrivateTemplateId);
  const selectedSubcategoryList = newPlanMainCategory === "trip" ? TRIP_SUBCATEGORIES : newPlanMainCategory === "party" ? PARTY_SUBCATEGORIES : [];
  const selectedSubcategoryDef = [...TRIP_SUBCATEGORIES, ...PARTY_SUBCATEGORIES].find((item) => item.id === newPlanSubCategory) ?? null;
  const privateTypeLabel = (typeId: string, fallback: string) => t.privateWizard.typeLabels[typeId] ?? fallback;
  const privateVibeLabel = (vibeId: string, fallback: string) => t.privateWizard.vibeLabels[vibeId] ?? fallback;
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

      {user && (
        <WelcomeModal
          open={showWelcomeModal}
          onOpenChange={setShowWelcomeModal}
          userName={user.displayName || user.username}
          onGetStarted={() => {
            try {
              sessionStorage.removeItem("ortega_show_welcome");
            } catch {
              // ignore
            }
            setShowWelcomeModal(false);
          }}
        />
      )}

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
      <header className="sticky top-0 z-50 bg-[hsl(var(--surface-0))]/90 backdrop-blur-lg border-b border-[hsl(var(--border-subtle))]" data-testid="header">
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
            {/* Theme toggle */}
            <button
              type="button"
              onClick={() => setPreference(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            {/* Language Tabs */}
            <div className="flex rounded-lg border border-border overflow-hidden" data-testid="language-tabs">
              {SELECTABLE_LANGUAGES.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => setLanguage(lang.code)}
                  className={`px-2.5 py-1.5 text-xs font-bold transition-colors ${
                    language === lang.code
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                  data-testid={`button-lang-${lang.code}`}
                >
                  {lang.label}
                </button>
              ))}
            </div>

            {/* User area */}
            {user ? (
              <div className="flex items-center gap-1">
                {/* Notification Bell */}
                <Popover open={notifOpen} onOpenChange={setNotifOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="relative"
                      data-testid="button-notifications"
                    >
                      <Bell className="w-4 h-4" />
                      {(allPendingRequests.length > 0 || eventNotifications.filter((n: EventNotification) => !n.readAt).length > 0) && (
                        <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center" data-testid="badge-notifications">
                          {allPendingRequests.length + eventNotifications.filter((n: EventNotification) => !n.readAt).length}
                        </span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-72 p-3 space-y-4">
                    {/* Settle-up notifications */}
                    {eventNotifications.length > 0 && (
                      <>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t.settleUp.statusSettling}</p>
                        {eventNotifications.slice(0, 5).map((n: EventNotification) => {
                          const p = n.payload as { creatorName?: string; amountOwed?: number; eventName?: string; currency?: string } | null;
                          const isRead = !!n.readAt;
                          return (
                            <button
                              key={n.id}
                              type="button"
                              onClick={() => {
                                markEventNotifRead.mutate(n.id);
                                const bbq = barbecues.find((b: Barbecue) => b.id === n.barbecueId);
                                if (bbq) setArea(getEventArea(bbq));
                                setSelectedBbqId(n.barbecueId);
                                setNotifOpen(false);
                                setActiveEventTab("split");
                              }}
                              className={`w-full text-left bg-secondary/20 border border-white/5 rounded-xl px-2.5 py-2 transition-colors hover:bg-secondary/30 ${isRead ? "opacity-70" : ""}`}
                              data-testid={`notif-settle-${n.id}`}
                            >
                              <p className="text-sm font-medium truncate">
                                {(p?.creatorName ?? "Someone")} {t.settleUp.participantBanner} 💸
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {t.settleUp.tapToSettle} {(getCurrency(p?.currency ?? "EUR") ?? getCurrency("EUR"))!.symbol}{(p?.amountOwed ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </p>
                            </button>
                          );
                        })}
                        {eventNotifications.length > 5 && (
                          <p className="text-[11px] text-muted-foreground">+{eventNotifications.length - 5} more</p>
                        )}
                      </>
                    )}
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t.user.pendingRequests}</p>
                    {allPendingRequests.length === 0 && eventNotifications.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">{t.friends.noRequests}</p>
                    ) : allPendingRequests.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">{t.friends.noRequests}</p>
                    ) : (
                      allPendingRequests.map((req: PendingRequestWithBbq) => (
                        <div key={req.id} className="flex items-center justify-between gap-2 bg-secondary/20 border border-white/5 rounded-xl px-2.5 py-2" data-testid={`notif-request-${req.id}`}>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{req.name}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{t.notifications.wantsToJoin} {req.bbqName}</p>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <Button size="icon" variant="ghost"
                              onClick={() => acceptParticipant.mutate(req.id)}
                              data-testid={`button-notif-accept-${req.id}`}>
                              <UserCheck className="w-3.5 h-3.5 text-green-400" />
                            </Button>
                            <Button size="icon" variant="ghost"
                              onClick={() => rejectParticipant.mutate(req.id)}
                              data-testid={`button-notif-reject-${req.id}`}>
                              <UserX className="w-3.5 h-3.5 text-red-400" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </PopoverContent>
                </Popover>

                {/* Profile dropdown: Profile/Friends + Logout */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="sm:hidden relative"
                      data-testid="button-profile-dropdown-mobile"
                    >
                      <UserCircle className="w-4 h-4" />
                      {friendRequests.length > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center" data-testid="badge-friend-requests">
                          {friendRequests.length}
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10"
                      data-testid="button-profile-dropdown"
                    >
                      <span className="font-medium max-w-[100px] truncate" data-testid="text-username">{user.username}</span>
                      <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                      {t.auth.loggedInAs}
                    </DropdownMenuLabel>
                    <DropdownMenuLabel className="font-medium truncate" data-testid="dropdown-username">
                      {user.username}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => { setViewedProfileUsername(null); setIsProfileOpen(true); }}
                      data-testid="dropdown-item-profile"
                    >
                      <UserCircle className="w-4 h-4 mr-2" />
                      {t.auth.profile}
                      {friendRequests.length > 0 && (
                        <span className="ml-auto bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                          {friendRequests.length}
                        </span>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => window.open(`/u/${encodeURIComponent(user.publicHandle || user.username)}`, "_blank")}
                      data-testid="dropdown-item-public-profile"
                    >
                      <Globe className="w-4 h-4 mr-2" />
                      Open public profile
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => logout.mutate()}
                      data-testid="dropdown-item-logout"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      {t.auth.logout}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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

      {/* Email verification banner */}
      {showVerifyBanner && user && !user.emailVerifiedAt && (
        <div
          className="flex items-center justify-between gap-3 px-3 sm:px-6 lg:px-8 py-2 bg-amber-500/15 border-b border-amber-500/30 text-amber-700 dark:text-amber-300"
          data-testid="banner-verify-email"
        >
          <p className="text-sm font-medium">Verify your email to unlock all features.</p>
          <Button
            size="sm"
            variant="outline"
            className="border-amber-500/50 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
            onClick={() => resendVerification.mutate(undefined, {
              onSuccess: (data) => toastInfo(data?.sent ? "Verification email sent" : "Check your profile"),
              onError: () => toastError("Couldn’t send verification email. Try again."),
            })}
            disabled={resendVerification.isPending}
          >
            {resendVerification.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Resend"}
          </Button>
        </div>
      )}

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
                  onClick={() => { setNewEventArea(area); setNewEventType(area === "trips" ? "city_trip" : "barbecue"); setIsNewBbqOpen(true); }}
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

      {/* Event strip (Pinned only) */}
      {hasPinnedEvents && (
      <div className="sticky top-[114px] z-30 bg-[hsl(var(--surface-0))]/90 backdrop-blur-md border-b border-[hsl(var(--border-subtle))]" data-testid="section-bbq-selector">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2">
          <p className="px-1 pb-1 text-[11px] text-muted-foreground hidden sm:block">
            Pinned plans
          </p>
          <div className="overflow-x-auto -mx-1 px-1 pb-1">
            <div className="flex gap-2 items-center min-w-max">
              {isLoadingBbqs ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mx-2" />
              ) : pinnedBarbecuesForArea.length === 0 ? (
                <span className="text-xs text-muted-foreground px-2 py-1.5 italic">
                  {eventVisibilityTab === "private" ? "No pinned plans yet" : "No pinned plans yet"}
                </span>
              ) : (
                pinnedBarbecuesForArea.map((bbq: Barbecue) => {
                  const isSelected = bbq.id === selectedBbqId;
                  const chipThemeCategory = getEventCategoryFromData({
                    eventType: bbq.eventType,
                    templateData: bbq.templateData,
                    visibilityOrigin: bbq.visibilityOrigin,
                  });
                  const chipTheme = getCategoryTheme(chipThemeCategory);
                  const isBbqCreator = !!(username && bbq.creatorId === username);
                  const membership = getMembershipStatus(bbq.id);
                  const memberStatus = membership?.status || null;
                  const participantId = membership?.participantId;
                  const isPublicCard = (bbq.visibility as string | undefined) === "public";
                  const pendingPublishCard = shouldShowPendingPublish(bbq);
                  const listingBadgeLabel = getListingBadgeLabel(bbq);
                  const isPinned = pinnedEventIds.includes(bbq.id);

                  return (
                    <div key={bbq.id} className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => handleSelectEvent(isSelected ? null : bbq.id)}
                        style={getEventThemeStyle(chipThemeCategory)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                          isSelected
                            ? `bg-primary text-primary-foreground border-primary/60 shadow-sm shadow-primary/20 ${chipTheme.classes.surface}`
                            : isPublicCard
                              ? `bg-sky-500/5 border-sky-500/20 text-muted-foreground hover:border-sky-400/40 hover:text-foreground hover:bg-sky-500/10 ${chipTheme.classes.surface}`
                              : `bg-amber-500/5 border-amber-500/15 text-muted-foreground hover:border-amber-400/30 hover:text-foreground hover:bg-amber-500/10 ${chipTheme.classes.surface}`
                        }`}
                        data-testid={`button-bbq-${bbq.id}`}
                      >
                        {isPublicCard ? (
                          <Globe className="w-3 h-3 flex-shrink-0 opacity-70" />
                        ) : (
                          <Lock className="w-3 h-3 flex-shrink-0 opacity-70" />
                        )}
                        <span className="max-w-[160px] truncate">{bbq.name}</span>
                        <span className={`hidden md:inline-flex h-1.5 w-1.5 rounded-full ${chipTheme.classes.strip}`} aria-hidden />
                        {pendingPublishCard && listingBadgeLabel && (
                          <span className="text-[10px] hidden sm:inline px-1.5 py-0.5 rounded-full border bg-amber-200 text-amber-950 border-amber-500/80 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-400/40">
                            {listingBadgeLabel}
                          </span>
                        )}
                      </button>

                      {/* Invited: Accept/Decline inline */}
                      {memberStatus === 'invited' && participantId && (
                        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => acceptInvite.mutate({ id: participantId, bbqId: bbq.id })}
                            disabled={acceptInvite.isPending}
                            className="text-[10px] bg-green-500/20 text-green-400 hover:bg-green-500/30 px-2 py-1 rounded-md font-semibold transition-colors"
                            data-testid={`button-accept-invite-${bbq.id}`}
                          >{t.bbq.acceptInvite}</button>
                          <button
                            onClick={() => declineInvite.mutate({ id: participantId, bbqId: bbq.id })}
                            disabled={declineInvite.isPending}
                            className="text-[10px] text-muted-foreground hover:text-destructive px-1 py-1 rounded-md transition-colors"
                            data-testid={`button-decline-invite-${bbq.id}`}
                          ><X className="w-3 h-3" /></button>
                        </div>
                      )}

                      {/* Public unjoined: join button inline */}
                      {!isBbqCreator && !memberStatus && bbq.isPublic && user && (
                        <button
                          onClick={() => handleJoin(bbq.id)}
                          disabled={joinBbq.isPending}
                          className="text-[10px] bg-white/5 hover:bg-primary/20 hover:text-primary border border-white/10 hover:border-primary/30 px-2 py-1 rounded-md font-semibold transition-colors text-muted-foreground"
                          data-testid={`button-join-bbq-${bbq.id}`}
                        >{joinBbq.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : t.user.joinBbq}</button>
                      )}

                      {/* Non-creator: leave event (remove from my tabs) */}
                      {!isBbqCreator && membership && participantId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteParticipant.mutate(participantId, {
                              onSuccess: () => {
                                queryClient.invalidateQueries({ queryKey: ["/api/barbecues"] });
                                if (selectedBbqId === bbq.id) setSelectedBbqId(null);
                              },
                            });
                          }}
                          disabled={deleteParticipant.isPending}
                          className="text-muted-foreground/40 hover:text-destructive transition-colors p-0.5"
                          title={t.user.leave}
                          data-testid={`button-leave-bbq-${bbq.id}`}
                        ><X className="w-3 h-3" /></button>
                      )}

                      {/* Creator: pin + delete buttons */}
                      {isBbqCreator && (
                        <button
                          onClick={(e) => { e.stopPropagation(); togglePinnedEvent(bbq.id); }}
                          className={`transition-colors p-0.5 ${isPinned ? "text-yellow-400 hover:text-yellow-300" : "text-muted-foreground/50 hover:text-yellow-400"}`}
                          data-testid={`button-pin-bbq-${bbq.id}`}
                          title={isPinned ? "Unpin event" : "Pin event"}
                        ><Star className={`w-3 h-3 ${isPinned ? "fill-current" : ""}`} /></button>
                      )}
                      {isBbqCreator && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteBbq(bbq.id); }}
                          className="text-muted-foreground/40 hover:text-destructive transition-colors p-0.5"
                          data-testid={`button-delete-bbq-${bbq.id}`}
                          title={t.bbq.delete}
                        ><Trash2 className="w-3 h-3" /></button>
                      )}
                    </div>
                  );
                })
              )}

              {/* Separator */}
              {pinnedBarbecuesForArea.length > 0 && <div className="w-px h-5 bg-white/10 flex-shrink-0 mx-1" />}
            </div>
          </div>
        </div>
      </div>
      )}

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-6 sm:space-y-8">
        {
        <>
        {/* Pending Requests Panel */}
        {isCreator && pendingRequests.length > 0 && (
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
        {selectedBbqId && isLoadingBbqs ? (
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
        ) : selectedBbqId && barbecuesError ? (
          <InlineQueryError
            message="Couldn’t load this plan. Try again."
            onRetry={() => {
              void refetchBarbecues();
            }}
          />
        ) : selectedBbqId ? (() => {
          if (appRouteMode === "event" && isPrivateContext && selectedBbq) {
            const pendingCount = Math.max(invitedParticipants.length, pendingRequests.length);
            const responseProgress = Math.max(
              8,
              Math.min(100, Math.round((participantCount / Math.max(participantCount + pendingCount, 1)) * 100)),
            );
            const heroImage = selectedBbq.bannerImageUrl || "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1600&q=80";
            return (
              <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-10 py-6 bg-[#FAF7F2] rounded-2xl">
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <section className="min-w-0 space-y-8">
                    <button
                      type="button"
                      className="relative min-h-[300px] w-full overflow-hidden rounded-3xl border border-slate-200 text-left shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                      onClick={() => setIsPlanDetailsOpen(true)}
                      aria-label="Open plan details"
                    >
                      <img
                        src={heroImage}
                        alt={selectedBbq.name}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-black/40 via-black/10 to-transparent" />
                      <div className="pointer-events-none absolute left-6 top-6 z-10 md:left-8 md:top-8">
                        <h2 className="text-2xl font-semibold tracking-tight text-white drop-shadow-sm md:text-3xl lg:text-4xl">
                          {selectedBbq.name}
                        </h2>
                        <p className="mt-1 text-sm text-white/80 drop-shadow-sm md:text-base">
                          {formatHeroDateEnglish(selectedBbq.date)}
                        </p>
                      </div>
                    </button>

                    <div className="rounded-2xl border border-amber-200/60 bg-gradient-to-r from-amber-100/80 to-rose-100/70 dark:from-amber-900/25 dark:to-rose-900/20 shadow-sm p-5">
                      <p className="text-base font-medium text-slate-800 dark:text-slate-100">
                        Hey {user?.displayName || user?.username}, you&apos;re planning a Cozy Dinner ✨
                      </p>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        {pendingCount} friend{pendingCount === 1 ? "" : "s"} still need to respond.
                      </p>
                      <div className="mt-4 rounded-xl border border-white/40 bg-white/50 px-3 py-2 dark:border-white/10 dark:bg-black/10">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-300">Recent activity</p>
                        {planActivityLoading ? (
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">Loading updates...</p>
                        ) : latestPlanActivity.length > 0 ? (
                          <ul className="mt-1 space-y-1">
                            {latestPlanActivity.map((activity) => (
                              <li
                                key={`plan-activity-${activity.id}`}
                                className={`truncate text-xs text-slate-700 transition-colors duration-700 dark:text-slate-200 ${highlightedActivityId === activity.id ? "bg-primary/5" : ""}`}
                                title={activity.message}
                              >
                                • {activity.message} {activity.createdAt ? `· ${formatRelativeShort(activity.createdAt)}` : ""}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                            No updates yet — start by adding an expense or inviting your crew.
                          </p>
                        )}
                      </div>
                      <div className="mt-5 h-2 rounded-full bg-white/70 overflow-hidden">
                        <div className="h-full rounded-full bg-amber-400/90 transition-all duration-300" style={{ width: `${responseProgress}%` }} />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <GuestsWidget eventId={selectedBbq.id} />

                      <SharedCostsWidget
                        eventId={selectedBbq.id}
                        planName={selectedBbq.name}
                        peopleCount={participantCount}
                        totalSpentLabel={formatMoney(totalSpent)}
                        expenseCount={expenses.length}
                        progressPercent={Math.min(100, Math.max(10, Math.round((expenses.length / Math.max(participantCount * 2, 1)) * 100)))}
                        participants={participants}
                        expenses={expenses}
                        balances={balances}
                        settlements={settlements}
                        formatMoney={formatMoney}
                      />

                      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                        <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Quick actions</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-xl border-amber-200/80 bg-amber-50 text-slate-700 hover:bg-amber-100"
                            onClick={() => {
                              setRecommendedExpenseTemplate({ item: "Wine", category: "Drinks" });
                              setIsAddExpenseOpen(true);
                            }}
                          >
                            Add wine
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-xl border-amber-200/80 bg-amber-50 text-slate-700 hover:bg-amber-100"
                            onClick={() => setActiveEventTab("people")}
                          >
                            Assign dishes
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-xl border-amber-200/80 bg-amber-50 text-slate-700 hover:bg-amber-100"
                            onClick={() => setActiveEventTab("split")}
                          >
                            Start vote
                          </Button>
                        </div>
                      </div>
                    </div>

                    <PlanDetailsDrawer
                      open={isPlanDetailsOpen}
                      onOpenChange={setIsPlanDetailsOpen}
                      plan={selectedBbq}
                      saving={updateBbq.isPending}
                      onSave={async (updates) => {
                        if (!selectedBbq) return;
                        const updatedPlan = await updateBbq.mutateAsync({
                          id: selectedBbq.id,
                          name: updates.name,
                          locationText: updates.locationText,
                          date: updates.date,
                          bannerImageUrl: updates.bannerImageUrl,
                        });
                        const expectedBanner = updates.bannerImageUrl ?? null;
                        const savedBanner = updatedPlan?.bannerImageUrl ?? null;
                        if (savedBanner !== expectedBanner) {
                          throw new Error("Banner image URL could not be saved. Try again.");
                        }
                        await queryClient.invalidateQueries({ queryKey: ["/api/barbecues"] });
                        await queryClient.refetchQueries({ queryKey: ["/api/barbecues"] });
                        toastSuccess("Plan details updated");
                        setIsPlanDetailsOpen(false);
                      }}
                    />
                  </section>

                  <aside className="lg:sticky lg:top-6 h-fit min-h-[340px] lg:min-h-0">
                    <div className="h-[calc(100vh-11rem)] min-h-[520px]">
                      <ChatSidebar
                        eventId={selectedBbq.id}
                        eventName={selectedBbq.name}
                        currentUser={{
                          id: user?.id ?? null,
                          username: user?.username ?? null,
                          avatarUrl: user?.avatarUrl ?? null,
                        }}
                        enabled={!!user}
                      />
                    </div>
                  </aside>
                </div>
              </div>
            );
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
            dateStr: selectedBbq?.date ? new Date(selectedBbq.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : undefined,
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
                        ? `${origin}/join/${selectedBbq.inviteToken}`
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
                        ? `${typeof window !== "undefined" ? window.location.origin : ""}/join/${inviteToken}`
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
                      ? `${typeof window !== "undefined" ? window.location.origin : ""}/join/${inviteToken}`
                      : null;
                    if (!url) return;
                    const rawTemplateData = (selectedBbq.templateData && typeof selectedBbq.templateData === "object")
                      ? selectedBbq.templateData as Record<string, unknown>
                      : null;
                    const emoji = typeof rawTemplateData?.emoji === "string" ? rawTemplateData.emoji : undefined;
                    const fallbackLocation = [selectedBbq.city, selectedBbq.countryName].filter(Boolean).join(", ");
                    const message = buildWhatsAppMessage({
                      title: selectedBbq.name,
                      emoji,
                      url,
                      location: selectedBbq.locationName ?? (fallbackLocation || null),
                      date: selectedBbq.date ?? null,
                    });
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
                      ? `${typeof window !== "undefined" ? window.location.origin : ""}/join/${inviteToken}`
                      : null;
                    if (!url) return;
                    const rawTemplateData = (selectedBbq.templateData && typeof selectedBbq.templateData === "object")
                      ? selectedBbq.templateData as Record<string, unknown>
                      : null;
                    const emoji = typeof rawTemplateData?.emoji === "string" ? rawTemplateData.emoji : undefined;
                    const fallbackLocation = [selectedBbq.city, selectedBbq.countryName].filter(Boolean).join(", ");
                    const message = buildWhatsAppMessage({
                      title: selectedBbq.name,
                      emoji,
                      url,
                      location: selectedBbq.locationName ?? (fallbackLocation || null),
                      date: selectedBbq.date ?? null,
                    });
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
                onDelete={selectedBbq ? () => handleDeleteBbq(selectedBbq.id) : undefined}
                onCopyInviteLink={
                  selectedBbq?.inviteToken
                    ? async () => {
                        const url = `${typeof window !== "undefined" ? window.location.origin : ""}/join/${selectedBbq.inviteToken}`;
                        const ok = await copyText(url);
                        if (ok) toastSuccess(t.bbq.copySuccess);
                        else toastInfo("Copy failed — select and copy manually.");
                      }
                    : selectedBbq && canEditEvent
                      ? async () => {
                          const ensured = await ensureInviteToken.mutateAsync(selectedBbq.id);
                          if (!ensured?.inviteToken) return;
                          const url = `${typeof window !== "undefined" ? window.location.origin : ""}/join/${ensured.inviteToken}`;
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
              {!isPublicBuilderContext && eventStatus === "settling" && !isCreator && myParticipant && (() => {
                const myBalance = balances.find((b: { id: number }) => b.id === myParticipant.id) as { balance: number } | undefined;
                const amountOwed = myBalance && myBalance.balance < -0.01 ? Math.abs(myBalance.balance) : 0;
                if (amountOwed < 0.01) return null;
                const creatorName = selectedBbq?.creatorId || "Someone";
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
              {!isPublicBuilderContext && eventStatus === "settled" && (
                <div className={`mt-4 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-2.5 flex items-center gap-2 ${isPrivateContext ? "rounded-2xl bg-gradient-to-r from-emerald-500/12 to-emerald-500/6 ring-1 ring-emerald-500/10" : ""}`}>
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                  <p className="text-sm font-medium text-foreground">{isPrivateContext ? "Everyone’s settled up. You’re all in sync." : t.split.allSettledStillFriends}</p>
                </div>
              )}

              {/* Creator: Mark as settled when all balances zero */}
              {!isPublicBuilderContext && isCreator && eventStatus === "settling" && allBalancesZero && (
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
                  {selectedBbq.bannerImageUrl ? (
                    <img
                      src={selectedBbq.bannerImageUrl}
                      alt={selectedBbq.name}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-transparent" />
                  <div className="relative z-10 p-6 sm:p-7">
                    <p className="text-xs uppercase tracking-[0.16em] text-white/80">Private plan</p>
                    <h2 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-white">{selectedBbq.name}</h2>
                    <p className="mt-2 text-sm text-white/85">
                      {selectedBbq.date ? new Date(selectedBbq.date).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : "Date TBD"}
                      {" · "}
                      {(selectedBbq.locationName ?? selectedBbq.city ?? selectedBbq.countryName ?? "Location TBD")}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/50 dark:border-slate-700/70 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Hoi {user?.displayName || user?.username}, you’re planning a {privateVibeLabel((selectedBbq.eventVibe as string) || "cozy", "Cozy")} {privateTypeLabel((selectedBbq.eventType as string) || "generic", "Event")} ✨</p>
                      <p className="text-xs text-muted-foreground mt-1">{Math.max(invitedParticipants.length, pendingRequests.length)} friend{Math.max(invitedParticipants.length, pendingRequests.length) === 1 ? "" : "s"} still need to respond.</p>
                    </div>
                    <span className="text-lg" aria-hidden>✨</span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-muted/40 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.round((participantCount / Math.max(participantCount + Math.max(invitedParticipants.length, pendingRequests.length), 1)) * 100))}%` }}
                    />
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
                    <div className="mt-3 h-2 rounded-full bg-muted/40 overflow-hidden">
                      <div className="h-full rounded-full bg-primary/80" style={{ width: `${Math.min(100, Math.round((expenses.length / Math.max(participantCount * 2, 1)) * 100))}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{expenses.length} logged expense{expenses.length === 1 ? "" : "s"}</p>
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
                        {selectedBbq.bannerImageUrl ? (
                          <img src={selectedBbq.bannerImageUrl} alt={selectedBbq.name} className="h-full w-full object-cover" />
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
                        ? `${typeof window !== "undefined" ? window.location.origin : ""}/join/${selectedBbq.inviteToken}`
                        : ""
                    }
                    onEnsureToken={
                      selectedBbq && !selectedBbq.inviteToken && isCreator
                        ? async () => {
                            const bbq = await ensureInviteToken.mutateAsync(selectedBbq.id);
                            return bbq?.inviteToken
                              ? `${typeof window !== "undefined" ? window.location.origin : ""}/join/${bbq.inviteToken}`
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
                        participantUserIds={new Set(participants.map((p: Participant) => p.userId).filter(Boolean) as string[])}
                        onInviteFriend={(username) =>
                          inviteParticipant.mutate(username, {
                            onError: (err: unknown) => {
                              if (err instanceof UpgradeRequiredError) showUpgrade(err.payload);
                              else toastError("Couldn’t save attendee update. Try again.");
                            },
                          })
                        }
                        onRejectInvite={(id) => rejectParticipant.mutate(id)}
                        onViewUser={(u) => { setViewedProfileUsername(u); setIsProfileOpen(true); }}
                      />
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                {participants.map((p: Participant) => {
                    const paid = expenses
                      .filter((e: ExpenseWithParticipant) => e.participantId === p.id)
                      .reduce((s: number, e: ExpenseWithParticipant) => s + Number(e.amount), 0);
                    const isOwn = p.userId === username;
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
                                onClick={() => { setViewedProfileUsername(p.userId!); setIsProfileOpen(true); }}
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
                            onClick={() => deleteParticipant.mutate(p.id)}
                            className="text-muted-foreground hover:text-destructive ml-0.5"
                            title={t.user.leave}
                            data-testid={`button-leave-${p.id}`}
                          >
                            <LogOut className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {!isEditing && canManage && p.userId !== username && (
                          <button
                            onClick={() => deleteParticipant.mutate(p.id)}
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
                                    onClick={() => { setViewedProfileUsername(exp.participantUserId!); setIsProfileOpen(true); }}
                                    className={`hover:text-primary hover:underline ${isPrivateContext ? "decoration-primary/40" : ""}`}
                                    data-testid={`link-expense-payer-${exp.id}`}
                                  >
                                    {exp.participantName}
                                  </button>
                                ) : (
                                  exp.participantName
                                )}
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
                              <Button size="icon" variant="ghost" className="w-7 h-7 text-muted-foreground hover:text-foreground"
                                onClick={() => { setEditingExpense(exp); setIsAddExpenseOpen(true); }}
                                data-testid={`button-edit-expense-${exp.id}`}>
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="w-7 h-7 text-muted-foreground hover:text-destructive"
                                onClick={() => deleteExpense.mutate(exp.id)}
                                data-testid={`button-delete-expense-${exp.id}`}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
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
                          creatorId: selectedBbq.creatorId,
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
                        creatorDisplayName: selectedBbq.creatorId === username ? user?.displayName : undefined,
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
                    { name: selectedBbq?.name ?? "", currency: selectedBbq?.currency ?? "EUR" },
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
                    ? `${typeof window !== "undefined" ? window.location.origin : ""}/join/${selectedBbq.inviteToken}`
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
                      { name: selectedBbq?.name ?? "", subtitle, currency: selectedBbq?.currency ?? "EUR" },
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
                      ? `${typeof window !== "undefined" ? window.location.origin : ""}/join/${selectedBbq.inviteToken}`
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
              <div className="min-h-[340px] lg:min-h-0 lg:h-full">
                <ChatSidebar
                  eventId={selectedBbq.id}
                  eventName={selectedBbq.name}
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
          <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-10">
            <div className="mb-5">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Friends plans</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Plans you&apos;re part of.</p>
              </div>
            </div>

            {isLoadingBbqs ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div key={`private-plan-skeleton-${idx}`} className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
                    <SkeletonLine className="h-5 w-2/3 rounded" />
                    <SkeletonLine className="mt-2 h-4 w-1/2 rounded" />
                    <div className="mt-4 flex items-center gap-2">
                      <SkeletonCard className="h-5 w-16 rounded-full" />
                      <SkeletonCard className="h-5 w-20 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : privatePlansForOverview.length === 0 ? (
              <div className="rounded-2xl border border-border/60 bg-card p-10 text-center">
                <p className="text-base font-medium text-slate-800 dark:text-slate-100">No plans yet. Start one with your friends.</p>
                <Button
                  type="button"
                  className="mt-4"
                  onClick={() => { setNewEventArea(area); setNewEventType(area === "trips" ? "city_trip" : "barbecue"); setIsNewBbqOpen(true); }}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  New plan
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {privatePlansForOverview.map((plan: Barbecue) => {
                  const dateLabel = plan.date
                    ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(plan.date))
                    : null;
                  const locationLabel = plan.locationText
                    || plan.locationName
                    || [plan.city, plan.countryName].filter(Boolean).join(", ")
                    || null;
                  const meta = [dateLabel, locationLabel].filter(Boolean).join(" · ");
                  return (
                    <button
                      key={`private-plan-card-${plan.id}`}
                      type="button"
                      onClick={() => handleSelectEvent(plan.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handleSelectEvent(plan.id);
                        }
                      }}
                      className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="min-w-0 truncate text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">{plan.name}</h3>
                        <span className="shrink-0 rounded-full border border-amber-300/70 bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800 dark:border-amber-600/40 dark:bg-amber-500/20 dark:text-amber-200">
                          Private
                        </span>
                      </div>
                      <p className="mt-2 truncate text-sm text-slate-500 dark:text-neutral-400">
                        {meta || "Date and location to be confirmed"}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <Receipt className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">Pick an event to get started</p>
          </div>
        )}
        </>
        }
      </main>

      {/* Create event drawer */}
      <Sheet open={isNewBbqOpen} onOpenChange={handleNewEventOpenChange}>
        <SheetContent side="right" className="h-full w-full sm:max-w-[760px] p-0" data-testid="dialog-new-bbq">
          <div className="flex h-full flex-col">
            <header className="shrink-0 border-b border-border/60 bg-background/95 px-6 py-4 backdrop-blur">
              <SheetHeader className="space-y-1 text-left">
                <SheetTitle>Start a plan</SheetTitle>
                <SheetDescription>Turn an idea into a plan.</SheetDescription>
              </SheetHeader>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-8 min-h-[460px]">
          {/* Section 1 — Plan basics */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">{t.bbq.eventBasics}</h3>
            {newBbqVisibilityOrigin === "public" ? (
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold">Public plan builder</h3>
                    <p className="text-xs text-muted-foreground">A guided setup for professional events. Your event starts Unlisted.</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    {[
                      { n: 1, label: "Basics" },
                      { n: 2, label: "Page content" },
                      { n: 3, label: "Branding" },
                      { n: 4, label: "Visibility" },
                    ].map((step) => {
                      const active = newPublicCreateStep === step.n;
                      return (
                        <span key={step.n} className={`rounded-full border px-2 py-0.5 ${active ? "border-primary/40 bg-primary/5 text-primary" : "border-border"}`}>
                          {step.label}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {newPublicCreateStep === 1 && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-border/60 bg-muted/10 p-4">
                      <p className="text-sm font-medium">Public events are designed for professional hosting.</p>
                      <p className="text-xs text-muted-foreground mt-1">Your event starts as Unlisted. Only people with your link can view it. Publish when you’re ready to appear on Explore.</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">{t.bbq.bbqName}</Label>
                      <Input
                        placeholder={t.events.event}
                        value={newBbqName}
                        onChange={e => setNewBbqName(e.target.value)}
                        autoFocus
                        data-testid="input-bbq-name"
                        className="focus-visible:ring-2 focus-visible:ring-primary/40"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label className="text-muted-foreground">Category</Label>
                        <EventCategoryBadge category={newEventPublicCategory} compact showTone />
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {PUBLIC_CREATE_CATEGORY_OPTIONS.map((option) => (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => applyPublicCreateCategory(option.key)}
                            className={`rounded-lg border px-3 py-2 text-sm font-medium text-left transition-colors ${newEventPublicCategory === option.key ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:bg-muted/20 hover:text-foreground"}`}
                            data-testid={`button-public-category-${option.key}`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">Choose the category that best matches how your event will appear in Explore.</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Public listing</Label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => setNewBbqPublicMode("marketing")}
                          className={`rounded-lg border p-3 text-left transition-colors ${newBbqPublicMode === "marketing" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/20"}`}
                        >
                          <p className="text-sm font-semibold">Marketing</p>
                          <p className="text-xs text-muted-foreground mt-1">Visible on Explore. People can view details, join via invite link.</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewBbqPublicMode("joinable")}
                          className={`rounded-lg border p-3 text-left transition-colors ${newBbqPublicMode === "joinable" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/20"}`}
                        >
                          <p className="text-sm font-semibold">Joinable</p>
                          <p className="text-xs text-muted-foreground mt-1">Visible on Explore. People can request to join.</p>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {newPublicCreateStep === 2 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Subtitle / tagline (optional)</Label>
                      <Input
                        value={newPublicSubtitle}
                        onChange={(e) => setNewPublicSubtitle(e.target.value)}
                        placeholder="A one-line reason people should care"
                        maxLength={140}
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Date</Label>
                        <Input type="date" value={newBbqDate} onChange={e => setNewBbqDate(e.target.value)} data-testid="input-bbq-date" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Capacity (optional)</Label>
                        <Input inputMode="numeric" placeholder="e.g. 120" value={newPublicCapacity} onChange={(e) => setNewPublicCapacity(e.target.value.replace(/[^\d]/g, ""))} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Location</Label>
                      <Input
                        value={newEventLocation?.locationName ?? ""}
                        onChange={(e) => handleNewEventLocationInput(e.target.value)}
                        onBlur={() => setNewEventLocationTouched(true)}
                        placeholder="Where is it?"
                        data-testid="input-event-location"
                      />
                      {newEventLocationTouched && !newEventLocation?.locationName.trim() ? (
                        <p className="text-xs text-destructive">Location is required.</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Currency uses your default when country is not specified.</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Organization (optional)</Label>
                      <Input value={newPublicOrganizationName} onChange={(e) => setNewPublicOrganizationName(e.target.value)} placeholder="Studio, brand, venue, team…" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Description</Label>
                      <Textarea value={newPublicDescription} onChange={(e) => setNewPublicDescription(e.target.value)} rows={4} maxLength={5000} placeholder="What is this event about? What should attendees know before joining?" />
                      <p className="text-xs text-muted-foreground text-right">{newPublicDescription.length}/5000</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">External link (optional)</Label>
                      <Input type="url" value={newPublicExternalLink} onChange={(e) => setNewPublicExternalLink(e.target.value)} placeholder="https://your-site.example/event" />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-muted-foreground">Tickets / RSVP</Label>
                        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={addPublicRsvpTier}>
                          <Plus className="w-3.5 h-3.5 mr-1" /> Add tier
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {newPublicRsvpTiers.map((tier) => (
                          <div key={tier.id} className="rounded-xl border border-border/60 bg-card p-3 space-y-2">
                            <div className="grid gap-2 sm:grid-cols-2">
                              <Input placeholder="Tier name" value={tier.name} onChange={(e) => updatePublicRsvpTier(tier.id, { name: e.target.value })} />
                              <div className="flex items-center gap-2">
                                <Input
                                  placeholder={tier.isFree ? "Free" : "Price label (e.g. €39)"}
                                  value={tier.priceLabel}
                                  onChange={(e) => updatePublicRsvpTier(tier.id, { priceLabel: e.target.value })}
                                  disabled={tier.isFree}
                                />
                                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removePublicRsvpTier(tier.id)} disabled={newPublicRsvpTiers.length <= 1}>
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                            <Textarea rows={2} placeholder="Description (optional)" value={tier.description} onChange={(e) => updatePublicRsvpTier(tier.id, { description: e.target.value })} />
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                              <div className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2">
                                <input type="checkbox" checked={tier.isFree} onChange={(e) => updatePublicRsvpTier(tier.id, { isFree: e.target.checked, priceLabel: e.target.checked ? "" : tier.priceLabel })} />
                                <span className="text-sm">Free tier</span>
                              </div>
                              <Input
                                inputMode="numeric"
                                placeholder="Capacity (optional)"
                                value={tier.capacity}
                                onChange={(e) => updatePublicRsvpTier(tier.id, { capacity: e.target.value.replace(/[^\d]/g, "") })}
                                className="sm:max-w-[220px]"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {newPublicCreateStep === 3 && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-border/60 bg-muted/10 p-4">
                      <p className="text-sm font-medium">Branding</p>
                      <p className="text-xs text-muted-foreground mt-1">Use a wide banner (recommended 16:9). We’ll center-crop it for public surfaces.</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Template</Label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {PUBLIC_TEMPLATE_OPTIONS.map((template) => (
                          <button
                            key={template.key}
                            type="button"
                            onClick={() => setNewPublicTemplate(template.key)}
                            className={`rounded-xl border p-3 text-left transition-colors ${newPublicTemplate === template.key ? "border-primary bg-primary/5" : "border-border hover:bg-muted/20"}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold">{template.label}</p>
                              <span className="text-[10px] px-2 py-0.5 rounded-full border border-border/70 text-muted-foreground">Layout</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                            <div className={`mt-2 h-12 rounded-lg border border-border/50 ${template.key === "keynote" ? "bg-gradient-to-r from-primary/15 to-primary/5" : template.key === "nightlife" ? "bg-gradient-to-r from-fuchsia-500/15 to-violet-500/5" : template.key === "workshop" ? "bg-gradient-to-r from-emerald-500/12 to-emerald-500/5" : "bg-muted/25"}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Banner image URL</Label>
                      <Input
                        type="url"
                        value={newPublicBannerUrl}
                        onChange={(e) => setNewPublicBannerUrl(e.target.value)}
                        placeholder="https://…"
                        data-testid="input-public-banner-url"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {PUBLIC_BANNER_PRESETS.map((url, idx) => (
                        <button
                          key={`public-banner-preset-${idx}`}
                          type="button"
                          onClick={() => setNewPublicBannerUrl(url)}
                          className={`overflow-hidden rounded-xl border ${newPublicBannerUrl === url ? "border-primary ring-2 ring-primary/20" : "border-border/60"}`}
                          data-testid={`button-public-banner-preset-${idx}`}
                        >
                          <img src={url} alt="" className="h-20 w-full object-cover" />
                        </button>
                      ))}
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-card p-3">
                      <p className="text-xs text-muted-foreground mb-2">Preview</p>
                      <div className="aspect-[16/9] rounded-xl border border-border/60 bg-muted/30 overflow-hidden flex items-center justify-center text-xs text-muted-foreground">
                        {newPublicBannerUrl ? (
                          <img src={newPublicBannerUrl} alt="Banner preview" className="h-full w-full object-cover" />
                        ) : (
                          "No banner selected yet"
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {newPublicCreateStep === 4 && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
                      <p className="text-sm font-medium">Visibility</p>
                      <p className="text-xs text-muted-foreground">Public events start as Unlisted by default and are not discoverable until listing activation.</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-card p-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">List on Explore</p>
                        <p className="text-xs text-muted-foreground">Off by default. Activate listing later in Event Settings to publish.</p>
                      </div>
                      <Switch checked={newPublicListOnExplore} onCheckedChange={setNewPublicListOnExplore} />
                    </div>
                    <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
                      <p className="text-sm font-semibold">Preview</p>
                      <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
                        <p className="text-sm font-medium truncate">{newBbqName || "Untitled public event"}</p>
                        {newPublicSubtitle ? <p className="text-xs text-muted-foreground mt-1 truncate">{newPublicSubtitle}</p> : null}
                        <p className="text-xs text-muted-foreground mt-2">
                          {newEventLocation?.locationName || "Location required"} · {newBbqDate || "Date required"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {newBbqPublicMode === "joinable" ? "Request to join" : "Invite link only"} · {newPublicListOnExplore ? "Wants Explore listing" : "Unlisted by default"}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Create now and publish on Explore when you are ready.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className={`px-2 py-0.5 rounded-full border ${newPrivateCreateStep === 1 ? "border-primary/40 text-primary bg-primary/5" : "border-border"}`}>The plan</span>
                  <span className={`px-2 py-0.5 rounded-full border ${newPrivateCreateStep === 2 ? "border-primary/40 text-primary bg-primary/5" : "border-border"}`}>What kind of plan?</span>
                  <span className={`px-2 py-0.5 rounded-full border ${newPrivateCreateStep === 3 ? "border-primary/40 text-primary bg-primary/5" : "border-border"}`}>Subcategory</span>
                </div>

                {newPrivateCreateStep === 1 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wide">{t.bbq.bbqName}</Label>
                      <Input
                        placeholder="What are we celebrating?"
                        value={newBbqName}
                        onChange={(e) => setNewBbqName(e.target.value)}
                        autoFocus
                        data-testid="input-bbq-name"
                        className="rounded-xl border-border/70 bg-amber-50/70 dark:bg-slate-900/60 focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:shadow-lg focus-visible:shadow-primary/20 transition-all duration-200"
                      />
                      {!newBbqName.trim() ? <p className="text-xs text-muted-foreground">{t.privateWizard.basicsNameHint}</p> : null}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wide">{t.privateWizard.basicsLocationLabel}</Label>
                      <Input
                        placeholder="Where is it?"
                        value={newEventLocation?.locationName ?? ""}
                        onChange={(e) => handleNewEventLocationInput(e.target.value)}
                        onBlur={() => setNewEventLocationTouched(true)}
                        data-testid="input-event-location-private"
                        className="rounded-xl border-border/70 bg-amber-50/70 dark:bg-slate-900/60 focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:shadow-lg focus-visible:shadow-primary/20 transition-all duration-200"
                      />
                      {newEventLocationTouched && !newEventLocation?.locationName.trim() ? (
                        <p className="text-xs text-destructive">Location is required.</p>
                      ) : null}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-muted-foreground text-xs uppercase tracking-wide">{t.bbq.date}</Label>
                        <Input
                          type="date"
                          value={newBbqDate}
                          onChange={(e) => setNewBbqDate(e.target.value)}
                          data-testid="input-bbq-date"
                          className="rounded-xl border-border/70 bg-amber-50/70 dark:bg-slate-900/60 focus-visible:ring-2 focus-visible:ring-primary/60 transition-all duration-200"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-foreground text-xs uppercase tracking-wide">{t.privateWizard.basicsTimeLabel}</Label>
                        <Input
                          type="time"
                          value={newBbqTime}
                          onChange={(e) => setNewBbqTime(e.target.value)}
                          data-testid="input-bbq-time"
                          className="rounded-xl border-border/70 bg-amber-50/70 dark:bg-slate-900/60 focus-visible:ring-2 focus-visible:ring-primary/60 transition-all duration-200"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {newPrivateCreateStep === 2 && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold">Plan type</h4>
                      <p className="text-xs text-muted-foreground mt-1">Pick what you’re planning.</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {PLAN_TYPE_OPTIONS.map((option) => {
                        const Icon = option.icon;
                        const active = newPlanMainCategory === option.id;
                        return (
                          <button
                            key={`plan-main-category-${option.id}`}
                            type="button"
                            onClick={() => applyPlanMainCategory(option.id)}
                            className={`rounded-2xl border p-4 text-left transition-all duration-200 ${
                              active
                                ? "border-primary/70 bg-primary/10 shadow-md shadow-primary/15"
                                : "border-border/70 hover:-translate-y-0.5 hover:bg-muted/20"
                            }`}
                          >
                            <p className="text-sm font-semibold flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              {option.label}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">{option.description}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {newPrivateCreateStep === 3 && (
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-sm font-semibold">{newPlanMainCategory === "trip" ? "Trip type" : "Party type"}</h4>
                      <p className="text-xs text-muted-foreground mt-1">Choose a subcategory.</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {selectedSubcategoryList.map((subcategory) => (
                        <button
                          key={`plan-subcategory-${subcategory.id}`}
                          type="button"
                          onClick={() => applyPlanSubCategory(subcategory.id)}
                          className={`rounded-2xl border p-4 text-left transition-all duration-200 ${
                            newPlanSubCategory === subcategory.id
                              ? "border-primary/70 bg-primary/10 shadow-md shadow-primary/15"
                              : "border-border/70 hover:-translate-y-0.5 hover:bg-muted/20"
                          }`}
                        >
                          <p className="text-sm font-semibold flex items-center gap-1.5">
                            <span aria-hidden className="text-lg">{subcategory.emoji}</span>
                            {subcategory.label}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
              </div>
            </div>
            <footer className="shrink-0 border-t border-border/60 bg-background/95 px-6 py-4 backdrop-blur">
              {newEventWizardFooter}
            </footer>
          </div>
        </SheetContent>
      </Sheet>

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
          currentCurrency={(selectedBbq.currency as string) || "EUR"}
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
        currencyCode={(selectedBbq?.currency as string) || currency}
        groupHomeCurrencyCode={(selectedBbq?.currency as string) || currency}
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

      {/* Profile / Friends Dialog */}
      <UserProfileModal
        open={isProfileOpen}
        onOpenChange={(open) => { setIsProfileOpen(open); if (!open) setViewedProfileUsername(null); }}
        username={viewedProfileUsername}
        onViewUser={(username) => setViewedProfileUsername(username)}
      />
    </div>
  );
}
