import { useState } from "react";
import { useLanguage, CURRENCIES, LANGUAGES, type CurrencyCode } from "@/hooks/use-language";
import { useUser } from "@/hooks/use-user";
import {
  useParticipants,
  useCreateParticipant,
  useDeleteParticipant,
  usePendingRequests,
  useMemberships,
  useJoinBarbecue,
  useAcceptParticipant,
  useRejectParticipant,
} from "@/hooks/use-participants";
import { useExpenses, useDeleteExpense } from "@/hooks/use-expenses";
import { useBarbecues, useCreateBarbecue, useDeleteBarbecue } from "@/hooks/use-bbq-data";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddPersonDialog } from "@/components/add-person-dialog";
import { AddExpenseDialog } from "@/components/add-expense-dialog";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import {
  Users, Receipt, Wallet, Scale, Trash2, Edit2,
  Flame, Plus, ArrowRight, CheckCircle2,
  CalendarDays, Globe, Loader2,
  Beef, Wheat, Beer, Zap, Car, Package,
  UserCheck, UserX, LogOut, Crown, Clock, UserCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import type { ExpenseWithParticipant, Barbecue, Participant } from "@shared/schema";

const CATEGORY_COLORS: Record<string, string> = {
  Meat: '#e05c2a',
  Bread: '#f0c040',
  Drinks: '#3b82f6',
  Charcoal: '#64748b',
  Transportation: '#10b981',
  Other: '#a855f7'
};

const CATEGORY_ICON_COMPONENTS: Record<string, typeof Beef> = {
  Meat: Beef, Bread: Wheat, Drinks: Beer,
  Charcoal: Zap, Transportation: Car, Other: Package
};

export default function Home() {
  const { language, setLanguage, t } = useLanguage();
  const { username, setUsername, clearUsername } = useUser();
  const { toast } = useToast();

  const [selectedBbqId, setSelectedBbqId] = useState<number | null>(null);
  const [isNewBbqOpen, setIsNewBbqOpen] = useState(false);
  const [newBbqName, setNewBbqName] = useState("");
  const [newBbqDate, setNewBbqDate] = useState(new Date().toISOString().split('T')[0]);
  const [newBbqCurrency, setNewBbqCurrency] = useState<CurrencyCode>("EUR");

  const [isAddPersonOpen, setIsAddPersonOpen] = useState(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseWithParticipant | null>(null);

  const [isUsernameSetupOpen, setIsUsernameSetupOpen] = useState(!username);
  const [newUsername, setNewUsername] = useState("");
  const [pendingJoinBbqId, setPendingJoinBbqId] = useState<number | null>(null);
  const [isFirstSetup] = useState(!username);

  const { data: barbecues = [], isLoading: isLoadingBbqs } = useBarbecues();
  const createBbq = useCreateBarbecue();
  const deleteBbq = useDeleteBarbecue();

  const selectedBbq = barbecues.find((b: Barbecue) => b.id === selectedBbqId) || null;
  const currency = (selectedBbq?.currency as CurrencyCode) || "EUR";
  const currencyInfo = CURRENCIES.find(c => c.code === currency) || CURRENCIES[0];

  const isCreator = !!(username && selectedBbq?.creatorId === username);

  const { data: participants = [], isLoading: isLoadingParticipants } = useParticipants(selectedBbqId);
  const { data: expenses = [], isLoading: isLoadingExpenses } = useExpenses(selectedBbqId);
  const { data: pendingRequests = [] } = usePendingRequests(isCreator ? selectedBbqId : null);
  const { data: memberships = [] } = useMemberships(username);

  const deleteParticipant = useDeleteParticipant(selectedBbqId);
  const deleteExpense = useDeleteExpense(selectedBbqId);
  const joinBbq = useJoinBarbecue();
  const acceptParticipant = useAcceptParticipant(selectedBbqId);
  const rejectParticipant = useRejectParticipant(selectedBbqId);

  const getCurrencyLabel = (cur: typeof CURRENCIES[0]) => {
    if (language === 'es') return cur.labelEs;
    if (language === 'it') return cur.labelIt;
    if (language === 'nl') return cur.labelNl;
    return cur.label;
  };

  const cycleLanguage = () => {
    const idx = LANGUAGES.findIndex(l => l.code === language);
    const next = LANGUAGES[(idx + 1) % LANGUAGES.length];
    setLanguage(next.code);
  };

  const getMembershipStatus = (bbqId: number): string | null => {
    const m = memberships.find(m => m.bbqId === bbqId);
    return m?.status || null;
  };

  const formatMoney = (amount: number) => {
    return `${currencyInfo.symbol}${amount.toFixed(2)}`;
  };

  const totalSpent = expenses.reduce((sum: number, exp: ExpenseWithParticipant) => sum + Number(exp.amount), 0);
  const participantCount = participants.length;
  const fairShare = participantCount > 0 ? totalSpent / participantCount : 0;

  const myParticipant = username ? participants.find((p: Participant) => p.userId === username) : null;

  const canLeave = (p: Participant) => {
    if (p.userId !== username) return false;
    if (!selectedBbq?.date) return false;
    const bbqDate = new Date(selectedBbq.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return bbqDate >= today;
  };

  const expensesByCategory = expenses.reduce((acc: Record<string, number>, exp: ExpenseWithParticipant) => {
    acc[exp.category] = (acc[exp.category] || 0) + Number(exp.amount);
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(expensesByCategory).map(([name, value]) => ({
    name,
    value,
    translatedName: t.categories[name as keyof typeof t.categories] || name
  })).filter(d => d.value > 0);

  const calculateSettlements = () => {
    if (participantCount === 0) return { balances: [] as any[], settlements: [] as any[] };
    const balances = participants.map((p: any) => {
      const paid = expenses
        .filter((e: ExpenseWithParticipant) => e.participantId === p.id)
        .reduce((sum: number, e: ExpenseWithParticipant) => sum + Number(e.amount), 0);
      return { ...p, paid, balance: paid - fairShare };
    });
    const debtors = balances.filter((b: any) => b.balance < -0.01).sort((a: any, b: any) => a.balance - b.balance);
    const creditors = balances.filter((b: any) => b.balance > 0.01).sort((a: any, b: any) => b.balance - a.balance);
    const settlements: { from: string; to: string; amount: number }[] = [];
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      const amount = Math.min(Math.abs(debtor.balance), creditor.balance);
      if (amount > 0.01) settlements.push({ from: debtor.name, to: creditor.name, amount });
      debtor.balance += amount;
      creditor.balance -= amount;
      if (Math.abs(debtor.balance) < 0.01) i++;
      if (creditor.balance < 0.01) j++;
    }
    return { balances, settlements };
  };

  const { balances, settlements } = calculateSettlements();

  const handleUsernameConfirm = () => {
    if (!newUsername.trim()) return;
    const name = newUsername.trim();
    setUsername(name);
    setIsUsernameSetupOpen(false);
    setNewUsername("");
    if (pendingJoinBbqId !== null) {
      joinBbq.mutate({ bbqId: pendingJoinBbqId, name, userId: name }, {
        onSuccess: () => toast({ title: t.user.joinBbq, description: `${t.user.pending}...` }),
        onError: (err: any) => {
          const msg = err.message;
          if (msg === "already_joined") toast({ title: t.user.joined });
          else if (msg === "already_pending") toast({ title: t.user.pending });
          else toast({ title: msg, variant: "destructive" });
        },
      });
      setPendingJoinBbqId(null);
    }
  };

  const handleJoin = (bbqId: number) => {
    if (!username) {
      setPendingJoinBbqId(bbqId);
      setIsUsernameSetupOpen(true);
      return;
    }
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
    createBbq.mutate(
      {
        name: newBbqName.trim(),
        date: new Date(newBbqDate).toISOString(),
        currency: newBbqCurrency,
        creatorId: username || undefined,
      },
      {
        onSuccess: (data: Barbecue) => {
          setSelectedBbqId(data.id);
          setNewBbqName("");
          setNewBbqDate(new Date().toISOString().split('T')[0]);
          setIsNewBbqOpen(false);
        }
      }
    );
  };

  const handleDeleteBbq = (id: number) => {
    deleteBbq.mutate(id);
    if (selectedBbqId === id) setSelectedBbqId(null);
  };

  const handleEditExpense = (expense: ExpenseWithParticipant) => {
    setEditingExpense(expense);
    setIsAddExpenseOpen(true);
  };

  const canManage = isCreator;
  const isAcceptedMember = !isCreator && myParticipant !== null;

  return (
    <div className="min-h-screen pb-20">
      {/* Username Setup Dialog */}
      <Dialog
        open={isUsernameSetupOpen}
        onOpenChange={(open) => {
          if (!open && isFirstSetup && !localStorage.getItem('bbq-username')) return;
          setIsUsernameSetupOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-sm" data-testid="dialog-username-setup">
          <DialogHeader>
            <DialogTitle className="font-display text-primary text-xl">{t.user.setupTitle}</DialogTitle>
            <DialogDescription>{t.user.setupSubtitle}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t.modals.nameLabel}</Label>
              <Input
                placeholder={t.user.usernamePlaceholder}
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUsernameConfirm()}
                autoFocus
                data-testid="input-username"
              />
            </div>
          </div>
          <DialogFooter>
            {!isFirstSetup && (
              <Button variant="outline" onClick={() => setIsUsernameSetupOpen(false)}>
                {t.modals.cancel}
              </Button>
            )}
            <Button
              onClick={handleUsernameConfirm}
              disabled={!newUsername.trim()}
              className="bg-primary text-primary-foreground font-bold"
              data-testid="button-confirm-username"
            >
              {t.user.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

          <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
            {username && (
              <button
                onClick={() => { setNewUsername(username); setIsUsernameSetupOpen(true); }}
                className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
                data-testid="button-username-display"
                title={t.user.changeUsername}
              >
                <UserCircle className="w-4 h-4" />
                <span className="font-medium">{username}</span>
              </button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={cycleLanguage}
              className="border-white/10 px-2 sm:px-3 text-xs sm:text-sm min-w-[3rem]"
              data-testid="button-language-toggle"
            >
              <Globe className="w-3.5 h-3.5 sm:mr-1" />
              <span>{language.toUpperCase()}</span>
            </Button>

            {selectedBbqId && (
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
                <Button
                  size="sm"
                  onClick={() => setIsAddExpenseOpen(true)}
                  className="bg-accent text-accent-foreground font-bold px-2 sm:px-3 text-xs sm:text-sm"
                  data-testid="button-add-expense"
                >
                  <Plus className="w-3.5 h-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">{t.addExpense}</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-6 sm:space-y-8">

        {/* BBQ Selector Section */}
        <div className="bg-card/80 backdrop-blur-md border border-white/5 rounded-2xl p-4 sm:p-6" data-testid="section-bbq-selector">
          <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
            <h2 className="text-lg font-bold font-display text-primary flex items-center gap-2">
              <CalendarDays className="w-5 h-5" />
              {t.bbq.allBarbecues}
            </h2>
            <Button
              size="sm"
              onClick={() => setIsNewBbqOpen(true)}
              className="bg-primary text-primary-foreground font-bold"
              data-testid="button-new-bbq"
            >
              <Plus className="w-4 h-4 mr-1" /> {t.bbq.newBarbecue}
            </Button>
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
                const memberStatus = getMembershipStatus(bbq.id);

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
                        <div className="font-bold truncate flex items-center gap-2">
                          {bbq.name}
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
                            size="icon"
                            variant="ghost"
                            className="w-8 h-8 text-muted-foreground opacity-50 hover:opacity-100 hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); handleDeleteBbq(bbq.id); }}
                            data-testid={`button-delete-bbq-${bbq.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        ) : memberStatus === 'accepted' ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded font-semibold" data-testid={`badge-joined-${bbq.id}`}>
                            <CheckCircle2 className="w-3 h-3" />
                            {t.user.joined}
                          </span>
                        ) : memberStatus === 'pending' ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded font-semibold" data-testid={`badge-pending-${bbq.id}`}>
                            <Clock className="w-3 h-3" />
                            {t.user.pending}
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-white/20 hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
                            onClick={(e) => { e.stopPropagation(); handleJoin(bbq.id); }}
                            disabled={joinBbq.isPending}
                            data-testid={`button-join-bbq-${bbq.id}`}
                          >
                            {joinBbq.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : t.user.joinBbq}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pending Requests Panel (creator only) */}
        {isCreator && pendingRequests.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 sm:p-6"
            data-testid="section-pending-requests"
          >
            <h3 className="text-base font-bold font-display text-yellow-400 flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5" />
              {t.user.pendingRequests} ({pendingRequests.length})
            </h3>
            <div className="flex flex-wrap gap-3">
              {pendingRequests.map((p: Participant) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 bg-secondary/40 border border-white/10 rounded-xl px-3 py-2"
                  data-testid={`pending-request-${p.id}`}
                >
                  <UserCheck className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{p.name}</span>
                  <div className="flex gap-1 ml-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="w-7 h-7 text-green-400 hover:bg-green-500/20 hover:text-green-300"
                      onClick={() => acceptParticipant.mutate(p.id)}
                      disabled={acceptParticipant.isPending}
                      data-testid={`button-accept-${p.id}`}
                      title={t.user.accept}
                    >
                      <UserCheck className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="w-7 h-7 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                      onClick={() => rejectParticipant.mutate(p.id)}
                      disabled={rejectParticipant.isPending}
                      data-testid={`button-reject-${p.id}`}
                      title={t.user.reject}
                    >
                      <UserX className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Main Content (only when a BBQ is selected) */}
        {selectedBbqId ? (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <StatCard
                label={t.totalSpent}
                value={formatMoney(totalSpent)}
                icon={<Wallet />}
                color="gold"
              />
              <StatCard
                label={t.participants}
                value={participantCount}
                icon={<Users />}
                color="blue"
              />
              <StatCard
                label={t.expenses}
                value={expenses.length}
                icon={<Receipt />}
                color="orange"
              />
              <StatCard
                label={t.fairShare}
                value={participantCount > 0 ? formatMoney(fairShare) : '\u2014'}
                icon={<Scale />}
                color="green"
              />
            </div>

            {/* Participants Chips */}
            {participants.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-wrap gap-2 sm:gap-3"
              >
                {participants.map((p: Participant) => (
                  <div
                    key={p.id}
                    className={`group flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-full border transition-colors ${
                      p.userId === username
                        ? 'bg-primary/10 border-primary/30 hover:border-primary/50'
                        : 'bg-secondary/50 border-white/5 hover:border-primary/50'
                    }`}
                    data-testid={`chip-participant-${p.id}`}
                  >
                    <span className="font-medium text-sm">{p.name}</span>
                    {p.userId === username && (
                      <span className="text-xs text-primary/70 font-medium">({t.bbq.you})</span>
                    )}
                    {canLeave(p) ? (
                      <button
                        onClick={() => deleteParticipant.mutate(p.id)}
                        className="p-1 rounded-full hover:bg-orange-500/20 text-muted-foreground hover:text-orange-400 transition-colors"
                        title={t.user.leave}
                        data-testid={`button-leave-${p.id}`}
                      >
                        <LogOut className="w-3 h-3" />
                      </button>
                    ) : canManage ? (
                      <button
                        onClick={() => deleteParticipant.mutate(p.id)}
                        className="p-1 rounded-full hover:bg-white/10 text-muted-foreground hover:text-destructive transition-colors sm:opacity-0 sm:group-hover:opacity-100"
                        data-testid={`button-delete-participant-${p.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    ) : null}
                  </div>
                ))}
              </motion.div>
            )}

            {/* Main Content Tabs */}
            <Tabs defaultValue="expenses" className="w-full">
              <div className="flex justify-center mb-6 sm:mb-8">
                <TabsList className="bg-secondary/50 p-1 border border-white/5 rounded-xl">
                  <TabsTrigger
                    value="expenses"
                    className="px-4 sm:px-8 py-2 sm:py-2.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold transition-all text-sm"
                    data-testid="tab-expenses"
                  >
                    {t.tabs.expenses}
                  </TabsTrigger>
                  <TabsTrigger
                    value="split"
                    className="px-4 sm:px-8 py-2 sm:py-2.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold transition-all text-sm"
                    data-testid="tab-split"
                  >
                    {t.tabs.split}
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="expenses" className="space-y-6 focus-visible:outline-none">
                {expenses.length === 0 ? (
                  <div className="text-center py-12 sm:py-20 text-muted-foreground">
                    <div className="inline-flex p-4 sm:p-6 rounded-full bg-secondary/30 mb-4 sm:mb-6">
                      <Flame className="w-8 h-8 sm:w-12 sm:h-12 text-muted-foreground/50" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold mb-2">{t.emptyState.title}</h3>
                    <p className="text-sm sm:text-base">{t.emptyState.subtitle}</p>
                  </div>
                ) : (
                  <div className="grid lg:grid-cols-3 gap-6 sm:gap-8">
                    <div className="lg:col-span-2 space-y-3 sm:space-y-4">
                      <AnimatePresence>
                        {expenses.map((expense: ExpenseWithParticipant) => (
                          <motion.div
                            key={expense.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="group flex items-center justify-between p-3 sm:p-4 rounded-xl bg-card border border-white/5 hover:border-white/10 transition-colors gap-3"
                            data-testid={`expense-row-${expense.id}`}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-secondary/50 flex items-center justify-center select-none flex-shrink-0" style={{ color: CATEGORY_COLORS[expense.category] }}>
                                {(() => { const Icon = CATEGORY_ICON_COMPONENTS[expense.category] || Package; return <Icon className="w-5 h-5 sm:w-6 sm:h-6" />; })()}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-sm sm:text-base truncate">{expense.item}</div>
                                <div className="text-xs sm:text-sm text-muted-foreground truncate">
                                  {expense.participantName} &bull; {t.categories[expense.category as keyof typeof t.categories]}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                              <div className="text-base sm:text-lg font-bold font-mono text-primary whitespace-nowrap">
                                {formatMoney(Number(expense.amount))}
                              </div>
                              {canManage && (
                                <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleEditExpense(expense)}
                                    data-testid={`button-edit-expense-${expense.id}`}
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="hover:text-destructive"
                                    onClick={() => deleteExpense.mutate(expense.id)}
                                    data-testid={`button-delete-expense-${expense.id}`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>

                    <div className="bg-card border border-white/5 rounded-2xl p-4 sm:p-6 h-fit lg:sticky lg:top-24">
                      <h3 className="text-lg font-bold font-display text-primary mb-4 sm:mb-6">{t.bbq.breakdown}</h3>
                      <div className="h-[200px] sm:h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={chartData}
                              innerRadius={50}
                              outerRadius={70}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.name]} stroke="rgba(0,0,0,0)" />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value: number) => formatMoney(value)}
                              contentStyle={{ backgroundColor: '#1d1d2b', border: '1px solid #333', borderRadius: '8px' }}
                              itemStyle={{ color: '#fff' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-2 sm:space-y-3 mt-3 sm:mt-4">
                        {chartData.map((item) => (
                          <div key={item.name} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[item.name] }} />
                              <span>{item.translatedName}</span>
                            </div>
                            <span className="font-mono text-muted-foreground">
                              {Math.round((item.value / totalSpent) * 100)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="split" className="focus-visible:outline-none">
                <div className="grid md:grid-cols-2 gap-4 sm:gap-8">
                  <div className="bg-card border border-white/5 rounded-2xl p-4 sm:p-6">
                    <h3 className="text-lg sm:text-xl font-bold font-display text-primary mb-4 sm:mb-6">
                      {t.split.contributions}
                    </h3>
                    <div className="space-y-3 sm:space-y-4">
                      {balances && balances.map((b: any) => (
                        <div key={b.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 gap-2">
                          <div className="min-w-0">
                            <div className="font-bold truncate">{b.name}</div>
                            <div className="text-xs text-muted-foreground uppercase tracking-wider">
                              {b.balance > 0 ? t.split.overpaid : t.split.underpaid}
                            </div>
                          </div>
                          <div className={`font-mono font-bold whitespace-nowrap ${b.balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {b.balance > 0 ? '+' : ''}{formatMoney(b.balance)}
                          </div>
                        </div>
                      ))}
                      {(!balances || balances.length === 0) && (
                        <p className="text-muted-foreground italic text-sm">{t.bbq.selectBbq}</p>
                      )}
                    </div>
                  </div>

                  <div className="bg-card border border-white/5 rounded-2xl p-4 sm:p-6">
                    <h3 className="text-lg sm:text-xl font-bold font-display text-accent mb-4 sm:mb-6">
                      {t.split.settlement}
                    </h3>
                    <div className="space-y-3 sm:space-y-4">
                      {settlements && settlements.length > 0 ? (
                        settlements.map((s: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl bg-gradient-to-r from-secondary/40 to-transparent border border-white/5 flex-wrap">
                            <span className="font-bold text-red-400">{s.from}</span>
                            <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <span className="font-bold text-green-400">{s.to}</span>
                            <span className="text-muted-foreground text-sm">{t.split.owes}</span>
                            <span className="font-mono font-bold text-primary ml-auto">{formatMoney(s.amount)}</span>
                          </div>
                        ))
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center text-muted-foreground">
                          <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12 text-green-400 mb-3" />
                          <p className="font-bold text-green-400 text-lg">{t.split.allSettled}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <div className="text-center py-16 sm:py-24 text-muted-foreground">
            <div className="inline-flex p-5 sm:p-8 rounded-full bg-secondary/30 mb-4 sm:mb-6">
              <Flame className="w-10 h-10 sm:w-14 sm:h-14 text-muted-foreground/30" />
            </div>
            <p className="text-base sm:text-lg font-medium">{t.bbq.selectBbq}</p>
          </div>
        )}
      </main>

      {/* Create BBQ Dialog */}
      <Dialog open={isNewBbqOpen} onOpenChange={setIsNewBbqOpen}>
        <DialogContent className="sm:max-w-sm" data-testid="dialog-new-bbq">
          <DialogHeader>
            <DialogTitle className="font-display text-primary">{t.bbq.newBarbecue}</DialogTitle>
            <DialogDescription>{t.bbq.bbqName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t.bbq.bbqName}</Label>
              <Input
                placeholder="e.g. Summer Asado 2025"
                value={newBbqName}
                onChange={(e) => setNewBbqName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateBbq()}
                data-testid="input-bbq-name"
              />
            </div>
            <div className="space-y-2">
              <Label>{t.bbq.date}</Label>
              <Input
                type="date"
                value={newBbqDate}
                onChange={(e) => setNewBbqDate(e.target.value)}
                data-testid="input-bbq-date"
              />
            </div>
            <div className="space-y-2">
              <Label>{t.bbq.currency}</Label>
              <Select value={newBbqCurrency} onValueChange={(v) => setNewBbqCurrency(v as CurrencyCode)}>
                <SelectTrigger data-testid="select-bbq-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(c => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.symbol} — {getCurrencyLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
      {selectedBbqId && (
        <AddPersonDialog
          open={isAddPersonOpen}
          onOpenChange={setIsAddPersonOpen}
          bbqId={selectedBbqId}
        />
      )}

      {/* Add/Edit Expense Dialog */}
      {selectedBbqId && (
        <AddExpenseDialog
          open={isAddExpenseOpen}
          onOpenChange={(open) => {
            setIsAddExpenseOpen(open);
            if (!open) setEditingExpense(null);
          }}
          bbqId={selectedBbqId}
          editingExpense={editingExpense}
        />
      )}
    </div>
  );
}
