import { useState, useMemo } from "react";
import { useLanguage, CURRENCIES, type CurrencyCode } from "@/hooks/use-language";
import { useTheme } from "@/hooks/use-theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { SplannoLogo } from "@/components/splanno-logo";
import { ArrowLeft, Plus, Trash2, Receipt, Users, Sun, Moon } from "lucide-react";

type Participant = { id: string; name: string };
type Expense = { id: string; description: string; amount: number; paidById: string };

const STORAGE_KEY = "basic-split-data";
const STORAGE_KEY_CURRENCY = "basic-currency";

function loadStored(): { participants: Participant[]; expenses: Expense[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { participants: [], expenses: [] };
    const data = JSON.parse(raw);
    return {
      participants: Array.isArray(data.participants) ? data.participants : [],
      expenses: Array.isArray(data.expenses) ? data.expenses : [],
    };
  } catch {
    return { participants: [], expenses: [] };
  }
}

function saveStored(participants: Participant[], expenses: Expense[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ participants, expenses }));
  } catch {}
}

function loadStoredCurrency(): CurrencyCode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CURRENCY);
    if (raw && CURRENCIES.some((c) => c.code === raw)) return raw as CurrencyCode;
  } catch {}
  return "EUR";
}

function uuid() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getCurrencyLabel(cur: (typeof CURRENCIES)[0], lang: string): string {
  if (lang === "es") return cur.labelEs;
  if (lang === "it") return cur.labelIt;
  if (lang === "nl") return cur.labelNl;
  return cur.label;
}

export default function Basic() {
  const { t, language } = useLanguage();
  const { theme, setPreference } = useTheme();
  const [participants, setParticipants] = useState<Participant[]>(() => loadStored().participants);
  const [expenses, setExpenses] = useState<Expense[]>(() => loadStored().expenses);
  const [currency, setCurrency] = useState<CurrencyCode>(loadStoredCurrency);

  const { symbol } = CURRENCIES.find((c) => c.code === currency) ?? CURRENCIES[0];

  const persistCurrency = (code: CurrencyCode) => {
    setCurrency(code);
    try {
      localStorage.setItem(STORAGE_KEY_CURRENCY, code);
    } catch {}
  };

  useMemo(() => saveStored(participants, expenses), [participants, expenses]);

  const addParticipant = () => {
    setParticipants((p) => [...p, { id: uuid(), name: "" }]);
  };

  const updateParticipant = (id: string, name: string) => {
    setParticipants((p) => p.map((x) => (x.id === id ? { ...x, name } : x)));
  };

  const removeParticipant = (id: string) => {
    setParticipants((p) => p.filter((x) => x.id !== id));
    setExpenses((e) => e.filter((x) => x.paidById !== id));
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
  const creditors = balances.filter((b) => b.balance > 0.01).sort((a, b) => b.balance - a.balance);

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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border py-3 px-4 flex flex-wrap items-center gap-3">
        <Link href="/">
          <a className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" />
            {t.basic.backToLanding}
          </a>
        </Link>
        <SplannoLogo variant="icon" size={28} />
        <span className="font-display font-bold text-primary truncate">{t.basic.pageTitle}</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPreference(theme === "dark" ? "light" : "dark")}
            className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
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
            className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.symbol} {getCurrencyLabel(c, language)}
              </option>
            ))}
          </select>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full space-y-6">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4" />
              {t.participants}
            </h2>
            <Button variant="outline" size="sm" onClick={addParticipant}>
              <Plus className="w-4 h-4 mr-1" />
              {t.addPerson}
            </Button>
          </div>
          <ul className="space-y-2">
            {participants.map((p) => (
              <li key={p.id} className="flex items-center gap-2">
                <Input
                  placeholder={t.modals.nameLabel}
                  value={p.name}
                  onChange={(e) => updateParticipant(p.id, e.target.value)}
                  className="flex-1"
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
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              {t.expenses}
            </h2>
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
          <ul className="space-y-2">
            {expenses.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-card/40 border border-border">
                <Input
                  placeholder={t.modals.itemLabel}
                  value={e.description}
                  onChange={(ev) => updateExpense(e.id, { description: ev.target.value })}
                  className="w-32 min-w-0 shrink"
                />
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder={`${t.modals.amountLabel} (${symbol})`}
                  value={e.amount || ""}
                  onChange={(ev) =>
                    updateExpense(e.id, { amount: parseFloat(ev.target.value) || 0 })
                  }
                  className="w-24"
                />
                <select
                  value={e.paidById}
                  onChange={(ev) => updateExpense(e.id, { paidById: ev.target.value })}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
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
              </li>
            ))}
          </ul>
        </section>

        {n > 0 && (
          <section className="rounded-2xl border border-border bg-card/60 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t.totalSpent}</span>
              <span className="font-medium">{symbol}{total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t.fairShare}</span>
              <span className="font-medium">{symbol}{fairShare.toFixed(2)}</span>
            </div>
            {settlements.length > 0 && (
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">{t.split.settlement}</p>
                <ul className="space-y-1 text-sm">
                  {settlements.map((s, i) => (
                    <li key={i}>
                      <strong>{s.from}</strong> {t.split.owes} <strong>{s.to}</strong>: {symbol}
                      {s.amount.toFixed(2)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {settlements.length === 0 && total > 0 && n > 0 && (
              <p className="text-xs text-muted-foreground pt-2">{t.split.allSettled}</p>
            )}
          </section>
        )}

        <aside className="min-h-[80px] rounded-xl border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground">
          {t.basic.adPlaceholder}
        </aside>
      </main>
    </div>
  );
}
