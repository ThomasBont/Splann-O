import { useState } from "react";
import { useLanguage, CURRENCIES, LANGUAGES, type CurrencyCode, convertCurrency } from "@/hooks/use-language";
import { useAuth } from "@/hooks/use-auth";
import {
  useParticipants, useCreateParticipant, useDeleteParticipant,
  usePendingRequests, useMemberships, useJoinBarbecue,
  useAcceptParticipant, useRejectParticipant,
  useInvitedParticipants, useInviteParticipant,
  useAcceptInvite, useDeclineInvite,
} from "@/hooks/use-participants";
import { useExpenses, useDeleteExpense } from "@/hooks/use-expenses";
import { useBarbecues, useCreateBarbecue, useDeleteBarbecue } from "@/hooks/use-bbq-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AddPersonDialog } from "@/components/add-person-dialog";
import { AddExpenseDialog } from "@/components/add-expense-dialog";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import {
  Users, Receipt, Wallet, Trash2, Edit2,
  Flame, Plus, ArrowRight, CheckCircle2,
  CalendarDays, Loader2,
  Beef, Wheat, Beer, Zap, Car, Package,
  UserCheck, UserX, LogOut, Crown, Clock, UserCircle,
  Lock, Globe, UserPlus, X, Eye, EyeOff,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import type { ExpenseWithParticipant, Barbecue, Participant } from "@shared/schema";

const CATEGORY_COLORS: Record<string, string> = {
  Meat: '#e05c2a', Bread: '#f0c040', Drinks: '#3b82f6',
  Charcoal: '#64748b', Transportation: '#10b981', Other: '#a855f7'
};
const CATEGORY_ICON_COMPONENTS: Record<string, typeof Beef> = {
  Meat: Beef, Bread: Wheat, Drinks: Beer, Charcoal: Zap, Transportation: Car, Other: Package
};

// ─── Auth Dialog ──────────────────────────────────────────────────────────────
function AuthDialog({ open }: { open: boolean }) {
  const { t } = useLanguage();
  const { login, register } = useAuth();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);

  const handleLogin = async () => {
    setError("");
    if (!username || !password) return;
    try {
      await login.mutateAsync({ username, password });
    } catch (e: any) {
      const msg = e.message;
      setError(msg === "invalid_credentials" ? t.auth.invalidCredentials : msg);
    }
  };

  const handleRegister = async () => {
    setError("");
    if (!username || !password) return;
    if (password !== confirm) { setError(t.auth.passwordsNoMatch); return; }
    try {
      await register.mutateAsync({ username, password });
    } catch (e: any) {
      const msg = e.message;
      setError(msg === "username_taken" ? t.auth.usernameTaken : msg);
    }
  };

  const isLoading = login.isPending || register.isPending;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-sm" onPointerDownOutside={e => e.preventDefault()} data-testid="dialog-auth">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="bg-gradient-to-br from-primary to-accent p-1.5 rounded-lg">
              <Flame className="w-5 h-5 text-white" fill="currentColor" />
            </div>
            <h1 className="font-display text-primary font-bold text-lg truncate">{t.title}</h1>
          </div>
          <DialogTitle className="text-base">
            {tab === "login" ? t.auth.loginTitle : t.auth.registerTitle}
          </DialogTitle>
          <DialogDescription>
            {tab === "login" ? t.auth.welcomeBack : t.auth.createAccount}
          </DialogDescription>
        </DialogHeader>

        <div className="flex rounded-lg border border-white/10 overflow-hidden mb-2">
          {(["login", "register"] as const).map(tabKey => (
            <button
              key={tabKey}
              onClick={() => { setTab(tabKey); setError(""); }}
              className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                tab === tabKey ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-white/5'
              }`}
              data-testid={`tab-auth-${tabKey}`}
            >
              {tabKey === "login" ? t.auth.login : t.auth.register}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{t.auth.username}</Label>
            <Input
              placeholder={t.user.usernamePlaceholder}
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === "Enter" && (tab === "login" ? handleLogin() : handleRegister())}
              autoFocus
              data-testid="input-auth-username"
            />
            {tab === "register" && (
              <p className="text-[10px] text-muted-foreground">{t.auth.usernameHint}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t.auth.password}</Label>
            <div className="relative">
              <Input
                type={showPw ? "text" : "password"}
                placeholder="••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (tab === "login" ? handleLogin() : (confirm ? handleRegister() : undefined))}
                data-testid="input-auth-password"
                className="pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {tab === "register" && (
              <p className="text-[10px] text-muted-foreground">{t.auth.passwordHint}</p>
            )}
          </div>
          {tab === "register" && (
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
          )}
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2" data-testid="text-auth-error">{error}</p>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            onClick={tab === "login" ? handleLogin : handleRegister}
            disabled={isLoading || !username || !password || (tab === "register" && !confirm)}
            className="w-full bg-primary text-primary-foreground font-bold"
            data-testid="button-auth-submit"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (tab === "login" ? t.auth.login : t.auth.register)}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {tab === "login" ? t.auth.dontHaveAccount : t.auth.alreadyHaveAccount}{" "}
            <button
              onClick={() => { setTab(tab === "login" ? "register" : "login"); setError(""); }}
              className="text-primary hover:underline font-semibold"
              data-testid="button-auth-switch"
            >
              {tab === "login" ? t.auth.register : t.auth.login}
            </button>
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Currency Conversion Bar ──────────────────────────────────────────────────
function CurrencyBar({ total, fairShare, bbqCurrency }: { total: number; fairShare: number; bbqCurrency: CurrencyCode }) {
  const { t } = useLanguage();
  return (
    <div className="bg-card/60 border border-white/5 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-muted-foreground">{t.bbq.currencyConversion}</h3>
        <span className="text-[10px] text-muted-foreground bg-secondary/40 px-2 py-0.5 rounded-full">{t.bbq.approxRates}</span>
      </div>
      <div className="overflow-x-auto -mx-1 px-1 pb-1">
        <div className="flex gap-2.5 min-w-max">
          {CURRENCIES.map(cur => {
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

  const [selectedBbqId, setSelectedBbqId] = useState<number | null>(null);
  const [isNewBbqOpen, setIsNewBbqOpen] = useState(false);
  const [newBbqName, setNewBbqName] = useState("");
  const [newBbqDate, setNewBbqDate] = useState(new Date().toISOString().split('T')[0]);
  const [newBbqCurrency, setNewBbqCurrency] = useState<CurrencyCode>("EUR");
  const [newBbqIsPublic, setNewBbqIsPublic] = useState(true);

  const [isAddPersonOpen, setIsAddPersonOpen] = useState(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseWithParticipant | null>(null);
  const [inviteUsername, setInviteUsername] = useState("");

  const { data: barbecues = [], isLoading: isLoadingBbqs } = useBarbecues();
  const createBbq = useCreateBarbecue();
  const deleteBbq = useDeleteBarbecue();

  const selectedBbq = barbecues.find((b: Barbecue) => b.id === selectedBbqId) || null;
  const currency = (selectedBbq?.currency as CurrencyCode) || "EUR";
  const currencyInfo = CURRENCIES.find(c => c.code === currency) || CURRENCIES[0];
  const isCreator = !!(username && selectedBbq?.creatorId === username);
  const isPrivate = selectedBbq ? !selectedBbq.isPublic : false;

  const { data: participants = [] } = useParticipants(selectedBbqId);
  const { data: expenses = [] } = useExpenses(selectedBbqId);
  const { data: pendingRequests = [] } = usePendingRequests(isCreator ? selectedBbqId : null);
  const { data: invitedParticipants = [] } = useInvitedParticipants(isCreator && isPrivate ? selectedBbqId : null);
  const { data: memberships = [] } = useMemberships(username);

  const deleteParticipant = useDeleteParticipant(selectedBbqId);
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
  const fairShare = participantCount > 0 ? totalSpent / participantCount : 0;
  const myParticipant = username ? participants.find((p: Participant) => p.userId === username) : null;

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
      return { ...p, paid, balance: paid - fairShare };
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

  const handleCreateBbq = () => {
    if (!newBbqName.trim()) return;
    createBbq.mutate({
      name: newBbqName.trim(),
      date: new Date(newBbqDate).toISOString(),
      currency: newBbqCurrency,
      creatorId: username || undefined,
      isPublic: newBbqIsPublic,
    }, {
      onSuccess: (data: Barbecue) => {
        setSelectedBbqId(data.id);
        setNewBbqName(""); setNewBbqDate(new Date().toISOString().split('T')[0]);
        setIsNewBbqOpen(false);
      }
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

  // Show auth dialog if not loading and not logged in
  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      <AuthDialog open={!user} />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-white/5" data-testid="header">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="bg-gradient-to-br from-primary to-accent p-1.5 sm:p-2 rounded-lg shadow-lg shadow-orange-500/20 flex-shrink-0">
              <Flame className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="currentColor" />
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
                <span className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground px-2 py-1.5 rounded-lg bg-white/5">
                  <UserCircle className="w-3.5 h-3.5" />
                  <span className="font-medium max-w-[80px] truncate" data-testid="text-username">{user.username}</span>
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="w-8 h-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={() => logout.mutate()}
                  title={t.auth.logout}
                  data-testid="button-logout"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
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

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-6 sm:space-y-8">

        {/* BBQ Selector */}
        <div className="bg-card/80 backdrop-blur-md border border-white/5 rounded-2xl p-4 sm:p-6" data-testid="section-bbq-selector">
          <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
            <h2 className="text-lg font-bold font-display text-primary flex items-center gap-2">
              <CalendarDays className="w-5 h-5" />
              {t.bbq.allBarbecues}
            </h2>
            {user && (
              <Button
                size="sm"
                onClick={() => setIsNewBbqOpen(true)}
                className="bg-primary text-primary-foreground font-bold"
                data-testid="button-new-bbq"
              >
                <Plus className="w-4 h-4 mr-1" /> {t.bbq.newBarbecue}
              </Button>
            )}
          </div>

          {isLoadingBbqs ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : barbecues.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Flame className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">{t.bbq.noBbqs}</p>
              <p className="text-sm mt-1">{t.bbq.noBbqsSubtitle}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {barbecues.map((bbq: Barbecue) => {
                const isSelected = bbq.id === selectedBbqId;
                const cur = CURRENCIES.find(c => c.code === bbq.currency) || CURRENCIES[0];
                const isBbqCreator = !!(username && bbq.creatorId === username);
                const membership = getMembershipStatus(bbq.id);
                const memberStatus = membership?.status || null;
                const participantId = membership?.participantId;

                return (
                  <div
                    key={bbq.id}
                    onClick={() => setSelectedBbqId(bbq.id)}
                    className={`cursor-pointer text-left p-4 rounded-xl border transition-all ${
                      isSelected
                        ? 'border-primary/50 bg-primary/10 shadow-lg shadow-primary/10'
                        : 'border-white/5 bg-secondary/20 hover:border-white/15'
                    }`}
                    data-testid={`button-bbq-${bbq.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold truncate flex items-center gap-2 flex-wrap">
                          {bbq.name}
                          {!bbq.isPublic && (
                            <span className="inline-flex items-center gap-1 text-xs bg-secondary/60 text-muted-foreground px-1.5 py-0.5 rounded flex-shrink-0">
                              <Lock className="w-2.5 h-2.5" />
                              {t.bbq.privateEvent}
                            </span>
                          )}
                          {isBbqCreator && (
                            <span className="inline-flex items-center gap-1 text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded font-semibold flex-shrink-0">
                              <Crown className="w-3 h-3" />
                              {t.user.host}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                          <span>{new Date(bbq.date).toLocaleDateString()}</span>
                          <span className="bg-secondary/50 px-2 py-0.5 rounded text-xs">{cur.symbol} {getCurrencyLabel(cur)}</span>
                        </div>
                        {!isBbqCreator && bbq.creatorId && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {t.bbq.hostedBy} <span className="font-medium text-foreground/70">{bbq.creatorId}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        {isBbqCreator ? (
                          <Button
                            size="icon" variant="ghost"
                            className="w-8 h-8 text-muted-foreground opacity-50 hover:opacity-100 hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); handleDeleteBbq(bbq.id); }}
                            data-testid={`button-delete-bbq-${bbq.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        ) : memberStatus === 'accepted' ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded font-semibold" data-testid={`badge-joined-${bbq.id}`}>
                            <CheckCircle2 className="w-3 h-3" /> {t.user.joined}
                          </span>
                        ) : memberStatus === 'pending' ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded font-semibold" data-testid={`badge-pending-${bbq.id}`}>
                            <Clock className="w-3 h-3" /> {t.user.pending}
                          </span>
                        ) : memberStatus === 'invited' && participantId ? (
                          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                            <Button
                              size="sm" variant="outline"
                              className="h-7 text-xs border-green-500/30 text-green-400 hover:bg-green-500/10"
                              onClick={() => acceptInvite.mutate({ id: participantId, bbqId: bbq.id })}
                              disabled={acceptInvite.isPending}
                              data-testid={`button-accept-invite-${bbq.id}`}
                            >
                              {t.bbq.acceptInvite}
                            </Button>
                            <Button
                              size="sm" variant="ghost"
                              className="h-7 text-xs text-muted-foreground hover:text-destructive"
                              onClick={() => declineInvite.mutate({ id: participantId, bbqId: bbq.id })}
                              disabled={declineInvite.isPending}
                              data-testid={`button-decline-invite-${bbq.id}`}
                            >
                              {t.bbq.declineInvite}
                            </Button>
                          </div>
                        ) : bbq.isPublic && user ? (
                          <Button
                            size="sm" variant="outline"
                            className="h-7 text-xs border-white/20 hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
                            onClick={(e) => { e.stopPropagation(); handleJoin(bbq.id); }}
                            disabled={joinBbq.isPending}
                            data-testid={`button-join-bbq-${bbq.id}`}
                          >
                            {joinBbq.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : t.user.joinBbq}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

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
            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <StatCard label={t.totalSpent} value={formatMoney(totalSpent)} icon={<Wallet />} color="gold" />
              <StatCard label={t.participants} value={participantCount} icon={<Users />} color="blue" />
              <StatCard label={t.expenses} value={expenses.length} icon={<Receipt />} color="orange" />
              <StatCard label={t.fairShare} value={formatMoney(fairShare)} icon={<Wallet />} color="green" />
            </div>

            {/* Currency Conversion Bar */}
            {totalSpent > 0 && (
              <CurrencyBar total={totalSpent} fairShare={fairShare} bbqCurrency={currency} />
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
                    return (
                      <div
                        key={p.id}
                        className="inline-flex items-center gap-2 bg-secondary/40 border border-white/10 rounded-xl px-3 py-1.5 text-sm"
                        data-testid={`chip-participant-${p.id}`}
                      >
                        <span className="font-medium">{p.name}</span>
                        <span className="text-primary text-xs font-semibold">{formatMoney(paid)}</span>
                        {canLeave(p) && (
                          <button
                            onClick={() => deleteParticipant.mutate(p.id)}
                            className="text-muted-foreground hover:text-destructive ml-0.5"
                            title={t.user.leave}
                            data-testid={`button-leave-${p.id}`}
                          >
                            <LogOut className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canManage && p.userId !== username && (
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
            <Flame className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">{t.bbq.selectBbq}</p>
          </div>
        )}
      </main>

      {/* Create BBQ Dialog */}
      <Dialog open={isNewBbqOpen} onOpenChange={setIsNewBbqOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-new-bbq">
          <DialogHeader>
            <DialogTitle className="font-display text-primary text-xl">{t.bbq.newBarbecue}</DialogTitle>
            <DialogDescription>{t.subtitle}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t.bbq.bbqName}</Label>
              <Input
                placeholder="Asado Ortega 2026"
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
                    !newBbqIsPublic ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-white/5'
                  }`}
                  data-testid="button-visibility-private"
                >
                  <Lock className="w-4 h-4" /> {t.bbq.privateEvent}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">{newBbqIsPublic ? t.bbq.publicDesc : t.bbq.privateDesc}</p>
            </div>
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
        </DialogContent>
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
      />
    </div>
  );
}
