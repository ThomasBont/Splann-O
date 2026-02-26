import { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "wouter";
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
import { useBarbecues, useCreateBarbecue, useDeleteBarbecue, useUpdateBarbecue, useEnsureInviteToken, useSettleUp, useEventNotifications, useMarkEventNotificationRead, useCheckoutPublicListing, useDeactivateListing, useExploreEvents, usePublicEventRsvpRequests, useUpdatePublicEventRsvpRequest, type EventNotification, type ExploreEvent } from "@/hooks/use-bbq-data";
import { useQueryClient } from "@tanstack/react-query";
import { useFriends, useFriendRequests, useAllPendingRequests, useAcceptFriendRequest, useRemoveFriend } from "@/hooks/use-friends";
import { UserProfileModal } from "@/components/user-profile-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EventTabs, EventTabsContent, EventTabsList, EventTabsTrigger } from "@/components/event/EventTabs";
import { Modal, ModalSection } from "@/components/ui/modal";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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
import { LocationCombobox } from "@/components/location-combobox";
import { type LocationOption, currencyForCountry } from "@/lib/locations-data";
import { EventHeader } from "@/components/event/EventHeader";
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
  Bell, UserPlus2, Search, Heart, Sun, Moon, MessageCircle, Star,
} from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
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
  type BirthdayTemplateData,
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
import { getEventTheme } from "@/theme/useEventTheme";
import { EventThemeProvider } from "@/themes/ThemeProvider";
import { SignatureEffect } from "@/themes/SignatureEffect";
import { TRIP_THEME_KEYS, PARTY_THEME_KEYS } from "@/theme/eventThemes";
import { normalizeEvent, getEventArea } from "@/utils/eventUtils";
import { computeSplit, getFairShareForParticipant } from "@/lib/split/calc";
import { getEventCategoryFromData, getEventTheme as getCategoryTheme, getEventThemeStyle } from "@/lib/eventTheme";
import { EventCategoryBadge } from "@/components/event/EventCategoryBadge";
import { getCircleMoodTokens, getCirclePersonalityFromEvent, getDefaultCirclePersonality } from "@/lib/circlePersonality";
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
] as const;

const PUBLIC_TEMPLATE_OPTIONS = [
  { key: "classic", label: "Classic", description: "Balanced hero and details layout" },
  { key: "keynote", label: "Keynote", description: "Large headline, presentation-style hero" },
  { key: "workshop", label: "Workshop", description: "Focused agenda-first structure" },
  { key: "nightlife", label: "Nightlife", description: "Atmospheric, bold hero treatment" },
  { key: "meetup", label: "Meetup", description: "Friendly community event layout" },
] as const;

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
export default function Home() {
  const { language, setLanguage, t } = useLanguage();
  const { theme, setPreference } = useTheme();
  const { user, isLoading: isAuthLoading, logout, resendVerification } = useAuth();
  const username = user?.username ?? null;
  const { toast } = useToast();
  const { showUpgrade } = useUpgrade();
  const shouldReduceMotion = useReducedMotion();

  const [area, setArea] = useState<"parties" | "trips">("parties");
  const [eventVisibilityTab, setEventVisibilityTab] = useState<"private" | "public">("private");
  const [selectedBbqId, setSelectedBbqId] = useState<number | null>(null);
  const reactionScopeId = selectedBbqId != null ? `ev-${selectedBbqId}` : "ev-none";
  const { addReaction, getReactions, getReactionUsers, getUserReaction } = useExpenseReactions(reactionScopeId);
  const [isNewBbqOpen, setIsNewBbqOpen] = useState(false);
  const [newBbqName, setNewBbqName] = useState("");
  const [newBbqDate, setNewBbqDate] = useState(new Date().toISOString().split('T')[0]);
  const [newBbqCurrency, setNewBbqCurrency] = useState<CurrencyCode>("EUR");
  const [newBbqIsPublic, setNewBbqIsPublic] = useState(true);
  const [newBbqVisibilityOrigin, setNewBbqVisibilityOrigin] = useState<"private" | "public">("public");
  const [newBbqPublicMode, setNewBbqPublicMode] = useState<"marketing" | "joinable">("marketing");
  const [newBbqAllowOptIn, setNewBbqAllowOptIn] = useState(false);
  const [newEventPublicCategory, setNewEventPublicCategory] = useState<PublicCreateCategoryKey>("networking");
  const [newEventWizardStep, setNewEventWizardStep] = useState<1 | 2 | 3>(1);
  const [newPublicCreateStep, setNewPublicCreateStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [newEventWizardGoal, setNewEventWizardGoal] = useState<"private" | "public" | null>(null);
  const [newEventPrivateAck, setNewEventPrivateAck] = useState(false);
  const [newEventPublicAck, setNewEventPublicAck] = useState(false);
  const [newEventArea, setNewEventArea] = useState<"parties" | "trips">("parties");
  const [newEventType, setNewEventType] = useState<string>("barbecue");
  const [newEventLocation, setNewEventLocation] = useState<LocationOption | null>(null);
  const [newPublicDescription, setNewPublicDescription] = useState("");
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
  const [newPublicDraftChoice, setNewPublicDraftChoice] = useState<"draft" | "publish">("draft");
  const [newPublicCreatedEvent, setNewPublicCreatedEvent] = useState<Barbecue | null>(null);

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
  const [recommendedExpenseTemplate, setRecommendedExpenseTemplate] = useState<{ item: string; category: string; optInDefault?: boolean } | null>(null);
  const [editingExpense, setEditingExpense] = useState<ExpenseWithParticipant | null>(null);
  const [editingParticipantId, setEditingParticipantId] = useState<number | null>(null);
  const [editingParticipantName, setEditingParticipantName] = useState("");
  const [inviteUsername, setInviteUsername] = useState("");
  const [settleUpModalOpen, setSettleUpModalOpen] = useState(false);
  const [activeEventTab, setActiveEventTab] = useState<string>("expenses");

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
  const [editTripLocationOpen, setEditTripLocationOpen] = useState(false);
  const [expensesCollapsed, setExpensesCollapsed] = useState(false);
  const [breakdownCollapsed, setBreakdownCollapsed] = useState(false);
  const [allEventsSelectorOpen, setAllEventsSelectorOpen] = useState(false);
  const [allEventsSearch, setAllEventsSearch] = useState("");
  const [pinnedEventIds, setPinnedEventIds] = useState<number[]>([]);
  const [recentEventIds, setRecentEventIds] = useState<number[]>([]);
  const pinnedEventsStorageKey = useMemo(() => `splanno_pinned_events_${user?.id ?? user?.username ?? "anon"}`, [user?.id, user?.username]);
  const recentEventsStorageKey = useMemo(() => `splanno_recent_events_${user?.id ?? user?.username ?? "anon"}`, [user?.id, user?.username]);

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
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const listing = url.searchParams.get("listing");
    const eventIdParam = Number(url.searchParams.get("eventId"));
    if (!listing) return;

    if (listing === "success") {
      toast({ title: "Listing activated", variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["/api/barbecues"] });
      queryClient.invalidateQueries({ queryKey: ["/api/explore/events"] });
      if (Number.isFinite(eventIdParam)) {
        setSelectedBbqId(eventIdParam);
        setEventVisibilityTab("public");
      }
    } else if (listing === "cancel") {
      toast({ title: "Payment cancelled", variant: "warning" });
    }

    url.searchParams.delete("listing");
    url.searchParams.delete("session_id");
    window.history.replaceState({}, "", url.toString());
  }, [queryClient, toast]);

  const { data: barbecues = [], isLoading: isLoadingBbqs } = useBarbecues();
  const eventTypeOptions = newEventArea === "trips" ? TRIP_THEME_KEYS : PARTY_THEME_KEYS;
  const isValidEventType = (v: string) =>
    newEventArea === "trips"
      ? (TRIP_THEME_KEYS as readonly string[]).includes(v)
      : (PARTY_THEME_KEYS as readonly string[]).includes(v);
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
  const ensureInviteToken = useEnsureInviteToken();
  const settleUp = useSettleUp();
  const checkoutPublicListing = useCheckoutPublicListing();
  const deactivateListing = useDeactivateListing();

  const selectedBbq = barbecuesForArea.find((b: Barbecue) => b.id === selectedBbqId) ?? (barbecues.find((b: Barbecue) => b.id === selectedBbqId) || null);
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
  const isPublicBuilderContext = !!selectedBbq && (selectedBbq.visibilityOrigin === "public" || selectedBbq.visibility === "public");
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
  const { data: invitedParticipants = [] } = useInvitedParticipants(isCreator && isPrivate ? selectedBbqId : null);
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
      const valid = new Set(["overview", "attendees", "schedule", "content", "settings"]);
      if (!valid.has(activeEventTab)) setActiveEventTab("overview");
      return;
    }
    const valid = new Set(["expenses", "people", "split", "notes", "chat"]);
    if (!valid.has(activeEventTab)) setActiveEventTab("expenses");
  }, [selectedBbq?.id, isPublicBuilderContext, activeEventTab]);

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

  const totalSpent = expenses.reduce(
    (sum: number, exp: ExpenseWithParticipant) => sum + (Number.isFinite(Number(exp.amount)) ? Number(exp.amount) : 0),
    0
  );
  const participantCount = participants.length;
  const allowOptIn = !!selectedBbq?.allowOptInExpenses;
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
      onSuccess: () => toast({ title: t.user.joinBbq, description: `${t.user.pending}...` }),
      onError: (err: unknown) => {
        if (err instanceof UpgradeRequiredError) { showUpgrade(err.payload); return; }
        const msg = (err as Error).message;
        if (msg === "already_joined") toast({ title: t.user.joined });
        else if (msg === "already_pending") toast({ title: t.user.pending });
        else toast({ title: msg, variant: "destructive" });
      },
    });
  };

  const handleDiscoverJoin = (bbq: Barbecue) => {
    if (!username) return;
    joinBbq.mutate(
      { bbqId: bbq.id, name: username, userId: username },
      {
        onSuccess: () => {
          toast({ title: t.user.joinBbq, description: `${t.user.pending}...` });
          queryClient.invalidateQueries({ queryKey: ["/api/barbecues"] });
          queryClient.invalidateQueries({ queryKey: ["/api/barbecues/public"] });
          setSelectedBbqId(bbq.id);
          setArea(getEventArea(bbq));
          setDiscoverOpen(false);
        },
        onError: (err: unknown) => {
          if (err instanceof UpgradeRequiredError) { showUpgrade(err.payload); return; }
          const msg = (err as Error).message;
          if (msg === "already_joined") toast({ title: t.user.joined });
          else if (msg === "already_pending") toast({ title: t.user.pending });
          else toast({ title: msg, variant: "destructive" });
        },
      }
    );
  };

  const handleCreateBbq = (publicCreateChoice?: "draft" | "publish") => {
    if (!newBbqName.trim()) return;
    const requestedPublicOnCreate = newBbqIsPublic;
    const requestedPublicModeOnCreate = newBbqPublicMode;
    const requestedVisibilityOriginOnCreate = newBbqVisibilityOrigin;
    const effectivePublicCreateChoice = publicCreateChoice ?? newPublicDraftChoice;
    const requestedCreateAndPublish = requestedVisibilityOriginOnCreate === "public" && effectivePublicCreateChoice === "publish";
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
      templateData = {
        ...baseTemplate,
        personality: getDefaultCirclePersonality({ area: newEventArea, eventType: newEventType }),
      };
    }
    const payload: Parameters<typeof createBbq.mutate>[0] & { currencySource?: "auto" | "manual" } = {
      name: newBbqName.trim(),
      date: new Date(newBbqDate).toISOString(),
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
      payload.locationName = newEventLocation.locationName;
      payload.city = newEventLocation.city;
      payload.countryCode = newEventLocation.countryCode;
      payload.countryName = newEventLocation.countryName;
      const autoCurrency = currencyForCountry(newEventLocation.countryCode);
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
        setSelectedBbqId(data.id);
        setArea(getEventArea(data));
        setEventVisibilityTab("private");
        if (requestedPublicOnCreate) {
          setNewPublicCreatedEvent(data);
          setNewPublicCreateStep(5);
          if (requestedCreateAndPublish) {
            void checkoutPublicListing.mutateAsync({ id: data.id, publicMode: requestedPublicModeOnCreate })
              .then(({ url }) => { window.location.href = url; })
              .catch((err) => {
                const msg = (err as Error).message || "Failed to publish";
                if (!/APP_URL/i.test(msg)) toast({ title: msg, variant: "destructive" });
              });
          }
        } else {
          setNewBbqName(""); setNewBbqDate(new Date().toISOString().split('T')[0]); setNewBbqAllowOptIn(false);
          setNewEventArea("parties"); setNewEventType("barbecue"); setNewEventLocation(null); setNewBbqPublicMode("marketing");
          resetNewEventWizard();
          setNewBbqCurrency(((user?.defaultCurrencyCode as CurrencyCode | undefined) ?? "EUR"));
          setIsNewBbqOpen(false);
        }
      },
      onError: (err: unknown) => {
        if (err instanceof UpgradeRequiredError) { showUpgrade(err.payload); return; }
        toast({ title: t.bbq.create, description: (err as Error).message || "Failed to create barbecue", variant: "destructive" });
      },
    });
  };

  const handleDeleteBbq = (id: number) => {
    deleteBbq.mutate(id);
    if (selectedBbqId === id) setSelectedBbqId(null);
  };

  const resetNewEventWizard = () => {
    setNewEventWizardStep(1);
    setNewPublicCreateStep(1);
    setNewEventWizardGoal(null);
    setNewEventPrivateAck(false);
    setNewEventPublicAck(false);
    setNewEventPublicCategory("networking");
    setNewPublicDescription("");
    setNewPublicOrganizationName("");
    setNewPublicBannerUrl("");
    setNewPublicTemplate("classic");
    setNewPublicCapacity("");
    setNewPublicExternalLink("");
    setNewPublicListFromAt("");
    setNewPublicListUntilAt("");
    setNewPublicRsvpTiers([{ id: "general", name: "General Admission", description: "", priceLabel: "", capacity: "", isFree: true }]);
    setNewPublicDraftChoice("draft");
    setNewPublicCreatedEvent(null);
    setNewBbqVisibilityOrigin("public");
    setNewBbqIsPublic(true);
  };

  const applyNewEventWizardGoal = (goal: "private" | "public") => {
    setNewEventWizardGoal(goal);
    if (goal === "private") {
      setNewBbqVisibilityOrigin("private");
      setNewBbqIsPublic(false);
    } else {
      setNewBbqVisibilityOrigin("public");
      setNewBbqIsPublic(true);
      const preset = PUBLIC_CREATE_CATEGORY_OPTIONS.find((c) => c.key === "networking")!;
      setNewEventPublicCategory(preset.key);
      setNewEventArea(preset.area);
      setNewEventType(preset.eventType);
    }
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

  const markEventRecent = (eventId: number) => {
    setRecentEventIds((prev) => [eventId, ...prev.filter((id) => id !== eventId)].slice(0, 20));
  };

  const handleSelectEvent = (eventId: number | null) => {
    setSelectedBbqId(eventId);
    if (eventId != null) markEventRecent(eventId);
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
        toast({ variant: "success", title: t.bbq.inviteSent });
      },
      onError: (err: unknown) => {
        if (err instanceof UpgradeRequiredError) { showUpgrade(err.payload); return; }
        const msg = (err as Error).message;
        toast({ title: msg === "already_member" ? t.bbq.alreadyMember : msg, variant: "destructive" });
      },
    });
  };

  const canManage = isCreator;
  const isAcceptedMember = !isCreator && !!myParticipant;
  const verifyBannerFlag = import.meta.env.VITE_SHOW_VERIFY_BANNER;
  const showVerifyBanner = verifyBannerFlag != null ? verifyBannerFlag !== "false" : !import.meta.env.DEV;

  const eventStatus = (selectedBbq?.status as "draft" | "active" | "settling" | "settled") ?? "active";
  const publicListingActive = !!(
    selectedBbq?.publicListingStatus === "active" &&
    selectedBbq?.publicListingExpiresAt &&
    new Date(selectedBbq.publicListingExpiresAt).getTime() > Date.now()
  );
  const selectedBbqPendingPublish = !!(
    selectedBbq &&
    selectedBbq.visibility !== "public" &&
    (selectedBbq.publicMode || selectedBbq.publicListingStatus) &&
    selectedBbq.publicListingStatus !== "active"
  );
  const selectedBbqVisibilityOriginLocked = selectedBbq?.visibilityOrigin === "private";
  const publicPeopleTabValue = isPublicBuilderContext ? "attendees" : "people";
  const publicScheduleTabValue = isPublicBuilderContext ? "schedule" : "notes";
  const publicContentTabValue = isPublicBuilderContext ? "content" : "chat";
  const publicSettingsTabValue = "settings";
  const handleSettleUp = () => {
    if (!selectedBbqId) return;
    settleUp.mutate(selectedBbqId, {
      onSuccess: () => {
        setSettleUpModalOpen(false);
        toast({ title: `${t.settleUp.toastSuccess} 💸`, variant: "success" });
      },
      onError: (err) => toast({ title: (err as Error).message, variant: "destructive" }),
    });
  };

  const settleSnapshot = (selectedBbq?.templateData as { settleSnapshot?: { total: number; expenseCount: number } })?.settleSnapshot;
  const showUpdatedAfterBadge = !!settleSnapshot && (
    totalSpent !== settleSnapshot.total || expenses.length !== settleSnapshot.expenseCount
  );
  const allBalancesZero = balances.every((b: { balance: number }) => Math.abs(b.balance) < 0.01);

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
                      onClick={() => window.open(`/u/${encodeURIComponent(user.username)}`, "_blank")}
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
              onSuccess: (data) => toast({ title: data?.sent ? "Verification email sent" : "Check your profile", variant: "default" }),
              onError: () => toast({ title: "Could not send. Try again later.", variant: "destructive" }),
            })}
            disabled={resendVerification.isPending}
          >
            {resendVerification.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Resend"}
          </Button>
        </div>
      )}

      {/* Compact top controls: area, visibility, all-events selector, actions */}
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

              <Popover open={allEventsSelectorOpen} onOpenChange={setAllEventsSelectorOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 min-w-[180px] max-w-[280px] justify-between border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/5 flex-shrink-0"
                    data-testid="button-all-events-selector"
                  >
                    <span className="truncate text-left">{selectedBbq ? selectedEventLabel : "All events"}</span>
                    <ChevronDown className="w-3.5 h-3.5 ml-2 shrink-0 opacity-70" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[320px] p-2">
                  <div className="space-y-2">
                    <p className="px-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">All events</p>
                    <Input
                      value={allEventsSearch}
                      onChange={(e) => setAllEventsSearch(e.target.value)}
                      placeholder="Search events, city, country..."
                      className="h-8"
                    />
                    <div className="max-h-72 overflow-y-auto space-y-1">
                      {allEventsFilteredForArea.length === 0 ? (
                        <p className="px-2 py-2 text-xs text-muted-foreground">No events found</p>
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
                                    {bbq.city && bbq.countryName ? `${bbq.city}, ${bbq.countryName}` : (bbq.countryName || bbq.city || (isPublicItem ? "Public event" : "Private event"))}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${isPublicItem ? "border-sky-400/30 text-sky-300" : "border-amber-400/30 text-amber-300"}`}>
                                    {isPublicItem ? "Public" : "Private"}
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
                  {t.events.newEvent}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Event strip (Pinned only) */}
      {hasPinnedEvents && (
      <div className="sticky top-[114px] z-30 bg-[hsl(var(--surface-0))]/90 backdrop-blur-md border-b border-[hsl(var(--border-subtle))]" data-testid="section-bbq-selector">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2">
          <p className="px-1 pb-1 text-[11px] text-muted-foreground hidden sm:block">
            Pinned events
          </p>
          <div className="overflow-x-auto -mx-1 px-1 pb-1">
            <div className="flex gap-2 items-center min-w-max">
              {isLoadingBbqs ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mx-2" />
              ) : pinnedBarbecuesForArea.length === 0 ? (
                <span className="text-xs text-muted-foreground px-2 py-1.5 italic">
                  {eventVisibilityTab === "private" ? "No pinned private events yet" : "No pinned public events yet"}
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
                  const pendingPublishCard = !isPublicCard && (bbq.visibility === "private") && (bbq.publicMode || bbq.publicListingStatus) && bbq.publicListingStatus !== "active";
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
                        {pendingPublishCard && (
                          <span className="text-[10px] hidden sm:inline px-1.5 py-0.5 rounded-full border bg-amber-200 text-amber-950 border-amber-500/80 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-400/40">
                            Pending publish
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
        {selectedBbqId ? (() => {
          const eventTemplate = getEventTemplate(selectedBbq?.eventType);
          const hasHero = eventTemplate.heroStyle !== "none";
          const bbqTemplateData: BarbecueTemplateData = getTemplateData(
            selectedBbq as any,
            defaultBarbecueTemplateData,
          );
          const birthdayTemplateData: BirthdayTemplateData = getTemplateData(
            selectedBbq as any,
            defaultBirthdayTemplateData,
          );
          const eventCategory = normalizeEvent(selectedBbq ?? {}).category;
          const eventKind = eventCategory === "trip" ? "trip" : "party";
          return (
            <EventThemeProvider kind={eventKind} eventType={selectedBbq?.eventType}>
            <EventTemplateWrapper
              template={eventTemplate}
              decorationClass={isPartyEventType(selectedBbq?.eventType) ? getPartyTemplate(selectedBbq?.eventType).decorationClass : undefined}
              backgroundStyle={isPartyEventType(selectedBbq?.eventType) ? getPartyTemplate(selectedBbq?.eventType).backgroundStyle : undefined}
            >
              {/* Event header with signature effect overlay */}
              <div className="relative">
                <SignatureEffect />
                <EventHeader
                category={normalizeEvent(selectedBbq ?? {}).category}
                type={normalizeEvent(selectedBbq ?? {}).type}
                themeCategoryKey={getEventCategoryFromData({
                  eventType: selectedBbq?.eventType,
                  templateData: selectedBbq?.templateData,
                  visibilityOrigin: selectedBbq?.visibilityOrigin,
                })}
                title={selectedBbq?.name ?? ""}
                dateStr={selectedBbq?.date ? new Date(selectedBbq.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : undefined}
                locationDisplay={
                  selectedBbq?.locationName ??
                  (selectedBbq?.city && selectedBbq?.countryName
                    ? `${selectedBbq.city}, ${selectedBbq.countryName}`
                    : selectedBbq?.countryName ?? null)
                }
                currencySymbol={displayCurrencyInfo.symbol}
                displayCurrency={displayCurrency}
                onCurrencyChange={(v) => {
                  setDisplayCurrency(v as CurrencyCode);
                  if (isCreator && selectedBbqId && selectedBbq?.creatorId === username) {
                    updateBbq.mutate({ id: selectedBbqId, currency: v, currencySource: "manual" });
                  }
                }}
                profileFavorites={user?.favoriteCurrencyCodes ?? []}
                suggestedCurrencyCode={selectedBbq?.countryCode ? currencyForCountry(selectedBbq.countryCode) : null}
                suggestedCurrencyNote={selectedBbq?.countryName ? `Auto from ${selectedBbq.countryName}` : "Auto from location"}
                recentCurrencyStorageKey={user ? `user-${user.id}` : undefined}
                onAddExpense={() => { setRecommendedExpenseTemplate(null); setEditingExpense(null); setIsAddExpenseOpen(true); }}
                addExpenseLabel={t.addExpense}
                isCreator={isCreator}
                allowOptIn={!!selectedBbq?.allowOptInExpenses}
                onOptInChange={!isPublicBuilderContext ? ((checked) => selectedBbqId && updateBbq.mutate({ id: selectedBbqId, allowOptInExpenses: checked })) : undefined}
                optInPending={updateBbq.isPending}
                onDelete={selectedBbqId ? () => handleDeleteBbq(selectedBbqId) : undefined}
                inviteLinkUrl={
                  selectedBbq?.inviteToken
                    ? `${typeof window !== "undefined" ? window.location.origin : ""}/join/${selectedBbq.inviteToken}`
                    : undefined
                }
                onEditLocation={(area === "trips" || (selectedBbq?.city || selectedBbq?.countryCode)) && isCreator ? () => setEditTripLocationOpen(true) : undefined}
                onCopyInviteLink={
                  selectedBbq?.inviteToken
                    ? async () => {
                        const url = `${typeof window !== "undefined" ? window.location.origin : ""}/join/${selectedBbq.inviteToken}`;
                        await navigator.clipboard.writeText(url);
                        toast({ title: t.bbq.copySuccess });
                      }
                    : selectedBbq && isCreator && !selectedBbq.inviteToken
                      ? async () => {
                          const bbq = await ensureInviteToken.mutateAsync(selectedBbq.id);
                          if (bbq?.inviteToken) {
                            const url = `${typeof window !== "undefined" ? window.location.origin : ""}/join/${bbq.inviteToken}`;
                            await navigator.clipboard.writeText(url);
                            toast({ title: t.bbq.copySuccess });
                          }
                        }
                      : undefined
                }
                eventStatus={eventStatus}
                onSettleUp={isCreator && !isPublicBuilderContext ? () => setSettleUpModalOpen(true) : undefined}
                settleUpPending={settleUp.isPending}
                showAddExpenseAction={!isPublicBuilderContext}
                />
              </div>

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

              {isCreator && selectedBbq && !isPublicBuilderContext && (
                <div className="mt-4 rounded-xl border border-border/60 bg-card p-4 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold">Event Settings</h2>
                      <p className="text-xs text-muted-foreground mt-1">
                        You can change this later in Event Settings.
                      </p>
                    </div>
                    {selectedBbq.publicSlug && (
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => window.open(`/events/${selectedBbq.publicSlug}`, "_blank")}
                      >
                        Open public page
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Visibility</p>
                    {selectedBbqVisibilityOriginLocked && (
                      <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-md px-2 py-1.5">
                        This event was created as Private and cannot be converted to Public later.
                      </p>
                    )}
                    <div className="flex rounded-lg border border-border overflow-hidden">
                      <button
                        type="button"
                        className={`flex-1 py-2 text-sm font-medium ${selectedBbq.visibility !== "public" ? "bg-primary text-primary-foreground" : "hover:bg-muted/40"}`}
                        onClick={() => updateBbq.mutate({ id: selectedBbq.id, visibility: "private" })}
                        disabled={updateBbq.isPending}
                      >
                        Private
                      </button>
                      <button
                        type="button"
                        className={`flex-1 py-2 text-sm font-medium ${selectedBbq.visibility === "public" ? "bg-primary text-primary-foreground" : "hover:bg-muted/40"} ${(!publicListingActive || selectedBbqVisibilityOriginLocked) ? "opacity-60 cursor-not-allowed" : ""}`}
                        onClick={() => {
                          if (!publicListingActive || selectedBbqVisibilityOriginLocked) return;
                          updateBbq.mutate({ id: selectedBbq.id, visibility: "public" }, {
                            onError: (err) => toast({ title: (err as Error).message, variant: "destructive" }),
                          });
                        }}
                        disabled={updateBbq.isPending || !publicListingActive || selectedBbqVisibilityOriginLocked}
                        title={selectedBbqVisibilityOriginLocked ? "This event is locked to private" : undefined}
                      >
                        Public
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Public mode</p>
                    <div className="grid gap-2 md:grid-cols-2">
                      <button
                        type="button"
                        className={`rounded-lg border p-3 text-left ${selectedBbq.publicMode !== "joinable" ? "border-primary bg-primary/5" : "border-border"}`}
                        onClick={() => updateBbq.mutate({ id: selectedBbq.id, publicMode: "marketing" })}
                        disabled={updateBbq.isPending}
                      >
                        <p className="text-sm font-semibold">Marketing</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Visible on Explore. People can view details, but can only join with an invite link.
                        </p>
                      </button>
                      <button
                        type="button"
                        className={`rounded-lg border p-3 text-left ${selectedBbq.publicMode === "joinable" ? "border-primary bg-primary/5" : "border-border"}`}
                        onClick={() => updateBbq.mutate({ id: selectedBbq.id, publicMode: "joinable" })}
                        disabled={updateBbq.isPending}
                      >
                        <p className="text-sm font-semibold">Joinable</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Visible on Explore. People can request to join. More exposure, less control.
                        </p>
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">You can change this later in Event Settings.</p>
                  </div>

                  {!publicListingActive ? (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
                      <p className="text-sm font-medium">{selectedBbqPendingPublish ? "This event is private until listing is activated." : "Public listing is not active"}</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedBbqPendingPublish
                          ? "Activate the listing to publish this event on Explore. You can change the mode later."
                          : "Activate the listing before making this event visible on Explore."}
                      </p>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => checkoutPublicListing.mutate({ id: selectedBbq.id, publicMode: ((selectedBbq.publicMode === "joinable" || selectedBbq.publicMode === "marketing") ? selectedBbq.publicMode : "marketing") }, {
                          onSuccess: ({ url }) => {
                            window.location.href = url;
                          },
                          onError: (err) => {
                            const msg = (err as Error).message || "";
                            if (/APP_URL/i.test(msg)) return;
                            toast({ title: msg, variant: "destructive" });
                          },
                        })}
                        disabled={checkoutPublicListing.isPending}
                      >
                        {selectedBbqPendingPublish ? "Activate listing & publish" : "Activate listing"}
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">Listing active</p>
                        <p className="text-xs text-muted-foreground">
                          Listing active until {selectedBbq.publicListingExpiresAt ? new Date(selectedBbq.publicListingExpiresAt).toLocaleDateString() : "—"}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deactivateListing.mutate(selectedBbq.id, {
                          onSuccess: () => toast({ title: "Listing deactivated", variant: "success" }),
                          onError: (err) => toast({ title: (err as Error).message, variant: "destructive" }),
                        })}
                        disabled={deactivateListing.isPending}
                      >
                        Deactivate listing
                      </Button>
                    </div>
                  )}
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

            {/* Template-specific optional sections */}
            {!isPublicBuilderContext && eventTemplate.key === "barbecue" && (
              <div className={`mt-4 rounded-[var(--radius-lg)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-4 space-y-3 shadow-[var(--shadow-sm)] ${isPrivateContext ? `rounded-2xl border-border/60 bg-gradient-to-b from-[hsl(var(--surface-1))] to-[hsl(var(--surface-0))] shadow-sm shadow-neutral-200/40 dark:shadow-black/20 ${privateMood.ringClass} ring-1 space-y-3.5` : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    BBQ Roles
                  </h3>
                  <span className="text-[11px] text-muted-foreground">
                    Optional coordination helpers
                  </span>
                </div>
                <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                  {bbqTemplateData.roles.map((role) => (
                    <li key={role.id} className="rounded-[var(--radius-md)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-2))]/50 px-3 py-2">
                      <p className="font-medium">{role.label}</p>
                      {role.description && (
                        <p className="text-xs text-muted-foreground">
                          {role.description}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!isPublicBuilderContext && eventTemplate.key === "birthday" && (
              <div className="mt-4 rounded-[var(--radius-lg)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-4 space-y-3 shadow-[var(--shadow-sm)]">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Gift contributions
                  </h3>
                  <span className="text-[11px] text-muted-foreground">
                    Based on current expenses
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    Use expenses to track who chipped in for the gift. This summary shows each person’s total.
                  </p>
                  <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                    Total: {formatMoney(totalSpent)}
                  </span>
                </div>
                <ul className="space-y-1.5 text-sm">
                  {participants.map((p: Participant) => {
                    // Derive contribution amounts from expenses; templateData can be used for richer UIs later
                    const paid = expenses
                      .filter((e: ExpenseWithParticipant) => e.participantId === p.id)
                      .reduce((sum: number, e: ExpenseWithParticipant) => sum + Number(e.amount), 0);
                    if (!paid) return null;
                    return (
                      <li key={p.id} className="flex items-center justify-between gap-3">
                        <span className="truncate">{p.name}</span>
                        <span className="font-semibold text-primary">{formatMoney(paid)}</span>
                      </li>
                    );
                  })}
                  {participants.every((p: Participant) => {
                    const paid = expenses
                      .filter((e: ExpenseWithParticipant) => e.participantId === p.id)
                      .reduce((sum: number, e: ExpenseWithParticipant) => sum + Number(e.amount), 0);
                    return paid === 0;
                  }) && (
                    <li className="text-xs text-muted-foreground">
                      {isPrivateContext ? "No gift contributions yet. Add one when the group is ready." : "No gift contributions yet. Add expenses to start tracking."}
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* Row C: Tabs */}
            <div className="mt-4">
            <EventTabs value={activeEventTab} onValueChange={setActiveEventTab}>
              <EventTabsList>
                {isPublicBuilderContext ? (
                  <>
                    <EventTabsTrigger value="overview" data-testid="tab-overview">Overview</EventTabsTrigger>
                    <EventTabsTrigger value="attendees" data-testid="tab-attendees">Attendees</EventTabsTrigger>
                    <EventTabsTrigger value="schedule" data-testid="tab-schedule">Schedule</EventTabsTrigger>
                    <EventTabsTrigger value="content" data-testid="tab-content">Content</EventTabsTrigger>
                    {isCreator && <EventTabsTrigger value="settings" data-testid="tab-settings">Settings</EventTabsTrigger>}
                  </>
                ) : (
                  <>
                    <EventTabsTrigger value="expenses" data-testid="tab-expenses">{t.tabs.expenses}</EventTabsTrigger>
                    <EventTabsTrigger value="people" data-testid="tab-people">{t.tabs.people}</EventTabsTrigger>
                    <EventTabsTrigger value="split" data-testid="tab-split">{t.tabs.split}</EventTabsTrigger>
                    <EventTabsTrigger value="notes" data-testid="tab-notes">{t.tabs.notes}</EventTabsTrigger>
                    <EventTabsTrigger value="chat" data-testid="tab-chat">{t.tabs.chat}</EventTabsTrigger>
                  </>
                )}
              </EventTabsList>

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
                  <EventTabsContent value="schedule">
                    <div className="rounded-2xl border border-border/60 bg-card p-6">
                      <p className="text-sm font-medium">Schedule</p>
                      <p className="text-sm text-muted-foreground mt-1">Add agenda blocks and timing details here in a future update.</p>
                    </div>
                  </EventTabsContent>
                  <EventTabsContent value="content">
                    <div className="rounded-2xl border border-border/60 bg-card p-6">
                      <p className="text-sm font-medium">Content</p>
                      <p className="text-sm text-muted-foreground mt-1">Share updates, links, and assets for attendees here in a future update.</p>
                    </div>
                  </EventTabsContent>
                  {isCreator && (
                    <EventTabsContent value="settings" className="space-y-4">
                      <div className="rounded-xl border border-border/60 bg-card p-4 space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h2 className="text-sm font-semibold">Public event settings</h2>
                            <p className="text-xs text-muted-foreground mt-1">Professional event tools for listing, branding, and visibility.</p>
                          </div>
                          {selectedBbq.publicSlug && (
                            <button type="button" className="text-xs text-primary hover:underline" onClick={() => window.open(`/events/${selectedBbq.publicSlug}`, "_blank")}>
                              Open public page
                            </button>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Banner URL</Label>
                          <Input
                            value={selectedBbq.bannerImageUrl ?? ""}
                            placeholder="https://…"
                            onChange={(e) => updateBbq.mutate({ id: selectedBbq.id, bannerImageUrl: e.target.value || null })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Template</Label>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {PUBLIC_TEMPLATE_OPTIONS.map((template) => (
                              <button
                                key={`settings-public-template-${template.key}`}
                                type="button"
                                onClick={() => updateBbq.mutate({ id: selectedBbq.id, publicTemplate: template.key })}
                                className={`rounded-lg border p-3 text-left ${((selectedBbq.publicTemplate as string | undefined) ?? "classic") === template.key ? "border-primary bg-primary/5" : "border-border"}`}
                              >
                                <p className="text-sm font-semibold">{template.label}</p>
                                <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Public mode</p>
                          <div className="grid gap-2 md:grid-cols-2">
                            <button type="button" className={`rounded-lg border p-3 text-left ${selectedBbq.publicMode !== "joinable" ? "border-primary bg-primary/5" : "border-border"}`} onClick={() => updateBbq.mutate({ id: selectedBbq.id, publicMode: "marketing" })}>
                              <p className="text-sm font-semibold">Marketing</p>
                              <p className="text-xs text-muted-foreground mt-1">Visible on Explore. People can view details, join via invite link.</p>
                            </button>
                            <button type="button" className={`rounded-lg border p-3 text-left ${selectedBbq.publicMode === "joinable" ? "border-primary bg-primary/5" : "border-border"}`} onClick={() => updateBbq.mutate({ id: selectedBbq.id, publicMode: "joinable" })}>
                              <p className="text-sm font-semibold">Joinable</p>
                              <p className="text-xs text-muted-foreground mt-1">Visible on Explore. People can request to join.</p>
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Visibility</p>
                          {selectedBbqVisibilityOriginLocked && (
                            <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-md px-2 py-1.5">
                              This event was created as Private and cannot be converted to Public later.
                            </p>
                          )}
                          <div className="flex rounded-lg border border-border overflow-hidden">
                            <button
                              type="button"
                              className={`flex-1 py-2 text-sm font-medium ${selectedBbq.visibility !== "public" ? "bg-primary text-primary-foreground" : "hover:bg-muted/40"}`}
                              onClick={() => updateBbq.mutate({ id: selectedBbq.id, visibility: "private" })}
                              disabled={updateBbq.isPending}
                            >
                              Unlisted
                            </button>
                            <button
                              type="button"
                              className={`flex-1 py-2 text-sm font-medium ${selectedBbq.visibility === "public" ? "bg-primary text-primary-foreground" : "hover:bg-muted/40"} ${(!publicListingActive || selectedBbqVisibilityOriginLocked) ? "opacity-60 cursor-not-allowed" : ""}`}
                              onClick={() => {
                                if (!publicListingActive || selectedBbqVisibilityOriginLocked) return;
                                updateBbq.mutate({ id: selectedBbq.id, visibility: "public" }, {
                                  onError: (err) => toast({ title: (err as Error).message, variant: "destructive" }),
                                });
                              }}
                              disabled={updateBbq.isPending || !publicListingActive || selectedBbqVisibilityOriginLocked}
                            >
                              Listed
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground">Only listed public events appear on Explore and public profiles.</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">List from (optional)</Label>
                            <Input
                              type="datetime-local"
                              value={selectedBbq.publicListFromAt ? new Date(selectedBbq.publicListFromAt).toISOString().slice(0, 16) : ""}
                              onChange={(e) => updateBbq.mutate({ id: selectedBbq.id, publicListFromAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">List until (optional)</Label>
                            <Input
                              type="datetime-local"
                              value={selectedBbq.publicListUntilAt ? new Date(selectedBbq.publicListUntilAt).toISOString().slice(0, 16) : ""}
                              onChange={(e) => updateBbq.mutate({ id: selectedBbq.id, publicListUntilAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                            />
                          </div>
                        </div>
                        {!publicListingActive ? (
                          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
                            <p className="text-sm font-medium">{selectedBbq.publicListingStatus === "paused" ? "Listing paused" : "Listing inactive"}</p>
                            <p className="text-xs text-muted-foreground">
                              {selectedBbq.publicListingStatus === "paused"
                                ? "This listing is temporarily hidden from Explore. Resume it anytime before the listing expires."
                                : "Activate a listing to publish this event on Explore. Payment is handled through Stripe Checkout."}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                onClick={() => {
                                  if (selectedBbq.publicListingStatus === "paused") {
                                    updateBbq.mutate({ id: selectedBbq.id, publicListingStatus: "active", visibility: "public" });
                                    return;
                                  }
                                  checkoutPublicListing.mutate({ id: selectedBbq.id, publicMode: ((selectedBbq.publicMode === "joinable" || selectedBbq.publicMode === "marketing") ? selectedBbq.publicMode : "marketing") }, {
                                    onSuccess: ({ url }) => { window.location.href = url; },
                                    onError: (err) => {
                                      const msg = (err as Error).message || "";
                                      if (/APP_URL/i.test(msg)) return;
                                      toast({ title: msg, variant: "destructive" });
                                    },
                                  });
                                }}
                                disabled={checkoutPublicListing.isPending || updateBbq.isPending}
                              >
                                {selectedBbq.publicListingStatus === "paused" ? "Resume listing" : "Activate listing & publish"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={async () => {
                                  const ensured = await ensureInviteToken.mutateAsync(selectedBbq.id);
                                  if (!ensured?.inviteToken) return;
                                  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/join/${ensured.inviteToken}`;
                                  await navigator.clipboard.writeText(url);
                                  toast({ title: t.bbq.copySuccess, variant: "success" });
                                }}
                              >
                                Copy invite link
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium">Listing active</p>
                              <p className="text-xs text-muted-foreground">
                                Listing active until {selectedBbq.publicListingExpiresAt ? new Date(selectedBbq.publicListingExpiresAt).toLocaleDateString() : "—"}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {selectedBbq.publicSlug && (
                                <Button size="sm" variant="outline" onClick={() => window.open(`/events/${selectedBbq.publicSlug}`, "_blank")}>
                                  Preview public page
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateBbq.mutate({ id: selectedBbq.id, publicListingStatus: "paused", visibility: "private" })}
                                disabled={updateBbq.isPending}
                              >
                                Pause listing
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => deactivateListing.mutate(selectedBbq.id, {
                                  onSuccess: () => toast({ title: "Listing deactivated", variant: "success" }),
                                  onError: (err) => toast({ title: (err as Error).message, variant: "destructive" }),
                                })}
                                disabled={deactivateListing.isPending}
                              >
                                Deactivate listing
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </EventTabsContent>
                  )}
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
                      <p className="text-sm text-muted-foreground">No RSVP requests yet.</p>
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
                    {isCreator && isPrivate && (
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
                              else toast({ title: (err as Error).message, variant: "destructive" });
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
                        presets={getExpenseTemplates(category, type)}
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
                              title={isPrivateContext ? "This circle is quiet for now" : theme.copy.emptyExpensesTitle}
                              description={isPrivateContext ? "Add the first expense when you’re ready. Splanno will remember how your circle usually works." : theme.copy.emptyExpensesBody}
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

              {/* Split Tab */}
              {!isPublicBuilderContext && <EventTabsContent value="split" className="space-y-4">
                <IndividualContributions
                  balances={balances}
                  totalSpent={totalSpent}
                  formatMoney={formatMoney}
                  emptyLabel={isPrivateContext ? "No contributions yet — this circle is just getting started." : t.emptyState.title}
                  contributionsLabel={t.split.contributions}
                  reducedMotion={!!shouldReduceMotion}
                  warm={isPrivateContext}
                />

                {/* Event Recap share (when there's expense data) */}
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
              {!isPublicBuilderContext && <EventTabsContent value={publicScheduleTabValue}>
                <NotesTab
                  eventId={selectedBbqId}
                  myParticipantId={myParticipant?.id ?? null}
                  canAddNote={!!myParticipant}
                />
              </EventTabsContent>}

              {/* Chat Tab — placeholder */}
              {!isPublicBuilderContext && <EventTabsContent value={publicContentTabValue}>
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
            </EventTabs>
            </div>
            </EventTemplateWrapper>
            </EventThemeProvider>
          );
        })() : (
          <div className="text-center py-16 text-muted-foreground">
            <Receipt className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">{t.bbq.selectBbq}</p>
          </div>
        )}
        </>
        }
      </main>

      {/* Create event dialog — premium section-based layout */}
      <Modal
        open={isNewBbqOpen}
        onClose={() => { setIsNewBbqOpen(false); setNewEventArea(area); setNewEventType(area === "trips" ? "city_trip" : "barbecue"); setNewEventLocation(null); resetNewEventWizard(); }}
        onOpenChange={(open) => { setIsNewBbqOpen(open); if (!open) { setNewEventArea(area); setNewEventType(area === "trips" ? "city_trip" : "barbecue"); setNewEventLocation(null); resetNewEventWizard(); } else { resetNewEventWizard(); } }}
        title={t.events.newEvent}
        subtitle={t.subtitle}
        size="2xl"
        scrollable
        footer={
          <div className="w-full space-y-2">
            {newEventWizardStep === 3 && newBbqVisibilityOrigin === "public" && newPublicCreateStep < 5 && (
              <p className="text-xs text-muted-foreground text-right">
                Your event is created as a private draft. Publish to Explore when ready.
              </p>
            )}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 w-full">
              <Button
                variant="ghost"
                onClick={() => {
                  if (newEventWizardStep === 3 && newBbqVisibilityOrigin === "public" && newPublicCreateStep > 1 && newPublicCreateStep < 5) {
                    setNewPublicCreateStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s));
                    return;
                  }
                  if (newEventWizardStep === 3 && newBbqVisibilityOrigin === "public" && newPublicCreateStep === 5) {
                    setIsNewBbqOpen(false);
                    setNewEventArea(area);
                    setNewEventType(area === "trips" ? "city_trip" : "barbecue");
                    setNewEventLocation(null);
                    resetNewEventWizard();
                    setNewBbqName("");
                    setNewBbqDate(new Date().toISOString().split('T')[0]);
                    setNewBbqAllowOptIn(false);
                    setNewBbqCurrency(((user?.defaultCurrencyCode as CurrencyCode | undefined) ?? "EUR"));
                    return;
                  }
                  if (newEventWizardStep > 1) {
                    setNewEventWizardStep((s) => (s > 1 ? ((s - 1) as 1 | 2) : s));
                    return;
                  }
                  setIsNewBbqOpen(false);
                }}
                className="w-full sm:w-auto order-2 sm:order-1"
                data-testid="button-cancel-bbq"
              >
                {newEventWizardStep === 3 && newBbqVisibilityOrigin === "public" && newPublicCreateStep === 5
                  ? "Done"
                  : (newEventWizardStep > 1 ? "Back" : t.modals.cancel)}
              </Button>
              {newEventWizardStep < 3 ? (
                <Button
                  onClick={() => {
                    if (newEventWizardStep === 1) {
                      if (!newEventWizardGoal) return;
                      applyNewEventWizardGoal(newEventWizardGoal);
                      setNewEventWizardStep(2);
                      return;
                    }
                    if (newEventWizardGoal === "private" && !newEventPrivateAck) return;
                    if (newEventWizardGoal === "public" && !newEventPublicAck) return;
                    setNewEventWizardStep(3);
                  }}
                  disabled={
                    (newEventWizardStep === 1 && !newEventWizardGoal) ||
                    (newEventWizardStep === 2 && newEventWizardGoal === "private" && !newEventPrivateAck) ||
                    (newEventWizardStep === 2 && newEventWizardGoal === "public" && !newEventPublicAck)
                  }
                  className="w-full sm:w-auto bg-primary text-primary-foreground font-semibold transition-all duration-150 order-1 sm:order-2"
                  data-testid="button-wizard-next"
                >
                  Continue
                </Button>
              ) : newBbqVisibilityOrigin === "public" && newPublicCreateStep < 4 ? (
                <Button
                  onClick={() => setNewPublicCreateStep((s) => ((s + 1) as 2 | 3 | 4))}
                  disabled={
                    (newPublicCreateStep === 1 && !newBbqName.trim()) ||
                    (newPublicCreateStep === 2 && !newBbqName.trim())
                  }
                  className="w-full sm:w-auto bg-primary text-primary-foreground font-semibold transition-all duration-150 order-1 sm:order-2"
                  data-testid="button-public-builder-next"
                >
                  Next
                </Button>
              ) : newBbqVisibilityOrigin === "public" && newPublicCreateStep === 4 ? (
                <div className="flex w-full sm:w-auto order-1 sm:order-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => { setNewPublicDraftChoice("draft"); handleCreateBbq("draft"); }}
                    disabled={!newBbqName.trim() || createBbq.isPending}
                    className="flex-1 sm:flex-none"
                    data-testid="button-create-public-draft"
                  >
                    {createBbq.isPending && newPublicDraftChoice === "draft" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create in Draft"}
                  </Button>
                  <Button
                    onClick={() => { setNewPublicDraftChoice("publish"); handleCreateBbq("publish"); }}
                    disabled={!newBbqName.trim() || createBbq.isPending}
                    className="flex-1 sm:flex-none bg-primary text-primary-foreground font-semibold"
                    data-testid="button-create-public-publish"
                  >
                    {createBbq.isPending && newPublicDraftChoice === "publish" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create & Publish"}
                  </Button>
                </div>
              ) : newBbqVisibilityOrigin === "public" && newPublicCreateStep === 5 ? null : (
                <Button
                  onClick={() => handleCreateBbq()}
                  disabled={!newBbqName.trim() || createBbq.isPending}
                  className="w-full sm:w-auto bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5 transition-all duration-150 order-1 sm:order-2"
                  data-testid="button-create-bbq"
                >
                  {createBbq.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t.bbq.create}
                </Button>
              )}
            </div>
          </div>
        }
        data-testid="dialog-new-bbq"
      >
        <div className="space-y-8">
          {newEventWizardStep < 3 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className={`px-2 py-0.5 rounded-full border ${newEventWizardStep === 1 ? "border-primary/40 text-primary bg-primary/5" : "border-border"}`}>1. Goal</span>
                <span className={`px-2 py-0.5 rounded-full border ${newEventWizardStep === 2 ? "border-primary/40 text-primary bg-primary/5" : "border-border"}`}>2. Privacy guide</span>
                <span className="px-2 py-0.5 rounded-full border border-border opacity-60">3. Details</span>
              </div>

              {newEventWizardStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">What is your goal for this event?</h3>
                    <p className="text-sm text-muted-foreground">Choose the experience you want. We will set up the right privacy flow for you.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setNewEventWizardGoal("private")}
                      className={`rounded-xl border p-4 text-left transition-all ${!shouldReduceMotion ? "duration-150" : ""} ${newEventWizardGoal === "private" ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:bg-muted/20"}`}
                      data-testid="wizard-goal-private"
                    >
                      <div className="flex items-center gap-2 font-semibold"><Lock className="w-4 h-4" /> Private event (friends)</div>
                      <p className="text-xs text-muted-foreground mt-2">For friend groups, shared costs, and invite-only coordination.</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewEventWizardGoal("public")}
                      className={`rounded-xl border p-4 text-left transition-all ${!shouldReduceMotion ? "duration-150" : ""} ${newEventWizardGoal === "public" ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:bg-muted/20"}`}
                      data-testid="wizard-goal-public"
                    >
                      <div className="flex items-center gap-2 font-semibold"><Globe className="w-4 h-4" /> Public event (professional)</div>
                      <p className="text-xs text-muted-foreground mt-2">For organizations, brands, and events you may want listed on Explore.</p>
                    </button>
                  </div>
                </div>
              )}

              {newEventWizardStep === 2 && newEventWizardGoal && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">Before you continue</h3>
                    <p className="text-sm text-muted-foreground">A quick explanation so the privacy behavior is clear from the start.</p>
                  </div>
                  {newEventWizardGoal === "public" ? (
                    <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 space-y-2">
                      <p className="text-sm font-medium flex items-center gap-2"><Globe className="w-4 h-4" /> Public event — discoverable</p>
                      <p className="text-sm text-muted-foreground">
                        This event can be listed publicly and discovered in Explore.
                        It will start in private mode until you activate the listing.
                      </p>
                      <div className="rounded-lg border border-sky-500/15 bg-background/50 px-3 py-2">
                        <p className="text-xs text-muted-foreground">
                          Public events are only visible in Explore after listing activation.
                          You stay in control before publishing.
                        </p>
                      </div>
                      <label className="flex items-start gap-2 text-sm pt-1">
                        <input
                          type="checkbox"
                          checked={newEventPublicAck}
                          onChange={(e) => setNewEventPublicAck(e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-border"
                        />
                        <span>I understand this event starts private and won’t appear in Explore until I activate the listing.</span>
                      </label>
                      <p className="text-xs text-muted-foreground pl-6">You can activate the listing later from event settings.</p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border/60 bg-muted/10 p-4 space-y-3">
                      <p className="text-sm font-medium flex items-center gap-2"><Lock className="w-4 h-4" /> Private event — invite-only</p>
                      <p className="text-sm text-muted-foreground">
                        This event will only be visible to people you invite.
                        It will not appear in Explore or public listings.
                      </p>
                      <label className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={newEventPrivateAck}
                          onChange={(e) => setNewEventPrivateAck(e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-border"
                        />
                        <span>I understand this event will remain invite-only.</span>
                      </label>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">You can edit event details later. Only the visibility type cannot be changed.</p>
                </div>
              )}
            </div>
          )}

          {newEventWizardStep === 3 && (
          <>
          {/* Section 1 — Event Basics */}
          <ModalSection title={t.bbq.eventBasics}>
            {newBbqVisibilityOrigin === "public" ? (
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold">Public event builder</h3>
                    <p className="text-xs text-muted-foreground">A guided setup for professional events. Your event starts Unlisted.</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    {[
                      { n: 1, label: "Basics" },
                      { n: 2, label: "Branding" },
                      { n: 3, label: "Publish" },
                      { n: 4, label: "Success" },
                    ].map((step) => {
                      const active = newPublicCreateStep === step.n || (step.n === 4 && newPublicCreateStep === 5);
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
                      <LocationCombobox value={newEventLocation} onChange={setNewEventLocation} placeholder="Search city or country…" data-testid="input-event-location" />
                      <p className="text-xs text-muted-foreground">Currency is set automatically from the country (or your default if none selected).</p>
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
                      <p className="text-sm font-medium">Publish settings</p>
                      <p className="text-xs text-muted-foreground">Public events start as Unlisted by default. Publishing makes them visible on Explore (after listing activation).</p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setNewPublicDraftChoice("draft")}
                        className={`rounded-lg border p-3 text-left ${newPublicDraftChoice === "draft" ? "border-primary bg-primary/5" : "border-border"}`}
                      >
                        <p className="text-sm font-semibold">Draft / Unlisted</p>
                        <p className="text-xs text-muted-foreground mt-1">Create privately first. Only people with your invite link can view it.</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewPublicDraftChoice("publish")}
                        className={`rounded-lg border p-3 text-left ${newPublicDraftChoice === "publish" ? "border-primary bg-primary/5" : "border-border"}`}
                      >
                        <p className="text-sm font-semibold">Create & publish</p>
                        <p className="text-xs text-muted-foreground mt-1">Start checkout after creation and publish on Explore when payment is confirmed.</p>
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">List from (optional)</Label>
                        <Input type="datetime-local" value={newPublicListFromAt} onChange={(e) => setNewPublicListFromAt(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">List until (optional)</Label>
                        <Input type="datetime-local" value={newPublicListUntilAt} onChange={(e) => setNewPublicListUntilAt(e.target.value)} />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Publishing makes the event visible on Explore, depending on your public mode.</p>
                  </div>
                )}

                {newPublicCreateStep === 5 && newPublicCreatedEvent && (
                  <div className="space-y-4">
                    {(() => {
                      const shareUrl = newPublicCreatedEvent.publicSlug
                        ? `${typeof window !== "undefined" ? window.location.origin : ""}/events/${newPublicCreatedEvent.publicSlug}`
                        : "";
                      const copyShareLink = async () => {
                        if (!shareUrl) {
                          toast({ title: "Public link is not ready yet.", variant: "default" });
                          return;
                        }
                        try {
                          await navigator.clipboard.writeText(shareUrl);
                          toast({ title: "Link copied", variant: "success" });
                        } catch {
                          const input = document.getElementById("public-event-share-link-input") as HTMLInputElement | null;
                          if (input) {
                            input.focus();
                            input.select();
                          }
                          toast({ title: "Press Ctrl/Cmd+C to copy", variant: "default" });
                        }
                      };
                      return (
                        <>
                    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                      <p className="text-sm font-semibold">Draft created</p>
                      <p className="text-xs text-muted-foreground mt-1">Your public event was created as an unlisted draft. It has a public page link already, and it will only appear on Explore after you publish the listing.</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Share link</Label>
                      <Input
                        id="public-event-share-link-input"
                        value={shareUrl}
                        readOnly
                        onFocus={(e) => e.currentTarget.select()}
                        placeholder="Public link will appear here"
                        data-testid="input-public-event-share-link"
                      />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Button
                        type="button"
                        onClick={copyShareLink}
                        className="bg-primary text-primary-foreground"
                        data-testid="button-copy-public-share-link"
                      >
                        Copy share link
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (newPublicCreatedEvent.publicSlug) window.open(`/events/${newPublicCreatedEvent.publicSlug}`, "_blank");
                          else toast({ title: "Public page preview is available after listing activation.", variant: "default" });
                        }}
                      >
                        Preview public page
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => checkoutPublicListing.mutate({ id: newPublicCreatedEvent.id, publicMode: newBbqPublicMode }, {
                          onSuccess: ({ url }) => { window.location.href = url; },
                          onError: (err) => {
                            const msg = (err as Error).message || "Failed to start checkout";
                            if (!/APP_URL/i.test(msg)) toast({ title: msg, variant: "destructive" });
                          },
                        })}
                        disabled={checkoutPublicListing.isPending}
                      >
                        Publish listing
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={async () => {
                          const ensured = await ensureInviteToken.mutateAsync(newPublicCreatedEvent.id);
                          if (!ensured?.inviteToken) return;
                          const url = `${typeof window !== "undefined" ? window.location.origin : ""}/join/${ensured.inviteToken}`;
                          await navigator.clipboard.writeText(url);
                          toast({ title: "Invite link copied", variant: "success" });
                        }}
                      >
                        Share invite link
                      </Button>
                    </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">{t.nav.parties} / {t.nav.trips}</Label>
                  <div className="flex rounded-lg border border-border overflow-hidden">
                    <button
                      type="button"
                      onClick={() => { setNewEventArea("parties"); setNewEventType("barbecue"); }}
                      className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${newEventArea === "parties" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
                    >
                      {t.nav.parties}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setNewEventArea("trips"); setNewEventType("city_trip"); }}
                      className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${newEventArea === "trips" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
                    >
                      {t.nav.trips}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Event type</Label>
                  <Select
                    value={isValidEventType(newEventType) ? newEventType : (eventTypeOptions[0] ?? "barbecue")}
                    onValueChange={setNewEventType}
                  >
                    <SelectTrigger data-testid="select-event-type" className="focus-visible:ring-2 focus-visible:ring-primary/40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {newEventArea === "trips"
                        ? TRIP_THEME_KEYS.map((key) => {
                            const theme = getEventTheme("trip", key);
                            const label = (t.eventTypes as Record<string, string>)[theme.labelKey] ?? theme.copy.tagline;
                            return (
                              <SelectItem key={key} value={key}>
                                <span className="flex items-center gap-2">
                                  <span className="text-base leading-none" aria-hidden>{theme.icon}</span>
                                  {label}
                                </span>
                              </SelectItem>
                            );
                          })
                        : PARTY_THEME_KEYS.map((key) => {
                            const theme = getEventTheme("party", key);
                            const label = (t.eventTypes as Record<string, string>)[theme.labelKey] ?? theme.copy.tagline;
                            return (
                              <SelectItem key={key} value={key}>
                                <span className="flex items-center gap-2">
                                  <span className="text-base leading-none" aria-hidden>{theme.icon}</span>
                                  {label}
                                </span>
                              </SelectItem>
                            );
                          })}
                    </SelectContent>
                  </Select>
                  {isValidEventType(newEventType) && (
                    <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 flex items-center gap-2">
                      <span className="text-lg" aria-hidden>{getEventTheme(newEventArea === "trips" ? "trip" : "party", newEventType).icon}</span>
                      <p className="text-xs text-muted-foreground">{getEventTheme(newEventArea === "trips" ? "trip" : "party", newEventType).copy.tagline}</p>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Location</Label>
                  <LocationCombobox
                    value={newEventLocation}
                    onChange={setNewEventLocation}
                    placeholder={newEventArea === "trips" ? "Search city or country…" : "Optional — e.g. Amsterdam"}
                    data-testid="input-event-location"
                  />
                  {newEventArea === "trips" && (
                    <p className="text-xs text-muted-foreground">Currency will be set automatically from the country.</p>
                  )}
                  {newEventArea === "parties" && newEventLocation && (
                    <p className="text-xs text-muted-foreground">Currency set from country. Override in Advanced below.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">{t.bbq.bbqName}</Label>
                  <Input
                    placeholder={t.events.event}
                    value={newBbqName}
                    onChange={e => setNewBbqName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleCreateBbq()}
                    autoFocus
                    data-testid="input-bbq-name"
                    className="focus-visible:ring-2 focus-visible:ring-primary/40"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">{t.bbq.date}</Label>
                  <Input
                    type="date"
                    value={newBbqDate}
                    onChange={e => setNewBbqDate(e.target.value)}
                    data-testid="input-bbq-date"
                    className="focus-visible:ring-2 focus-visible:ring-primary/40"
                  />
                </div>
              </div>
            )}
          </ModalSection>
          </>
          )}
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
