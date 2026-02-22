import { useState, useEffect, useRef, useMemo } from "react";
import { useLanguage, CURRENCIES, LANGUAGES, type CurrencyCode, convertCurrency } from "@/hooks/use-language";
import { useAuth } from "@/hooks/use-auth";
import {
  useParticipants, useCreateParticipant, useDeleteParticipant, useUpdateParticipantName,
  usePendingRequests, useMemberships, useJoinBarbecue,
  useAcceptParticipant, useRejectParticipant,
  useInvitedParticipants, useInviteParticipant,
  useAcceptInvite, useDeclineInvite,
} from "@/hooks/use-participants";
import { useExpenses, useDeleteExpense, useExpenseShares, useSetExpenseShare } from "@/hooks/use-expenses";
import { useBarbecues, useCreateBarbecue, useDeleteBarbecue, useUpdateBarbecue } from "@/hooks/use-bbq-data";
import { useQueryClient } from "@tanstack/react-query";
import { useFriends, useFriendRequests, useAllPendingRequests, useAcceptFriendRequest, useRemoveFriend } from "@/hooks/use-friends";
import { ProfileDialog } from "@/components/profile-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { DraggableDialogContent } from "@/components/ui/draggable-dialog-content";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AddPersonDialog } from "@/components/add-person-dialog";
import { AddExpenseDialog } from "@/components/add-expense-dialog";
import { WelcomeModal } from "@/components/welcome-modal";
import { DiscoverModal } from "@/components/discover-modal";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import {
  Users, Receipt, Wallet, Trash2, Edit2,
  Flame, Plus, ArrowRight, CheckCircle2,
  CalendarDays, Loader2,
  Beef, Wheat, Beer, Zap, Car, Package,
  UserCheck, UserX, LogOut, Crown, Clock, UserCircle,
  Lock, Globe, UserPlus, X, Eye, EyeOff, ChevronDown, ChevronUp, Compass,
  Bell, UserPlus2, Search, Heart,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import type { ExpenseWithParticipant, Barbecue, Participant, FriendInfo, PendingRequestWithBbq } from "@shared/schema";

const CATEGORY_COLORS: Record<string, string> = {
  Meat: '#e05c2a', Bread: '#f0c040', Drinks: '#3b82f6',
  Charcoal: '#64748b', Transportation: '#10b981', Other: '#a855f7',
  Food: '#e05c2a', Transport: '#10b981', Tickets: '#8b5cf6', Accommodation: '#0ea5e9',
};
const CATEGORY_ICON_COMPONENTS: Record<string, typeof Beef> = {
  Meat: Beef, Bread: Wheat, Drinks: Beer, Charcoal: Zap, Transportation: Car, Other: Package,
  Food: Beef, Transport: Car, Tickets: Receipt, Accommodation: Package,
};

const CATEGORIES_BY_EVENT_TYPE: Record<string, string[]> = {
  barbecue: ["Meat", "Bread", "Drinks", "Charcoal", "Transportation", "Other"],
  dinner_party: ["Food", "Drinks", "Transport", "Tickets", "Other"],
  birthday: ["Food", "Drinks", "Transport", "Tickets", "Other"],
  other_party: ["Food", "Drinks", "Transport", "Tickets", "Other"],
  city_trip: ["Transport", "Tickets", "Food", "Accommodation", "Other"],
  cinema: ["Tickets", "Food", "Drinks", "Other"],
  theme_park: ["Tickets", "Food", "Drinks", "Transport", "Other"],
  day_out: ["Food", "Drinks", "Transport", "Tickets", "Other"],
  other_trip: ["Food", "Drinks", "Transport", "Tickets", "Other"],
};

function getCategoriesForEventType(eventType: string | undefined): string[] {
  if (!eventType) return ["Meat", "Bread", "Drinks", "Charcoal", "Transportation", "Other"];
  return CATEGORIES_BY_EVENT_TYPE[eventType] ?? ["Food", "Drinks", "Transport", "Tickets", "Other"];
}

const EVENT_TYPE_I18N_KEYS: Record<string, string> = {
  barbecue: "barbecue", dinner_party: "dinnerParty", birthday: "birthday", other_party: "otherParty",
  city_trip: "cityTrip", cinema: "cinema", theme_park: "themePark", day_out: "dayOut", other_trip: "otherTrip",
};

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DraggableDialogContent className="sm:max-w-sm" data-testid="dialog-auth">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="bg-gradient-to-br from-primary to-accent p-1.5 rounded-lg">
              <Receipt className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-display text-primary font-bold text-lg truncate">{t.title}</h1>
          </div>
          <DialogTitle className="text-base">{isCheckingAuth ? t.auth.loginTitle : titles[tab]}</DialogTitle>
          <DialogDescription>{isCheckingAuth ? t.auth.welcomeBack : subtitles[tab]}</DialogDescription>
        </DialogHeader>

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
      </DraggableDialogContent>
    </Dialog>
  );
}

// ─── Currency Conversion Bar ──────────────────────────────────────────────────
function CurrencyBar({ total, fairShare, bbqCurrency, currenciesToShow }: { total: number; fairShare: number; bbqCurrency: CurrencyCode; currenciesToShow: typeof CURRENCIES }) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(() => {
    try { return localStorage.getItem('currencyBarExpanded') !== 'false'; } catch { return true; }
  });
  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    try { localStorage.setItem('currencyBarExpanded', String(next)); } catch {}
  };
  return (
    <div className="bg-card/60 border border-white/5 rounded-2xl p-4">
      <button
        onClick={toggle}
        className="flex items-center justify-between w-full cursor-pointer group"
        data-testid="button-toggle-currency"
      >
        <h3 className="text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">{t.bbq.currencyConversion}</h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground bg-secondary/40 px-2 py-0.5 rounded-full">{t.bbq.approxRates}</span>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }} className="overflow-hidden"
          >
            <div className="overflow-x-auto -mx-1 px-1 pb-1 mt-3">
              <div className="flex gap-2.5 min-w-max">
                {currenciesToShow.map(cur => {
                  const convTotal = convertCurrency(total, bbqCurrency, cur.code);
                  const convShare = convertCurrency(fairShare, bbqCurrency, cur.code);
                  const isNative = cur.code === bbqCurrency;
                  return (
                    <div
                      key={cur.code}
                      className={`flex-shrink-0 rounded-xl border px-3 py-2.5 min-w-[130px] transition-colors ${
                        isNative ? 'border-primary/40 bg-primary/8' : 'border-white/5 bg-secondary/20'
                      }`}
                      data-testid={`currency-card-${cur.code}`}
                    >
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-xs font-bold text-foreground">{cur.symbol}</span>
                        <span className={`text-xs font-semibold ${isNative ? 'text-primary' : 'text-muted-foreground'}`}>{cur.code}</span>
                        {isNative && <span className="text-[9px] bg-primary/20 text-primary px-1 rounded font-bold">native</span>}
                      </div>
                      <div className="space-y-1">
                        <div>
                          <div className="text-[9px] text-muted-foreground uppercase tracking-wide">{t.totalSpent}</div>
                          <div className="text-sm font-bold">{cur.symbol}{convTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-muted-foreground uppercase tracking-wide">{t.bbq.yourShare}</div>
                          <div className="text-sm font-semibold text-primary">{cur.symbol}{convShare.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  const colors: Record<string, string> = {
    gold: 'from-primary/20 to-primary/5 border-primary/20 text-primary',
    blue: 'from-blue-500/20 to-blue-500/5 border-blue-500/20 text-blue-400',
    orange: 'from-accent/20 to-accent/5 border-accent/20 text-accent',
    green: 'from-green-500/20 to-green-500/5 border-green-500/20 text-green-400',
  };
  return (
    <div className={`bg-gradient-to-br ${colors[color] || colors.gold} border rounded-2xl p-4 sm:p-5`}>
      <div className="flex items-center gap-2 mb-2 text-current opacity-70">
        <span className="w-4 h-4">{icon}</span>
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-bold font-display">{value}</div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Home() {
  const { language, setLanguage, t } = useLanguage();
  const { user, isLoading: isAuthLoading, logout } = useAuth();
  const username = user?.username ?? null;
  const { toast } = useToast();

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
  const [editingExpense, setEditingExpense] = useState<ExpenseWithParticipant | null>(null);
  const [editingParticipantId, setEditingParticipantId] = useState<number | null>(null);
  const [editingParticipantName, setEditingParticipantName] = useState("");
  const [inviteUsername, setInviteUsername] = useState("");

  const { data: friends = [] } = useFriends();
  const { data: friendRequests = [] } = useFriendRequests();
  const { data: allPendingRequests = [] } = useAllPendingRequests();
  const acceptFriendReq = useAcceptFriendRequest();
  const removeFriendMut = useRemoveFriend();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(true);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const prevPendingCountRef = useRef(allPendingRequests.length);
  const queryClient = useQueryClient();

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
  const partiesEventTypes = ["barbecue", "dinner_party", "birthday", "other_party"] as const;
  const tripsEventTypes = ["city_trip", "cinema", "theme_park", "day_out", "other_trip"] as const;
  const barbecuesForArea = useMemo(() => barbecues.filter((b: Barbecue) => ((b as any).area ?? "parties") === area), [barbecues, area]);
  const createBbq = useCreateBarbecue();
  const deleteBbq = useDeleteBarbecue();
  const updateBbq = useUpdateBarbecue();

  const selectedBbq = barbecuesForArea.find((b: Barbecue) => b.id === selectedBbqId) ?? (barbecues.find((b: Barbecue) => b.id === selectedBbqId) || null);
  const currency = (selectedBbq?.currency as CurrencyCode) || "EUR";
  const currencyInfo = CURRENCIES.find(c => c.code === currency) || CURRENCIES[0];
  const currenciesToShow = user?.preferredCurrencyCodes?.length ? CURRENCIES.filter(c => user!.preferredCurrencyCodes!.includes(c.code)) : CURRENCIES;
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

  const formatMoney = (amount: number) => `${currencyInfo.symbol}${amount.toFixed(2)}`;

  const totalSpent = expenses.reduce((sum: number, exp: ExpenseWithParticipant) => sum + Number(exp.amount), 0);
  const participantCount = participants.length;
  const allowOptIn = !!selectedBbq?.allowOptInExpenses;
  const shareSet = new Set(expenseSharesList.map(s => `${s.expenseId}:${s.participantId}`));
  const getParticipantsInExpense = (expenseId: number) => {
    const forExp = expenseSharesList.filter(s => s.expenseId === expenseId);
    if (forExp.length === 0) return participants.map((p: Participant) => p.id);
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
          setArea((bbq as Barbecue & { area?: string }).area === "trips" ? "trips" : "parties");
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
    createBbq.mutate({
      name: newBbqName.trim(),
      date: new Date(newBbqDate).toISOString(),
      currency: newBbqCurrency,
      creatorId: username || undefined,
      isPublic: newBbqIsPublic,
      allowOptInExpenses: newBbqAllowOptIn,
      area: newEventArea,
      eventType: newEventType,
    }, {
      onSuccess: (data: Barbecue) => {
        setSelectedBbqId(data.id);
        setArea((data as any).area === "trips" ? "trips" : "parties");
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
        toast({ title: t.bbq.inviteSent });
      },
      onError: (err: any) => {
        const msg = err.message;
        toast({ title: msg === "already_member" ? t.bbq.alreadyMember : msg, variant: "destructive" });
      },
    });
  };

  const canManage = isCreator;
  const isAcceptedMember = !isCreator && !!myParticipant;

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
          setArea((bbq as Barbecue & { area?: string }).area === "trips" ? "trips" : "parties");
          setDiscoverOpen(false);
        }}
        onJoin={handleDiscoverJoin}
      />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-white/5" data-testid="header">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="bg-gradient-to-br from-primary to-accent p-1.5 sm:p-2 rounded-lg shadow-lg shadow-orange-500/20 flex-shrink-0">
              <Receipt className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl md:text-2xl font-bold font-display text-primary tracking-tight truncate" data-testid="text-app-title">
                {t.title}
              </h1>
              <p className="hidden md:block text-xs text-muted-foreground uppercase tracking-widest font-medium">
                {t.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {/* Language Tabs */}
            <div className="flex rounded-lg border border-white/10 overflow-hidden" data-testid="language-tabs">
              {LANGUAGES.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => setLanguage(lang.code)}
                  className={`px-2.5 py-1.5 text-xs font-bold transition-colors ${
                    language === lang.code
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
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
                      {allPendingRequests.length > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center" data-testid="badge-notifications">
                          {allPendingRequests.length}
                        </span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-72 p-3 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t.user.pendingRequests}</p>
                    {allPendingRequests.length === 0 ? (
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
                  onClick={() => setIsProfileOpen(true)}
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

            {selectedBbqId && user && (
              <>
                {canManage && (
                  <Button
                    size="sm"
                    onClick={() => setIsAddPersonOpen(true)}
                    className="bg-primary text-primary-foreground font-bold px-2 sm:px-3 text-xs sm:text-sm"
                    data-testid="button-add-person"
                  >
                    <Plus className="w-3.5 h-3.5 sm:mr-1" />
                    <span className="hidden sm:inline">{t.addPerson}</span>
                  </Button>
                )}
                {(isCreator || isAcceptedMember) && (
                  <Button
                    size="sm"
                    onClick={() => setIsAddExpenseOpen(true)}
                    className="bg-accent text-accent-foreground font-bold px-2 sm:px-3 text-xs sm:text-sm"
                    data-testid="button-add-expense"
                  >
                    <Plus className="w-3.5 h-3.5 sm:mr-1" />
                    <span className="hidden sm:inline">{t.addExpense}</span>
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      {/* Parties | Trips top-level nav */}
      <div className="sticky top-[57px] z-40 bg-background/90 backdrop-blur-md border-b border-white/5" data-testid="section-area-tabs">
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

      {/* Event strip (Parties only) */}
      {area === "parties" && (
      <div className="sticky top-[114px] z-30 bg-background/90 backdrop-blur-md border-b border-white/5" data-testid="section-bbq-selector">
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
        {area === "trips" ? (
          <div className="text-center py-16 text-muted-foreground" data-testid="section-trips-coming-soon">
            <Receipt className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium mb-4">{t.tripsComingSoon}</p>
            {user && (
              <Button variant="outline" onClick={() => { setNewEventArea("trips"); setNewEventType("city_trip"); setIsNewBbqOpen(true); }} data-testid="button-new-event-trips">
                {t.events.newEvent}
              </Button>
            )}
          </div>
        ) : (
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
                <div key={p.id} className="flex items-center gap-2 bg-secondary/40 border border-white/10 rounded-xl px-3 py-2" data-testid={`pending-request-${p.id}`}>
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

        {/* Invite Panel (private BBQ creator only) */}
        {isCreator && isPrivate && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4 sm:p-6"
            data-testid="section-invite-panel"
          >
            <h3 className="text-base font-bold font-display text-blue-400 flex items-center gap-2 mb-4">
              <UserPlus className="w-5 h-5" />
              {t.bbq.inviteUser}
            </h3>
            <div className="flex gap-2 mb-4">
              <Input
                placeholder={t.bbq.inviteUsernamePlaceholder}
                value={inviteUsername}
                onChange={e => setInviteUsername(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleInvite()}
                className="max-w-xs"
                data-testid="input-invite-username"
              />
              <Button
                onClick={handleInvite}
                disabled={inviteParticipant.isPending || !inviteUsername.trim()}
                className="bg-blue-500 hover:bg-blue-600 text-white font-semibold"
                data-testid="button-send-invite"
              >
                {inviteParticipant.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t.bbq.invite}
              </Button>
            </div>
            {friends.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Heart className="w-3 h-3" />
                  {t.friends.inviteFromFriends}
                </p>
                <div className="flex flex-wrap gap-2">
                  {friends.map((f: FriendInfo) => {
                    const alreadyInvited = invitedParticipants.some((p: Participant) => p.userId === f.username) ||
                      participants.some((p: Participant) => p.userId === f.username);
                    return (
                      <div key={f.friendshipId} className="flex items-center gap-2 bg-secondary/20 border border-white/5 rounded-lg px-2.5 py-1.5" data-testid={`friend-invite-${f.friendshipId}`}>
                        <UserCircle className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-sm font-medium">{f.displayName || f.username}</span>
                        {alreadyInvited ? (
                          <span className="text-[10px] text-muted-foreground">{t.bbq.invited}</span>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => inviteParticipant.mutate(f.username)}
                            disabled={inviteParticipant.isPending}
                            data-testid={`button-invite-friend-${f.friendshipId}`}
                          >
                            <UserPlus2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {invitedParticipants.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">{t.bbq.pendingInvites}:</p>
                <div className="flex flex-wrap gap-2">
                  {invitedParticipants.map((p: Participant) => (
                    <div key={p.id} className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-lg px-2.5 py-1.5" data-testid={`invited-${p.id}`}>
                      <span className="text-sm font-medium">{p.name}</span>
                      <span className="text-xs text-blue-400">{t.bbq.invited}</span>
                      <button
                        onClick={() => rejectParticipant.mutate(p.id)}
                        className="text-muted-foreground hover:text-destructive ml-0.5"
                        title="Remove"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Main Content */}
        {selectedBbqId ? (
          <>
            {/* Creator: Opt-in expenses toggle */}
            {isCreator && selectedBbqId && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/20 border border-white/5">
                <input
                  type="checkbox"
                  id="bbq-opt-in-toggle"
                  checked={!!selectedBbq?.allowOptInExpenses}
                  onChange={e => updateBbq.mutate({ id: selectedBbqId, allowOptInExpenses: e.target.checked })}
                  disabled={updateBbq.isPending}
                  className="rounded border-white/20"
                  data-testid="checkbox-bbq-allow-opt-in"
                />
                <label htmlFor="bbq-opt-in-toggle" className="text-sm cursor-pointer flex-1">
                  {t.bbq.allowOptInExpenses}
                </label>
                {updateBbq.isPending && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <StatCard label={t.totalSpent} value={formatMoney(totalSpent)} icon={<Wallet />} color="gold" />
              <StatCard label={t.participants} value={participantCount} icon={<Users />} color="blue" />
              <StatCard label={t.expenses} value={expenses.length} icon={<Receipt />} color="orange" />
              <StatCard label={t.fairShare} value={formatMoney(fairShare)} icon={<Wallet />} color="green" />
            </div>

            {/* Currency Conversion Bar */}
            {totalSpent > 0 && (
              <CurrencyBar total={totalSpent} fairShare={fairShare} bbqCurrency={currency} currenciesToShow={currenciesToShow} />
            )}

            {/* Participant Chips */}
            {participants.length > 0 && (
              <div className="bg-card/80 border border-white/5 rounded-2xl p-4 sm:p-6">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  {t.participants}
                </h3>
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
                        className="inline-flex items-center gap-2 bg-secondary/40 border border-white/10 rounded-xl px-3 py-1.5 text-sm"
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
                            <span className="font-medium">{p.name}</span>
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
              </div>
            )}

            {/* Tabs */}
            <Tabs defaultValue="expenses">
              <TabsList className="w-full bg-secondary/30 border border-white/5">
                <TabsTrigger value="expenses" className="flex-1 data-testid" data-testid="tab-expenses">{t.tabs.expenses}</TabsTrigger>
                <TabsTrigger value="split" className="flex-1" data-testid="tab-split">{t.tabs.split}</TabsTrigger>
              </TabsList>

              {/* Expenses Tab */}
              <TabsContent value="expenses" className="mt-4 space-y-4">
                {/* Add Expense button — visible for creator + accepted members */}
                {(isCreator || isAcceptedMember) && (
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => setIsAddExpenseOpen(true)}
                      className="bg-accent text-accent-foreground font-bold"
                      data-testid="button-add-expense-tab"
                    >
                      <Plus className="w-4 h-4 mr-1.5" /> {t.addExpense}
                    </Button>
                  </div>
                )}
                {expenses.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Receipt className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">{t.emptyState.title}</p>
                    <p className="text-sm mt-1">{t.emptyState.subtitle}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {expenses.map((exp: ExpenseWithParticipant) => {
                      const IconComp = CATEGORY_ICON_COMPONENTS[exp.category] || Package;
                      const color = CATEGORY_COLORS[exp.category] || '#888';
                      const everyoneInByDefault = expenseSharesList.length === 0;
                      const isInForExp = myParticipant
                        ? (everyoneInByDefault ? true : shareSet.has(`${exp.id}:${myParticipant.id}`))
                        : false;
                      return (
                        <div
                          key={exp.id}
                          className="flex items-center gap-3 bg-secondary/20 border border-white/5 rounded-xl px-4 py-3 group"
                          data-testid={`expense-item-${exp.id}`}
                        >
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}20` }}>
                            <IconComp className="w-4 h-4" style={{ color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{exp.item}</div>
                            <div className="text-xs text-muted-foreground">
                              {t.categories[exp.category as keyof typeof t.categories] || exp.category} · {exp.participantName}
                            </div>
                          </div>
                          {allowOptIn && myParticipant && (
                            <button
                              onClick={() => setExpenseShare.mutate({ expenseId: exp.id, in: !isInForExp })}
                              disabled={setExpenseShare.isPending}
                              className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                                isInForExp ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-secondary/40 text-muted-foreground border-white/10 hover:border-white/20'
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
                  <div className="bg-card/60 border border-white/5 rounded-2xl p-4">
                    <h3 className="text-sm font-semibold text-muted-foreground mb-4">{t.bbq.breakdown}</h3>
                    <div className="flex items-center gap-4 flex-wrap">
                      <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                          <Pie data={chartData} dataKey="value" cx="50%" cy="50%" outerRadius={65} innerRadius={40}>
                            {chartData.map((entry) => (
                              <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] || '#888'} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number | string) => [`${currencyInfo.symbol}${Number(value).toFixed(2)}`, '']}
                            contentStyle={{ background: 'hsl(var(--card))', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-1.5 flex-1 min-w-[120px]">
                        {chartData.map(d => (
                          <div key={d.name} className="flex items-center gap-2 text-xs">
                            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: CATEGORY_COLORS[d.name] }} />
                            <span className="text-muted-foreground flex-1">{d.translatedName}</span>
                            <span className="font-semibold">{currencyInfo.symbol}{d.value.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Split Tab */}
              <TabsContent value="split" className="mt-4 space-y-4">
                {/* Individual Contributions */}
                <div className="bg-card/60 border border-white/5 rounded-2xl p-4">
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
                              <div className="h-1.5 bg-secondary/40 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-primary transition-all"
                                  style={{ width: totalSpent > 0 ? `${Math.min(100, (b.paid / totalSpent) * 100)}%` : '0%' }}
                                />
                              </div>
                            </div>
                            <div className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                              isOver ? 'bg-green-500/20 text-green-400' :
                              isUnder ? 'bg-red-500/20 text-red-400' :
                              'bg-secondary/40 text-muted-foreground'
                            }`}>
                              {isOver ? `+${formatMoney(b.balance)}` : isUnder ? formatMoney(b.balance) : '✓'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Settlement Plan */}
                <div className="bg-card/60 border border-white/5 rounded-2xl p-4">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-4">{t.split.settlement}</h3>
                  {settlements.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-400 opacity-70" />
                      <p className="text-sm">{t.split.allSettled}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {settlements.map((s, i) => (
                        <div key={i} className="flex items-center gap-3 bg-secondary/20 rounded-xl px-4 py-3" data-testid={`settlement-${i}`}>
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
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <Receipt className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">{t.bbq.selectBbq}</p>
          </div>
        )}
        </>
        )}
      </main>

      {/* Create event dialog */}
      <Dialog open={isNewBbqOpen} onOpenChange={(open) => { setIsNewBbqOpen(open); if (!open) { setNewEventArea(area); setNewEventType(area === "trips" ? "city_trip" : "barbecue"); } }}>
        <DraggableDialogContent className="sm:max-w-md" data-testid="dialog-new-bbq">
          <DialogHeader>
            <DialogTitle className="font-display text-primary text-xl">{t.events.newEvent}</DialogTitle>
            <DialogDescription>{t.subtitle}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t.nav.parties} / {t.nav.trips}</Label>
              <div className="flex rounded-lg border border-white/10 overflow-hidden">
                <button type="button" onClick={() => { setNewEventArea("parties"); setNewEventType("barbecue"); }} className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${newEventArea === "parties" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-white/5"}`}>{t.nav.parties}</button>
                <button type="button" onClick={() => { setNewEventArea("trips"); setNewEventType("city_trip"); }} className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${newEventArea === "trips" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-white/5"}`}>{t.nav.trips}</button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t.events.event} {t.modals.categoryLabel}</Label>
              <Select value={newEventType} onValueChange={setNewEventType}>
                <SelectTrigger data-testid="select-event-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {newEventArea === "parties" ? partiesEventTypes.map((type) => (
                    <SelectItem key={type} value={type}>{t.eventTypes[EVENT_TYPE_I18N_KEYS[type] as keyof typeof t.eventTypes] ?? type}</SelectItem>
                  )) : tripsEventTypes.map((type) => (
                    <SelectItem key={type} value={type}>{t.eventTypes[EVENT_TYPE_I18N_KEYS[type] as keyof typeof t.eventTypes] ?? type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t.bbq.bbqName}</Label>
              <Input
                placeholder={newEventType === "barbecue" ? "Asado Ortega 2026" : t.events.event}
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewBbqOpen(false)}>{t.modals.cancel}</Button>
            <Button
              onClick={handleCreateBbq}
              disabled={!newBbqName.trim() || createBbq.isPending}
              className="bg-primary text-primary-foreground font-bold"
              data-testid="button-create-bbq"
            >
              {createBbq.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t.bbq.create}
            </Button>
          </DialogFooter>
        </DraggableDialogContent>
      </Dialog>

      {/* Add Person Dialog */}
      <AddPersonDialog
        open={isAddPersonOpen}
        onOpenChange={setIsAddPersonOpen}
        bbqId={selectedBbqId}
      />

      {/* Add/Edit Expense Dialog */}
      <AddExpenseDialog
        open={isAddExpenseOpen}
        onOpenChange={(open) => { setIsAddExpenseOpen(open); if (!open) setEditingExpense(null); }}
        bbqId={selectedBbqId}
        editingExpense={editingExpense}
        currencySymbol={currencyInfo.symbol}
        categories={getCategoriesForEventType((selectedBbq as any)?.eventType)}
      />

      {/* Profile / Friends Dialog */}
      <ProfileDialog open={isProfileOpen} onOpenChange={setIsProfileOpen} />
    </div>
  );
}
