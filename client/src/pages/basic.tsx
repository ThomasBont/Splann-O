import { useState, useMemo, useRef, useEffect } from "react";
import { useLanguage, getCurrency, CoreCurrencies, type CurrencyCode } from "@/hooks/use-language";
import { useTheme } from "@/hooks/use-theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { SplannoLogo } from "@/components/splanno-logo";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Receipt,
  Users,
  Sun,
  Moon,
  Lock,
  Camera,
  MapPin,
  UserPlus,
  Palette,
  History,
} from "lucide-react";
import {
  DEMO_SCENARIOS_CYCLE,
  scenarioToState,
  getDefaultScenario,
  type DemoScenario,
} from "@/data/demoScenarios";
import { DemoShareCard } from "@/components/basic/DemoShareCard";
import { ConfettiCelebration } from "@/components/basic/ConfettiCelebration";
import { downloadCardAsImage } from "@/utils/exportCard";
import { useToast } from "@/hooks/use-toast";
import { useReducedMotion, motion } from "framer-motion";
import { motionTransition } from "@/lib/motion";
import { ExpenseReactionBar } from "@/components/event/ExpenseReactionBar";
import { AnimatedBalance } from "@/components/event/AnimatedBalance";
import { useExpenseReactions } from "@/hooks/use-expense-reactions";

type Participant = { id: string; name: string };
type Expense = { id: string; description: string; amount: number; paidById: string };

const STORAGE_KEY = "basic-split-data";
const STORAGE_KEY_CURRENCY = "basic-currency";

function loadStored(): {
  participants: Participant[];
  expenses: Expense[];
  participantColors?: Record<string, string>;
  scenarioTitle?: string;
} {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { participants: [], expenses: [] };
    const data = JSON.parse(raw);
    return {
      participants: Array.isArray(data.participants) ? data.participants : [],
      expenses: Array.isArray(data.expenses) ? data.expenses : [],
      participantColors: data.participantColors,
      scenarioTitle: data.scenarioTitle,
    };
  } catch {
    return { participants: [], expenses: [] };
  }
}

function saveStored(
  participants: Participant[],
  expenses: Expense[],
  participantColors?: Record<string, string>,
  scenarioTitle?: string
) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        participants,
        expenses,
        participantColors: participantColors || {},
        scenarioTitle: scenarioTitle || "",
      })
    );
  } catch {}
}

function loadStoredCurrency(): CurrencyCode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CURRENCY);
    if (raw && CoreCurrencies.some((c) => c.code === raw)) return raw as CurrencyCode;
  } catch {}
  return "EUR";
}

function uuid() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getCurrencyLabel(cur: { code: string; symbol: string; name: string }): string {
  return cur.name;
}

const LOCKED_TABS = [
  { id: "trips", icon: MapPin, labelKey: "lockedTrips" },
  { id: "friends", icon: UserPlus, labelKey: "lockedFriends" },
  { id: "themes", icon: Palette, labelKey: "lockedThemes" },
  { id: "history", icon: History, labelKey: "lockedHistory" },
];

export default function Basic() {
  const { t, language } = useLanguage();
  const { theme, setPreference } = useTheme();
  const { toast } = useToast();
  const shareCardRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const { addReaction, getReactions, hydrate } = useExpenseReactions("basic-demo");

  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [prevAllSettled, setPrevAllSettled] = useState(false);
  const [ctaDismissed, setCtaDismissed] = useState(false);

  const stored = useMemo(() => loadStored(), []);
  const isFirstLoad =
    stored.participants.length === 0 && stored.expenses.length === 0;

  const [participants, setParticipants] = useState<Participant[]>(() => {
    if (isFirstLoad) {
      const def = getDefaultScenario();
      return def.participants.map((p) => ({ id: p.id, name: p.name }));
    }
    return stored.participants;
  });

  const [expenses, setExpenses] = useState<Expense[]>(() => {
    if (isFirstLoad) {
      const def = getDefaultScenario();
      return def.expenses;
    }
    return stored.expenses;
  });

  const [participantColors, setParticipantColors] = useState<
    Record<string, string>
  >(() => {
    if (isFirstLoad) {
      const def = getDefaultScenario();
      const colors: Record<string, string> = {};
      def.participants.forEach((p) => {
        colors[p.id] = p.color;
      });
      return colors;
    }
    return stored.participantColors || {};
  });

  const [scenarioTitle, setScenarioTitle] = useState(
    () => stored.scenarioTitle || DEMO_SCENARIOS_CYCLE[0].title
  );

  const [currency, setCurrency] = useState<CurrencyCode>(loadStoredCurrency);

  const { symbol } = getCurrency(currency) ?? CoreCurrencies[0];

  const persistCurrency = (code: CurrencyCode) => {
    setCurrency(code);
    try {
      localStorage.setItem(STORAGE_KEY_CURRENCY, code);
    } catch {}
  };

  useMemo(
    () =>
      saveStored(participants, expenses, participantColors, scenarioTitle),
    [participants, expenses, participantColors, scenarioTitle]
  );

  const applyScenario = (scenario: DemoScenario) => {
    const state = scenarioToState(scenario);
    setParticipants(state.participants.map((p) => ({ id: p.id, name: p.name })));
    setExpenses(state.expenses);
    const colors: Record<string, string> = {};
    state.participants.forEach((p) => {
      colors[p.id] = (p as { color?: string }).color || "from-primary/80 to-accent/80";
    });
    setParticipantColors(colors);
    setScenarioTitle(scenario.title);
    // Seed fake reactions for first few expenses
    const fakeReactions: Record<string, Record<string, number>> = {};
    state.expenses.slice(0, 3).forEach((e, i) => {
      const emojis = ["👍", "❤️", "🔥"] as const;
      fakeReactions[e.id] = { [emojis[i]]: i + 1 };
    });
    hydrate(fakeReactions);
  };

  const cycleScenario = () => {
    const next = (scenarioIndex + 1) % DEMO_SCENARIOS_CYCLE.length;
    setScenarioIndex(next);
    applyScenario(DEMO_SCENARIOS_CYCLE[next]);
  };

  const addParticipant = () => {
    const newId = uuid();
    setParticipants((p) => [...p, { id: newId, name: "" }]);
    const colors = [
      "from-amber-500/80 to-orange-600/80",
      "from-red-500/80 to-rose-600/80",
      "from-green-500/80 to-emerald-600/80",
      "from-blue-500/80 to-indigo-600/80",
      "from-violet-500/80 to-purple-600/80",
    ];
    setParticipantColors((c) => ({
      ...c,
      [newId]: colors[Object.keys(c).length % colors.length],
    }));
  };

  const updateParticipant = (id: string, name: string) => {
    setParticipants((p) => p.map((x) => (x.id === id ? { ...x, name } : x)));
  };

  const removeParticipant = (id: string) => {
    setParticipants((p) => p.filter((x) => x.id !== id));
    setExpenses((e) => e.filter((x) => x.paidById !== id));
    setParticipantColors((c) => {
      const next = { ...c };
      delete next[id];
      return next;
    });
  };

  const addExpense = () => {
    const firstId = participants[0]?.id;
    setExpenses((e) => [
      ...e,
      { id: uuid(), description: "", amount: 0, paidById: firstId ?? "" },
    ]);
  };

  const updateExpense = (
    id: string,
    updates: Partial<Pick<Expense, "description" | "amount" | "paidById">>
  ) => {
    setExpenses((e) => e.map((x) => (x.id === id ? { ...x, ...updates } : x)));
  };

  const removeExpense = (id: string) => {
    setExpenses((e) => e.filter((x) => x.id !== id));
  };

  const total = expenses.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const n = participants.filter((p) => p.name.trim()).length;
  const fairShare = n > 0 ? total / n : 0;

  const paidByPerson: Record<string, number> = {};
  participants.forEach((p) => (paidByPerson[p.id] = 0));
  expenses.forEach((e) => {
    const amt = Number(e.amount) || 0;
    if (paidByPerson[e.paidById] !== undefined) paidByPerson[e.paidById] += amt;
  });

  const balances: { id: string; name: string; balance: number }[] = participants
    .filter((p) => p.name.trim())
    .map((p) => ({
      id: p.id,
      name: p.name.trim(),
      balance: (paidByPerson[p.id] ?? 0) - fairShare,
    }));

  const debtors = balances.filter((b) => b.balance < -0.01).sort((a, b) => a.balance - b.balance);
  const creditors = balances
    .filter((b) => b.balance > 0.01)
    .sort((a, b) => b.balance - a.balance);

  const settlements: { from: string; to: string; amount: number }[] = [];
  let i = 0,
    j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    const amount = Math.min(-d.balance, c.balance);
    if (amount >= 0.01) {
      settlements.push({ from: d.name, to: c.name, amount });
      debtors[i] = { ...d, balance: d.balance + amount };
      creditors[j] = { ...c, balance: c.balance - amount };
    }
    if (debtors[i].balance >= -0.01) i++;
    if (creditors[j].balance <= 0.01) j++;
  }

  const allSettled = settlements.length === 0 && total > 0 && n > 0;
  useEffect(() => {
    if (allSettled && !prevAllSettled) {
      setShowConfetti(true);
    }
    setPrevAllSettled(allSettled);
  }, [allSettled, prevAllSettled]);

  const handleShare = async () => {
    if (!shareCardRef.current) return;
    try {
      await downloadCardAsImage(shareCardRef.current, "splanno-split.png");
      toast({ title: "Downloaded!" });
    } catch {
      toast({ title: "Could not export", variant: "destructive" });
    }
  };

  const getAvatarColor = (id: string) =>
    participantColors[id] || "from-primary/80 to-accent/80";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {showConfetti && (
        <ConfettiCelebration onComplete={() => setShowConfetti(false)} reducedMotion={!!shouldReduceMotion} />
      )}

      {/* Demo badge */}
      <div className="bg-primary/10 border-b border-primary/20 py-2 px-4 text-center">
        <p className="text-sm font-medium text-foreground">
          ✨ {t.basic.demoBadge}
        </p>
      </div>

      <header className="border-b border-border py-3 px-4 flex flex-wrap items-center gap-3">
        <Link href="/">
          <a className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" />
            {t.basic.backToLanding}
          </a>
        </Link>
        <SplannoLogo variant="icon" size={36} />
        <span className="font-display font-bold text-primary text-base sm:text-lg truncate">
          {scenarioTitle}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPreference(theme === "dark" ? "light" : "dark")}
            className="p-2 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <label htmlFor="basic-currency" className="text-xs text-muted-foreground whitespace-nowrap">
            {t.bbq.currency}:
          </label>
          <select
            id="basic-currency"
            value={currency}
            onChange={(e) => persistCurrency(e.target.value as CurrencyCode)}
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm text-foreground"
          >
            {CoreCurrencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.symbol} {getCurrencyLabel(c)}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Ghost locked tabs */}
      <div className="border-b border-border px-4 py-2 flex gap-2 overflow-x-auto">
        {LOCKED_TABS.map((tab) => (
          <TooltipProvider key={tab.id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  disabled
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-muted-foreground bg-muted/30 cursor-not-allowed border border-dashed border-border text-sm"
                >
                  <Lock className="w-3.5 h-3.5" />
                  {t.basic[tab.labelKey as keyof typeof t.basic]}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t.basic.availableInFull}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>

      <main className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full space-y-6">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4" />
              {t.basic.whosIn}
            </h2>
            <Button variant="outline" size="sm" onClick={addParticipant}>
              <Plus className="w-4 h-4 mr-1" />
              {t.addPerson}
            </Button>
          </div>
          <ul className="space-y-2">
            {participants.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 p-2 rounded-xl border border-border bg-card/40"
              >
                <div
                  className={`w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarColor(p.id)} flex items-center justify-center text-white font-semibold text-sm shrink-0`}
                >
                  {p.name
                    .trim()
                    .split(/\s/)[0]
                    ?.slice(0, 2)
                    .toUpperCase() || "?"}
                </div>
                <Input
                  placeholder={t.modals.nameLabel}
                  value={p.name}
                  onChange={(e) => updateParticipant(p.id, e.target.value)}
                  className="flex-1 border-0 bg-transparent focus-visible:ring-0"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeParticipant(p.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              {t.basic.whoPaidWhat}
            </h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={cycleScenario}>
                ✨ {t.basic.tryAnotherScenario}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={addExpense}
                disabled={participants.length === 0}
              >
                <Plus className="w-4 h-4 mr-1" />
                {t.addExpense}
              </Button>
            </div>
          </div>
          <ul className="space-y-2">
            {expenses.map((e) => (
              <li
                key={e.id}
                className="flex flex-col gap-2 p-3 rounded-xl bg-card/40 border border-border"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    placeholder={t.modals.itemLabel}
                    value={e.description}
                    onChange={(ev) =>
                      updateExpense(e.id, { description: ev.target.value })
                    }
                    className="w-28 sm:w-32 min-w-0 shrink"
                  />
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder={`${symbol}`}
                    value={e.amount || ""}
                    onChange={(ev) =>
                      updateExpense(e.id, {
                        amount: parseFloat(ev.target.value) || 0,
                      })
                    }
                    className="w-20"
                  />
                  <select
                    value={e.paidById}
                    onChange={(ev) =>
                      updateExpense(e.id, { paidById: ev.target.value })
                    }
                    className="h-9 rounded-lg border border-input bg-background px-2 text-sm flex-1 min-w-[100px]"
                  >
                    {participants.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name || t.modals.nameLabel}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeExpense(e.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <ExpenseReactionBar
                  expenseId={e.id}
                  reactions={getReactions(e.id)}
                  onReact={(emoji) => addReaction(e.id, emoji)}
                  reducedMotion={!!shouldReduceMotion}
                />
              </li>
            ))}
          </ul>
        </section>

        {n > 0 && (
          <section className="rounded-2xl border border-border bg-card/60 p-4 sm:p-5 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t.totalSpent}</span>
              <span className="font-semibold tabular-nums">
                {symbol}
                {total.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t.fairShare}</span>
              <span className="font-semibold tabular-nums">
                {symbol}
                {fairShare.toFixed(2)}
              </span>
            </div>

            {allSettled && (
              <p className="text-center py-4 text-lg font-medium text-green-600 dark:text-green-400">
                {t.basic.allSettledStillFriends} ❤️
              </p>
            )}

            {settlements.length > 0 && (
              <div className="pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2 font-medium">
                  {t.basic.whoOwesWho}
                </p>
                <ul className="space-y-2">
                  {settlements.map((s, i) => (
                    <motion.li
                      key={i}
                      initial={shouldReduceMotion ? undefined : { opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...motionTransition.normal, delay: i * 0.05 }}
                      className="flex items-center gap-2 text-sm p-2 rounded-lg bg-muted/30"
                    >
                      <span className="font-medium text-red-500 dark:text-red-400">
                        {s.from}
                      </span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-medium text-green-600 dark:text-green-400">
                        {s.to}
                      </span>
                      <span className="ml-auto font-semibold tabular-nums">
                        <AnimatedBalance
                          value={s.amount}
                          format={(n) => `${symbol}${n.toFixed(2)}`}
                          reducedMotion={!!shouldReduceMotion}
                        />
                      </span>
                    </motion.li>
                  ))}
                </ul>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              onClick={handleShare}
            >
              <Camera className="w-4 h-4 mr-2" />
              {t.basic.shareSummary}
            </Button>
          </section>
        )}

        {/* Hidden share card for export */}
        <div
          ref={shareCardRef}
          className="absolute -left-[9999px] -top-[9999px] w-[320px]"
          aria-hidden
        >
          <DemoShareCard
              title={scenarioTitle}
              participants={balances.map((b) => ({
                name: b.name,
                balance: b.balance,
                color: getAvatarColor(b.id),
              }))}
              settlements={settlements}
              symbol={symbol}
              total={total}
            />
        </div>

        {/* Demo exit CTA */}
        {!ctaDismissed && (
          <section className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center space-y-4">
            <p className="text-sm font-medium text-foreground">
              {t.basic.readyToUseCta}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="outline" onClick={() => setCtaDismissed(true)}>
                {t.basic.continueWithout}
              </Button>
              <Button asChild>
                <Link href="/login">{t.basic.unlockFull}</Link>
              </Button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
