import { useState, useEffect, useRef, useMemo } from "react";
import { useLanguage, CURRENCIES, SELECTABLE_LANGUAGES, type CurrencyCode, convertCurrency } from "@/hooks/use-language";
import { useAuth } from "@/hooks/use-auth";
import {
  useParticipants, useCreateParticipant, useDeleteParticipant, useUpdateParticipantName,
  usePendingRequests, useMemberships, useJoinBarbecue,
  useAcceptParticipant, useRejectParticipant,
  useInvitedParticipants, useInviteParticipant,
  useAcceptInvite, useDeclineInvite,
} from "@/hooks/use-participants";
import { useExpenses, useDeleteExpense, useExpenseShares, useSetExpenseShare } from "@/hooks/use-expenses";
import { useBarbecues, useCreateBarbecue, useDeleteBarbecue, useUpdateBarbecue, useEnsureInviteToken, useSettleUp, useEventNotifications, useMarkEventNotificationRead, type EventNotification } from "@/hooks/use-bbq-data";
import { useQueryClient } from "@tanstack/react-query";
import { useFriends, useFriendRequests, useAllPendingRequests, useAcceptFriendRequest, useRemoveFriend } from "@/hooks/use-friends";
import { UserProfileModal } from "@/components/user-profile-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EventTabs, EventTabsContent, EventTabsList, EventTabsTrigger } from "@/components/event/EventTabs";
import { Modal } from "@/components/ui/modal";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AddPersonDialog } from "@/components/add-person-dialog";
import { AddExpenseDialog } from "@/components/add-expense-dialog";
import { EventHeader } from "@/components/event/EventHeader";
import { SettleUpModal } from "@/components/event/SettleUpModal";
import { QuickAddChips } from "@/components/event/QuickAddChips";
import { EmptyState } from "@/components/event/EmptyState";
import { InviteSheet } from "@/components/event/InviteSheet";
import { InviteLink } from "@/components/events/invite-link";
import { ShareSettlementActions } from "@/components/share/share-settlement-actions";
import { ShareRecapActions } from "@/components/share/share-recap-actions";
import { ConfettiCelebration } from "@/components/basic/ConfettiCelebration";
import { generateSettleCardData, generateRecapCardData } from "@/utils/shareCard";
import { WelcomeModal } from "@/components/welcome-modal";
import { DiscoverModal } from "@/components/discover-modal";
import { SplannoLogo } from "@/components/splanno-logo";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import {
  Receipt, Trash2, Edit2,
  Plus, ArrowRight, CheckCircle2,
  CalendarDays, Loader2,
  UserCheck, UserX, LogOut, Crown, Clock, UserCircle,
  Lock, Globe, UserPlus, X, Eye, EyeOff, Compass,
  Bell, UserPlus2, Search, Heart, Sun, Moon, MessageCircle,
} from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
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
import { getEventTheme } from "@/theme/useEventTheme";
import { EventThemeProvider } from "@/themes/ThemeProvider";
import { SignatureEffect } from "@/themes/SignatureEffect";
import { TRIP_THEME_KEYS, PARTY_THEME_KEYS } from "@/theme/eventThemes";
import { normalizeEvent, getEventArea } from "@/utils/eventUtils";
import type { ExpenseWithParticipant, Barbecue, Participant, FriendInfo, PendingRequestWithBbq } from "@shared/schema";

/** Fallback colors for expense chart. Extended for custom categories (hash-based). */
const CATEGORY_COLORS: Record<string, string> = {
  Meat: '#e05c2a', Bread: '#f0c040', Drinks: '#3b82f6',
  Charcoal: '#64748b', Transportation: '#10b981', Other: '#a855f7',
  Food: '#e05c2a', Transport: '#10b981', Tickets: '#8b5cf6', Accommodation: '#0ea5e9',
  Activities: '#06b6d4', Groceries: '#84cc16', Snacks: '#f59e0b', Supplies: '#6b7280',
  Parking: '#6366f1', Tips: '#ec4899', Entertainment: '#14b8a6',
};

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
  const [forgotEmailSent, setForgotEmailSent] = useState<boolean | null>(null);

  const switchTab = (next: typeof tab) => { setTab(next); setError(""); if (next === "forgot") setForgotEmailSent(null); };

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
      const result = await forgotPassword.mutateAsync({ email }) as { emailSent?: boolean };
      setForgotEmailSent(result?.emailSent !== false);
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

        {/* Sent confirmation */}
        {tab === "sent" && (
          <div className="text-center py-4 space-y-3">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6 text-green-400" />
            </div>
            <p className="text-sm text-muted-foreground">{t.auth.checkEmailDesc}</p>
            {forgotEmailSent === false && (
              <p className="text-sm text-amber-500" data-testid="text-email-not-sent-hint">{t.auth.emailNotSentHint}</p>
            )}
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
  const { user, isLoading: isAuthLoading, logout } = useAuth();
  const username = user?.username ?? null;
  const { toast } = useToast();
  const shouldReduceMotion = useReducedMotion();

  const [area, setArea] = useState<"parties" | "trips">("parties");
  const [selectedBbqId, setSelectedBbqId] = useState<number | null>(null);
  const [isNewBbqOpen, setIsNewBbqOpen] = useState(false);
  const [newBbqName, setNewBbqName] = useState("");
  const [newBbqDate, setNewBbqDate] = useState(new Date().toISOString().split('T')[0]);
  const [newBbqCurrency, setNewBbqCurrency] = useState<CurrencyCode>("EUR");
  const [newBbqIsPublic, setNewBbqIsPublic] = useState(true);
  const [newBbqAllowOptIn, setNewBbqAllowOptIn] = useState(false);
  const [newEventArea, setNewEventArea] = useState<"parties" | "trips">("parties");
  const [newEventType, setNewEventType] = useState<string>("barbecue");

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

  const { data: barbecues = [], isLoading: isLoadingBbqs } = useBarbecues();
  const eventTypeOptions = newEventArea === "trips" ? TRIP_THEME_KEYS : PARTY_THEME_KEYS;
  const isValidEventType = (v: string) =>
    newEventArea === "trips"
      ? (TRIP_THEME_KEYS as readonly string[]).includes(v)
      : (PARTY_THEME_KEYS as readonly string[]).includes(v);
  const barbecuesForArea = useMemo(() => barbecues.filter((b: Barbecue) => getEventArea(b) === area), [barbecues, area]);
  const createBbq = useCreateBarbecue();
  const deleteBbq = useDeleteBarbecue();
  const updateBbq = useUpdateBarbecue();
  const ensureInviteToken = useEnsureInviteToken();
  const settleUp = useSettleUp();

  const selectedBbq = barbecuesForArea.find((b: Barbecue) => b.id === selectedBbqId) ?? (barbecues.find((b: Barbecue) => b.id === selectedBbqId) || null);
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
  const currencyInfo = CURRENCIES.find(c => c.code === currency) || CURRENCIES[0];
  const [displayCurrency, setDisplayCurrency] = useState<CurrencyCode>(currency);
  const displayCurrencyInfo = CURRENCIES.find(c => c.code === displayCurrency) || CURRENCIES[0];
  const isCreator = !!(username && selectedBbq?.creatorId === username);
  const isPrivate = selectedBbq ? !selectedBbq.isPublic : false;

  const { data: participants = [] } = useParticipants(selectedBbqId);
  const { data: expenses = [] } = useExpenses(selectedBbqId);
  const { data: expenseSharesList = [] } = useExpenseShares(selectedBbq?.allowOptInExpenses ? selectedBbqId : null);
  const setExpenseShare = useSetExpenseShare(selectedBbqId);
  const { data: pendingRequests = [] } = usePendingRequests(isCreator ? selectedBbqId : null);
  const { data: invitedParticipants = [] } = useInvitedParticipants(isCreator && isPrivate ? selectedBbqId : null);
  const { data: memberships = [] } = useMemberships(username);

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

  const getCurrencyLabel = (cur: typeof CURRENCIES[0]) => {
    if (language === 'es') return cur.labelEs;
    if (language === 'it') return cur.labelIt;
    if (language === 'nl') return cur.labelNl;
    return cur.label;
  };

  const getMembershipStatus = (bbqId: number): { status: string; participantId: number } | null => {
    const m = memberships.find(m => m.bbqId === bbqId);
    return m ? { status: m.status, participantId: m.participantId } : null;
  };

  const formatMoney = (amount: number) => {
    const converted = convertCurrency(amount, currency, displayCurrency);
    return `${displayCurrencyInfo.symbol}${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const totalSpent = expenses.reduce((sum: number, exp: ExpenseWithParticipant) => sum + Number(exp.amount), 0);
  const participantCount = participants.length;
  const allowOptIn = !!selectedBbq?.allowOptInExpenses;
  const shareSet = new Set(expenseSharesList.map(s => `${s.expenseId}:${s.participantId}`));
  const getParticipantsInExpense = (expenseId: number) => {
    const forExp = expenseSharesList.filter(s => s.expenseId === expenseId);
    if (forExp.length === 0) {
      if (allowOptIn) return [];
      return participants.map((p: Participant) => p.id);
    }
    return forExp.map(s => s.participantId);
  };
  const getFairShareForParticipant = (participantId: number) => {
    if (!allowOptIn || expenseSharesList.length === 0) return participantCount > 0 ? totalSpent / participantCount : 0;
    let sum = 0;
    for (const exp of expenses) {
      const inIds = getParticipantsInExpense(exp.id);
      if (inIds.includes(participantId)) sum += Number(exp.amount) / inIds.length;
    }
    return sum;
  };
  const myParticipant = username ? participants.find((p: Participant) => p.userId === username) : null;
  const fairShare = myParticipant ? getFairShareForParticipant(myParticipant.id) : (participantCount > 0 ? totalSpent / participantCount : 0);

  const canLeave = (p: Participant) => {
    if (p.userId !== username) return false;
    if (!selectedBbq?.date) return false;
    const bbqDate = new Date(selectedBbq.date);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return bbqDate >= today;
  };

  const expensesByCategory = expenses.reduce((acc: Record<string, number>, exp: ExpenseWithParticipant) => {
    acc[exp.category] = (acc[exp.category] || 0) + Number(exp.amount);
    return acc;
  }, {} as Record<string, number>);

  const chartData = (Object.entries(expensesByCategory) as [string, number][]).map(([name, value]) => ({
    name, value, translatedName: t.categories[name as keyof typeof t.categories] || name
  })).filter(d => d.value > 0);

  const calculateSettlements = () => {
    if (participantCount === 0) return { balances: [] as any[], settlements: [] as any[] };
    const balances = participants.map((p: any) => {
      const paid = expenses.filter((e: ExpenseWithParticipant) => e.participantId === p.id).reduce((s: number, e: ExpenseWithParticipant) => s + Number(e.amount), 0);
      const pFairShare = getFairShareForParticipant(p.id);
      return { ...p, paid, balance: paid - pFairShare };
    });
    const debtors = balances.filter((b: any) => b.balance < -0.01).sort((a: any, b: any) => a.balance - b.balance);
    const creditors = balances.filter((b: any) => b.balance > 0.01).sort((a: any, b: any) => b.balance - a.balance);
    const settlements: { from: string; to: string; amount: number }[] = [];
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i], creditor = creditors[j];
      const amount = Math.min(Math.abs(debtor.balance), creditor.balance);
      if (amount > 0.01) settlements.push({ from: debtor.name, to: creditor.name, amount });
      debtor.balance += amount; creditor.balance -= amount;
      if (Math.abs(debtor.balance) < 0.01) i++;
      if (creditor.balance < 0.01) j++;
    }
    return { balances, settlements };
  };

  const { balances, settlements } = calculateSettlements();

  const handleJoin = (bbqId: number) => {
    if (!username) return;
    joinBbq.mutate({ bbqId, name: username, userId: username }, {
      onSuccess: () => toast({ title: t.user.joinBbq, description: `${t.user.pending}...` }),
      onError: (err: any) => {
        const msg = err.message;
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
        onError: (err: any) => {
          const msg = err.message;
          if (msg === "already_joined") toast({ title: t.user.joined });
          else if (msg === "already_pending") toast({ title: t.user.pending });
          else toast({ title: msg, variant: "destructive" });
        },
      }
    );
  };

  const handleCreateBbq = () => {
    if (!newBbqName.trim()) return;
    // Template-specific default data at creation time
    let templateData: unknown | null = null;
    if (newEventType === "barbecue") {
      templateData = defaultBarbecueTemplateData;
    } else if (newEventType === "birthday") {
      templateData = defaultBirthdayTemplateData;
    }
    createBbq.mutate({
      name: newBbqName.trim(),
      date: new Date(newBbqDate).toISOString(),
      currency: newBbqCurrency,
      creatorId: username || undefined,
      isPublic: newBbqIsPublic,
      allowOptInExpenses: newBbqAllowOptIn,
      area: newEventArea,
      eventType: newEventType,
      templateData,
    }, {
      onSuccess: (data: Barbecue) => {
        setSelectedBbqId(data.id);
        setArea(getEventArea(data));
        setNewBbqName(""); setNewBbqDate(new Date().toISOString().split('T')[0]); setNewBbqAllowOptIn(false);
        setNewEventArea("parties"); setNewEventType("barbecue");
        setIsNewBbqOpen(false);
      },
      onError: (err: Error) => {
        toast({ title: t.bbq.create, description: err.message || "Failed to create barbecue", variant: "destructive" });
      },
    });
  };

  const handleDeleteBbq = (id: number) => {
    deleteBbq.mutate(id);
    if (selectedBbqId === id) setSelectedBbqId(null);
  };

  const handleInvite = () => {
    if (!inviteUsername.trim()) return;
    inviteParticipant.mutate(inviteUsername.trim(), {
      onSuccess: () => {
        setInviteUsername("");
        toast({ variant: "success", title: t.bbq.inviteSent });
      },
      onError: (err: any) => {
        const msg = err.message;
        toast({ title: msg === "already_member" ? t.bbq.alreadyMember : msg, variant: "destructive" });
      },
    });
  };

  const canManage = isCreator;
  const isAcceptedMember = !isCreator && !!myParticipant;

  const eventStatus = (selectedBbq?.status as "draft" | "active" | "settling" | "settled") ?? "active";
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
                                {t.settleUp.tapToSettle} {(CURRENCIES.find(c => c.code === (p?.currency ?? "EUR")) || CURRENCIES[0]).symbol}{(p?.amountOwed ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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

                {/* Profile / Friends Button */}
                <Button
                  size="icon"
                  variant="ghost"
                  className="relative"
                  onClick={() => { setViewedProfileUsername(null); setIsProfileOpen(true); }}
                  data-testid="button-profile"
                >
                  <UserCircle className="w-4 h-4" />
                  {friendRequests.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center" data-testid="badge-friend-requests">
                      {friendRequests.length}
                    </span>
                  )}
                </Button>

                <span className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground px-2 py-1.5 rounded-lg bg-white/5">
                  <span className="font-medium max-w-[80px] truncate" data-testid="text-username">{user.username}</span>
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => logout.mutate()}
                  title={t.auth.logout}
                  data-testid="button-logout"
                >
                  <LogOut className="w-4 h-4" />
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

      {/* Parties | Trips top-level nav */}
      <div className="sticky top-[57px] z-40 bg-[hsl(var(--surface-0))]/90 backdrop-blur-md border-b border-[hsl(var(--border-subtle))]" data-testid="section-area-tabs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex rounded-lg border border-white/10 overflow-hidden inline-flex">
            <button
              onClick={() => setArea("parties")}
              className={`px-4 py-2.5 text-sm font-semibold transition-colors ${
                area === "parties" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              }`}
              data-testid="tab-parties"
            >
              {t.nav.parties}
            </button>
            <button
              onClick={() => setArea("trips")}
              className={`px-4 py-2.5 text-sm font-semibold transition-colors ${
                area === "trips" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              }`}
              data-testid="tab-trips"
            >
              {t.nav.trips}
            </button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDiscoverOpen(true)}
            className="border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/5"
            data-testid="button-discover"
          >
            <Compass className="w-4 h-4 mr-1.5" />
            {t.discover.title}
          </Button>
        </div>
      </div>

      {/* Event strip (Parties & Trips) */}
      {(
      <div className="sticky top-[114px] z-30 bg-[hsl(var(--surface-0))]/90 backdrop-blur-md border-b border-[hsl(var(--border-subtle))]" data-testid="section-bbq-selector">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2">
          <div className="overflow-x-auto -mx-1 px-1 pb-1">
            <div className="flex gap-2 items-center min-w-max">
              {isLoadingBbqs ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mx-2" />
              ) : barbecuesForArea.length === 0 ? (
                <span className="text-xs text-muted-foreground px-2 py-1.5 italic">{t.bbq.noBbqs}</span>
              ) : (
                barbecuesForArea.map((bbq: Barbecue) => {
                  const isSelected = bbq.id === selectedBbqId;
                  const cur = CURRENCIES.find(c => c.code === bbq.currency) || CURRENCIES[0];
                  const isBbqCreator = !!(username && bbq.creatorId === username);
                  const membership = getMembershipStatus(bbq.id);
                  const memberStatus = membership?.status || null;
                  const participantId = membership?.participantId;

                  return (
                    <div key={bbq.id} className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => setSelectedBbqId(isSelected ? null : bbq.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary/60 shadow-sm shadow-primary/20'
                            : 'bg-secondary/30 border-white/5 text-muted-foreground hover:border-white/20 hover:text-foreground hover:bg-secondary/50'
                        }`}
                        data-testid={`button-bbq-${bbq.id}`}
                      >
                        {!bbq.isPublic && <Lock className="w-3 h-3 flex-shrink-0 opacity-70" />}
                        {isBbqCreator && <Crown className="w-3 h-3 flex-shrink-0 opacity-80" />}
                        <span className="max-w-[120px] truncate">{bbq.name}</span>
                        <span className="text-[10px] opacity-60 hidden sm:inline">{cur.symbol}</span>
                        {memberStatus === 'pending' && (
                          <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full flex-shrink-0" title={t.user.pending} />
                        )}
                        {memberStatus === 'invited' && (
                          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full flex-shrink-0" title={t.bbq.invited} />
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

                      {/* Creator: delete button */}
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
              {barbecuesForArea.length > 0 && <div className="w-px h-5 bg-white/10 flex-shrink-0 mx-1" />}

              {/* New event button */}
              {user && (
                <button
                  onClick={() => { setNewEventArea(area); setNewEventType(area === "trips" ? "city_trip" : "barbecue"); setIsNewBbqOpen(true); }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-primary hover:bg-primary/10 border border-dashed border-white/10 hover:border-primary/30 transition-all flex-shrink-0"
                  data-testid="button-new-bbq"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t.events.newEvent}
                </button>
              )}
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
                title={selectedBbq?.name ?? ""}
                dateStr={selectedBbq?.date ? new Date(selectedBbq.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : undefined}
                currencySymbol={displayCurrencyInfo.symbol}
                currencyOptions={CURRENCIES.map((c) => ({ value: c.code, label: `${c.symbol} ${getCurrencyLabel(c)}` }))}
                displayCurrency={displayCurrency}
                onCurrencyChange={(v) => setDisplayCurrency(v as CurrencyCode)}
                onAddExpense={() => { setRecommendedExpenseTemplate(null); setEditingExpense(null); setIsAddExpenseOpen(true); }}
                addExpenseLabel={t.addExpense}
                isCreator={isCreator}
                allowOptIn={!!selectedBbq?.allowOptInExpenses}
                onOptInChange={(checked) => selectedBbqId && updateBbq.mutate({ id: selectedBbqId, allowOptInExpenses: checked })}
                optInPending={updateBbq.isPending}
                onDelete={selectedBbqId ? () => handleDeleteBbq(selectedBbqId) : undefined}
                inviteLinkUrl={
                  selectedBbq?.inviteToken
                    ? `${typeof window !== "undefined" ? window.location.origin : ""}/join/${selectedBbq.inviteToken}`
                    : undefined
                }
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
                onSettleUp={isCreator ? () => setSettleUpModalOpen(true) : undefined}
                settleUpPending={settleUp.isPending}
                />
              </div>

              {/* Participant settling banner: show when status=settling and current user owes */}
              {eventStatus === "settling" && !isCreator && myParticipant && (() => {
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
                        {t.settleUp.tapToSettle} {formatMoney(amountOwed)}. Tap to settle up.
                      </p>
                    </div>
                  </button>
                );
              })()}

              {/* Inline stats row */}
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <p className="text-xs text-muted-foreground">
                  {formatMoney(totalSpent)} spent · {participantCount} {participantCount === 1 ? "person" : "people"} · {expenses.length} expense{expenses.length !== 1 ? "s" : ""}
                  {!allowOptIn && ` · ${formatMoney(fairShare)} ${t.fairShare.toLowerCase()}`}
                </p>
                {showUpdatedAfterBadge && (
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 font-medium" data-testid="badge-updated-after">
                    {t.settleUp.updatedAfterSummary}
                  </span>
                )}
              </div>

              {/* Completion banner when event is settled */}
              {eventStatus === "settled" && (
                <div className="mt-4 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-2.5 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                  <p className="text-sm font-medium text-foreground">{t.split.allSettledStillFriends}</p>
                </div>
              )}

              {/* Creator: Mark as settled when all balances zero */}
              {isCreator && eventStatus === "settling" && allBalancesZero && (
                <div className="mt-4 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">{t.settleUp.everyonePaid}</p>
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
            {eventTemplate.key === "barbecue" && (
              <div className="mt-4 rounded-[var(--radius-lg)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-4 space-y-3 shadow-[var(--shadow-sm)]">
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

            {eventTemplate.key === "birthday" && (
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
                      No gift contributions yet. Add expenses to start tracking.
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* Row C: Tabs */}
            <div className="mt-4">
            <EventTabs value={activeEventTab} onValueChange={setActiveEventTab}>
              <EventTabsList>
                <EventTabsTrigger value="expenses" data-testid="tab-expenses">{t.tabs.expenses}</EventTabsTrigger>
                <EventTabsTrigger value="people" data-testid="tab-people">{t.tabs.people}</EventTabsTrigger>
                <EventTabsTrigger value="split" data-testid="tab-split">{t.tabs.split}</EventTabsTrigger>
                <EventTabsTrigger value="notes" data-testid="tab-notes">{t.tabs.notes}</EventTabsTrigger>
                <EventTabsTrigger value="chat" data-testid="tab-chat">{t.tabs.chat}</EventTabsTrigger>
              </EventTabsList>

              {/* People Tab */}
              <EventTabsContent value="people" className="space-y-4">
                {(canManage || isCreator) && (
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
                    {canManage && (
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
                        onInviteFriend={(username) => inviteParticipant.mutate(username)}
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
                        className="inline-flex items-center gap-2 border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-2))]/50 rounded-[var(--radius-md)] px-2.5 py-1 text-sm"
                        data-testid={`chip-participant-${p.id}`}
                      >
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
              <EventTabsContent value="expenses" className="space-y-3">
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
                {expenses.length === 0 ? (
                  (() => {
                    const { category: eventCategory, type: eventType } = normalizeEvent(selectedBbq ?? {});
                    const theme = getEventTheme(eventCategory, eventType);
                    return (
                      <EmptyState
                        icon={theme.icon}
                        title={theme.copy.emptyExpensesTitle}
                        description={theme.copy.emptyExpensesBody}
                        iconClassName={theme.accent.bg}
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
                  <div className="space-y-2">
                    {expenses.map((exp: ExpenseWithParticipant) => {
                      const IconComp = getCategoryDef(exp.category).icon;
                      const color = getCategoryColor(exp.category);
                      const everyoneInByDefault = expenseSharesList.length === 0;
                      const isInForExp = myParticipant
                        ? (everyoneInByDefault ? true : shareSet.has(`${exp.id}:${myParticipant.id}`))
                        : false;
                      return (
                        <div
                          key={exp.id}
                          className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] px-3 py-2.5 group shadow-[var(--shadow-sm)]"
                          data-testid={`expense-item-${exp.id}`}
                        >
                          <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 bg-muted/40 dark:bg-muted/30">
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
                                  className="hover:text-primary hover:underline"
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
                      );
                    })}
                  </div>
                )}

                {/* Category Chart */}
                {chartData.length > 0 && (
                  <div className="rounded-[var(--radius-lg)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-4 shadow-[var(--shadow-sm)]">
                    <h3 className="text-sm font-semibold text-muted-foreground mb-4">{t.bbq.breakdown}</h3>
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
              </EventTabsContent>

              {/* Split Tab */}
              <EventTabsContent value="split" className="space-y-4">
                {/* Individual Contributions */}
                  <div className="rounded-[var(--radius-lg)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-4 shadow-[var(--shadow-sm)]">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-4">{t.split.contributions}</h3>
                  {balances.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-4">{t.emptyState.title}</p>
                  ) : (
                    <div className="space-y-3">
                      {balances.map((b: any) => {
                        const isOver = b.balance > 0.01;
                        const isUnder = b.balance < -0.01;
                        return (
                          <div key={b.id} className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span className="font-medium">{b.name}</span>
                                <span className="text-primary font-semibold">{formatMoney(b.paid)}</span>
                              </div>
                              <div className="h-1.5 bg-muted/40 dark:bg-muted/30 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-primary transition-all"
                                  style={{ width: totalSpent > 0 ? `${Math.min(100, (b.paid / totalSpent) * 100)}%` : '0%' }}
                                />
                              </div>
                            </div>
                            <div className={`text-xs font-semibold px-2 py-0.5 rounded flex-shrink-0 ${
                              isOver ? 'bg-green-500/15 text-green-600 dark:text-green-400' :
                              isUnder ? 'bg-red-500/15 text-red-600 dark:text-red-400' :
                              'bg-muted/30 text-muted-foreground'
                            }`}>
                              {isOver ? `+${formatMoney(b.balance)}` : isUnder ? formatMoney(b.balance) : '✓'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

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
                      funStat: biggestSpender?.paid
                        ? { type: "biggest_spender" as const, label: "Biggest spender", value: `${biggestSpender.name} (${formatMoney(biggestSpender.paid)})` }
                        : undefined,
                    }
                  );
                  return (
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs text-muted-foreground">Share event recap</span>
                      <ShareRecapActions
                        data={recapData}
                        theme={eventTheme}
                        shareImageLabel={t.split.shareImage}
                        copyImageLabel={t.split.copyImage}
                        downloadLabel={t.split.download}
                        onCopySuccess={() => toast({ title: t.bbq.copySuccess })}
                      />
                    </div>
                  );
                })()}

                {/* Settlement Plan */}
                  <div className="rounded-[var(--radius-lg)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-4 shadow-[var(--shadow-sm)]">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-4">{t.split.settlement}</h3>
                  {settlements.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-400 opacity-70" />
                      <p className="text-sm">{t.split.allSettled}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {settlements.map((s, i) => {
                        const { category, type } = normalizeEvent(selectedBbq ?? {});
                        const eventTheme = getEventTheme(category, type);
                        const subtitle = (t.eventTypes as Record<string, string>)[eventTheme.labelKey] ?? eventTheme.copy.tagline;
                        const settleCardData = generateSettleCardData(
                          {
                            name: selectedBbq?.name ?? "",
                            subtitle,
                            currency: selectedBbq?.currency ?? "EUR",
                          },
                          s,
                          subtitle
                        );
                        return (
                          <div key={i} className="flex flex-col gap-2 border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-2))]/50 rounded-[var(--radius-md)] px-3 py-2.5" data-testid={`settlement-${i}`}>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                                <ArrowRight className="w-4 h-4 text-red-400" />
                              </div>
                              <div className="flex-1 text-sm">
                                <span className="font-bold text-red-400">{s.from}</span>
                                <span className="text-muted-foreground mx-2">{t.split.owes}</span>
                                <span className="font-bold text-green-400">{s.to}</span>
                              </div>
                              <span className="font-bold text-primary flex-shrink-0">{formatMoney(s.amount)}</span>
                            </div>
                            <ShareSettlementActions
                              data={settleCardData}
                              theme={eventTheme}
                              shareImageLabel={t.split.shareImage}
                              copyImageLabel={t.split.copyImage}
                              downloadLabel={t.split.download}
                              onCopySuccess={() => toast({ title: t.bbq.copySuccess })}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </EventTabsContent>

              {/* Notes Tab — placeholder */}
              <EventTabsContent value="notes">
                <div className="rounded-[var(--radius-lg)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-6 text-center text-muted-foreground shadow-[var(--shadow-sm)]">
                  <p className="text-sm">{t.tabs.notes} — coming soon.</p>
                  <p className="text-xs mt-1">Add notes, reminders, or shared info for your event.</p>
                </div>
              </EventTabsContent>

              {/* Chat Tab — placeholder */}
              <EventTabsContent value="chat">
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
              </EventTabsContent>
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

      {/* Create event dialog */}
      <Modal
        open={isNewBbqOpen}
        onClose={() => { setIsNewBbqOpen(false); setNewEventArea(area); setNewEventType(area === "trips" ? "city_trip" : "barbecue"); }}
        onOpenChange={(open) => { setIsNewBbqOpen(open); if (!open) { setNewEventArea(area); setNewEventType(area === "trips" ? "city_trip" : "barbecue"); } }}
        title={t.events.newEvent}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsNewBbqOpen(false)}>{t.modals.cancel}</Button>
            <Button
              onClick={handleCreateBbq}
              disabled={!newBbqName.trim() || createBbq.isPending}
              className="bg-primary text-primary-foreground font-bold"
              data-testid="button-create-bbq"
            >
              {createBbq.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t.bbq.create}
            </Button>
          </>
        }
        data-testid="dialog-new-bbq"
      >
        <p className="text-sm text-muted-foreground mb-4">{t.subtitle}</p>
        <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t.nav.parties} / {t.nav.trips}</Label>
              <div className="flex rounded-lg border border-white/10 overflow-hidden">
                <button
                  type="button"
                  onClick={() => { setNewEventArea("parties"); setNewEventType("barbecue"); }}
                  className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${newEventArea === "parties" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-white/5"}`}
                >
                  {t.nav.parties}
                </button>
                <button
                  type="button"
                  onClick={() => { setNewEventArea("trips"); setNewEventType("city_trip"); }}
                  className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${newEventArea === "trips" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-white/5"}`}
                >
                  {t.nav.trips}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Event type</Label>
              <Select
                value={isValidEventType(newEventType) ? newEventType : (eventTypeOptions[0] ?? "barbecue")}
                onValueChange={setNewEventType}
              >
                <SelectTrigger data-testid="select-event-type">
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
                <div className="mt-2 rounded-lg border border-accent/20 bg-accent/5 px-3 py-2 flex items-center gap-2">
                  <span className="text-lg" aria-hidden>{getEventTheme(newEventArea === "trips" ? "trip" : "party", newEventType).icon}</span>
                  <p className="text-xs text-muted-foreground">{getEventTheme(newEventArea === "trips" ? "trip" : "party", newEventType).copy.tagline}</p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t.bbq.bbqName}</Label>
              <Input
                placeholder={t.events.event}
                value={newBbqName}
                onChange={e => setNewBbqName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleCreateBbq()}
                autoFocus
                data-testid="input-bbq-name"
              />
            </div>
            <div className="space-y-2">
              <Label>{t.bbq.date}</Label>
              <Input
                type="date"
                value={newBbqDate}
                onChange={e => setNewBbqDate(e.target.value)}
                data-testid="input-bbq-date"
              />
            </div>
            <div className="space-y-2">
              <Label>{t.bbq.currency}</Label>
              <Select value={newBbqCurrency} onValueChange={v => setNewBbqCurrency(v as CurrencyCode)}>
                <SelectTrigger data-testid="select-bbq-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(cur => (
                    <SelectItem key={cur.code} value={cur.code}>
                      {cur.symbol} — {getCurrencyLabel(cur)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t.bbq.visibility}</Label>
              <div className="flex rounded-lg border border-white/10 overflow-hidden">
                <button
                  onClick={() => setNewBbqIsPublic(true)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors ${
                    newBbqIsPublic ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-white/5'
                  }`}
                  data-testid="button-visibility-public"
                >
                  <Globe className="w-4 h-4" /> {t.bbq.publicEvent}
                </button>
                <button
                  onClick={() => setNewBbqIsPublic(false)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors ${
                    newBbqIsPublic ? 'text-muted-foreground hover:bg-white/5' : 'bg-primary text-primary-foreground'
                  }`}
                  data-testid="button-visibility-private"
                >
                  <Lock className="w-4 h-4" /> {t.bbq.privateEvent}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">{newBbqIsPublic ? t.bbq.publicDesc : t.bbq.privateDesc}</p>
            </div>
            {newEventType === "barbecue" && (
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="new-bbq-opt-in"
                checked={newBbqAllowOptIn}
                onChange={e => setNewBbqAllowOptIn(e.target.checked)}
                className="mt-1 rounded border-white/20"
                data-testid="checkbox-allow-opt-in-expenses"
              />
              <div>
                <Label htmlFor="new-bbq-opt-in" className="text-sm font-medium cursor-pointer">{t.bbq.allowOptInExpenses}</Label>
                <p className="text-xs text-muted-foreground mt-0.5">{t.bbq.allowOptInExpensesDesc}</p>
              </div>
            </div>
            )}
          </div>
      </Modal>

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
      />

      {showSettledConfetti && (
        <ConfettiCelebration onComplete={() => setShowSettledConfetti(false)} />
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
