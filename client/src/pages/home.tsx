import { useState } from "react";
import { useLanguage } from "@/hooks/use-language";
import { useParticipants, useDeleteParticipant } from "@/hooks/use-participants";
import { useExpenses, useDeleteExpense } from "@/hooks/use-expenses";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddPersonDialog } from "@/components/add-person-dialog";
import { AddExpenseDialog } from "@/components/add-expense-dialog";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { 
  Users, Receipt, Wallet, Scale, Trash2, Edit2, 
  Flame, Plus, ArrowRight, CheckCircle2 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { ExpenseWithParticipant } from "@shared/schema";

// Helper to format currency
const formatMoney = (amount: number) => 
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const CATEGORY_COLORS: Record<string, string> = {
  Meat: '#e05c2a',         // Accent Orange
  Bread: '#f0c040',        // Primary Gold
  Drinks: '#3b82f6',       // Blue
  Charcoal: '#64748b',     // Slate
  Transportation: '#10b981', // Emerald
  Other: '#a855f7'         // Purple
};

const CATEGORY_ICONS: Record<string, string> = {
  Meat: '🥩', Bread: '🍞', Drinks: '🍺', Charcoal: '🔥', Transportation: '🚗', Other: '📦'
};

export default function Home() {
  const { language, setLanguage, t } = useLanguage();
  
  // Dialog States
  const [isAddPersonOpen, setIsAddPersonOpen] = useState(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseWithParticipant | null>(null);

  // Data Queries
  const { data: participants = [], isLoading: isLoadingParticipants } = useParticipants();
  const { data: expenses = [], isLoading: isLoadingExpenses } = useExpenses();
  const deleteParticipant = useDeleteParticipant();
  const deleteExpense = useDeleteExpense();

  // Calculations
  const totalSpent = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
  const participantCount = participants.length;
  const fairShare = participantCount > 0 ? totalSpent / participantCount : 0;

  // Chart Data Preparation
  const expensesByCategory = expenses.reduce((acc, exp) => {
    acc[exp.category] = (acc[exp.category] || 0) + Number(exp.amount);
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(expensesByCategory).map(([name, value]) => ({
    name,
    value,
    translatedName: t.categories[name as keyof typeof t.categories]
  })).filter(d => d.value > 0);

  // Settlement Calculation
  const calculateSettlements = () => {
    if (participantCount === 0) return [];
    
    const balances = participants.map(p => {
      const paid = expenses
        .filter(e => e.participantId === p.id)
        .reduce((sum, e) => sum + Number(e.amount), 0);
      return { ...p, paid, balance: paid - fairShare };
    });

    const debtors = balances
      .filter(b => b.balance < -0.01)
      .sort((a, b) => a.balance - b.balance); // Ascending (most negative first)
      
    const creditors = balances
      .filter(b => b.balance > 0.01)
      .sort((a, b) => b.balance - a.balance); // Descending (most positive first)

    const settlements = [];
    let i = 0; // debtor index
    let j = 0; // creditor index

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      
      const amount = Math.min(Math.abs(debtor.balance), creditor.balance);
      
      if (amount > 0.01) {
        settlements.push({
          from: debtor.name,
          to: creditor.name,
          amount
        });
      }

      debtor.balance += amount;
      creditor.balance -= amount;

      if (Math.abs(debtor.balance) < 0.01) i++;
      if (creditor.balance < 0.01) j++;
    }

    return { balances, settlements };
  };

  const { balances, settlements } = calculateSettlements();

  const handleEditExpense = (expense: ExpenseWithParticipant) => {
    setEditingExpense(expense);
    setIsAddExpenseOpen(true);
  };

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-primary to-accent p-2 rounded-lg shadow-lg shadow-orange-500/20">
              <Flame className="w-6 h-6 text-white" fill="currentColor" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold font-display text-primary tracking-tight">
                {t.title}
              </h1>
              <p className="hidden sm:block text-xs text-muted-foreground uppercase tracking-widest font-medium">
                {t.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLanguage(language === "en" ? "es" : "en")}
              className="hidden sm:flex border-white/10 hover:bg-white/5"
            >
              {language === "en" ? "🇪🇸 ES" : "🇺🇸 EN"}
            </Button>
            
            <div className="flex gap-2">
              <Button 
                onClick={() => setIsAddPersonOpen(true)}
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold shadow-lg shadow-primary/20"
              >
                <Plus className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">{t.addPerson}</span>
              </Button>
              <Button 
                onClick={() => setIsAddExpenseOpen(true)}
                className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold shadow-lg shadow-accent/20"
              >
                <Plus className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">{t.addExpense}</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
            value={formatMoney(fairShare)} 
            icon={<Scale />} 
            color="green"
          />
        </div>

        {/* Participants Chips */}
        {participants.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap gap-3"
          >
            {participants.map((p) => (
              <div 
                key={p.id}
                className="group flex items-center gap-3 pl-4 pr-2 py-2 rounded-full bg-secondary/50 border border-white/5 hover:border-primary/50 transition-colors"
              >
                <span className="font-medium text-sm">{p.name}</span>
                <button 
                  onClick={() => deleteParticipant.mutate(p.id)}
                  className="p-1.5 rounded-full hover:bg-white/10 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </motion.div>
        )}

        {/* Main Content Tabs */}
        <Tabs defaultValue="expenses" className="w-full">
          <div className="flex justify-center mb-8">
            <TabsList className="bg-secondary/50 p-1 border border-white/5 rounded-xl">
              <TabsTrigger 
                value="expenses"
                className="px-8 py-2.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold transition-all"
              >
                {t.tabs.expenses}
              </TabsTrigger>
              <TabsTrigger 
                value="split"
                className="px-8 py-2.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold transition-all"
              >
                {t.tabs.split}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="expenses" className="space-y-6 focus-visible:outline-none">
            {expenses.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <div className="inline-flex p-6 rounded-full bg-secondary/30 mb-6">
                  <Flame className="w-12 h-12 text-muted-foreground/50" />
                </div>
                <h3 className="text-xl font-bold mb-2">{t.emptyState.title}</h3>
                <p>{t.emptyState.subtitle}</p>
              </div>
            ) : (
              <div className="grid lg:grid-cols-3 gap-8">
                {/* Expenses List */}
                <div className="lg:col-span-2 space-y-4">
                  <AnimatePresence>
                    {expenses.map((expense) => (
                      <motion.div
                        key={expense.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="group flex items-center justify-between p-4 rounded-xl bg-card border border-white/5 hover:border-white/10 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center text-2xl select-none">
                            {CATEGORY_ICONS[expense.category] || '📦'}
                          </div>
                          <div>
                            <div className="font-semibold">{expense.item}</div>
                            <div className="text-sm text-muted-foreground">
                              {expense.participantName} • {t.categories[expense.category as keyof typeof t.categories]}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-lg font-bold font-mono text-primary">
                            {formatMoney(Number(expense.amount))}
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-8 w-8 hover:bg-white/10"
                              onClick={() => handleEditExpense(expense)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-8 w-8 hover:bg-white/10 hover:text-destructive"
                              onClick={() => deleteExpense.mutate(expense.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {/* Pie Chart Panel */}
                <div className="bg-card border border-white/5 rounded-2xl p-6 h-fit sticky top-24">
                  <h3 className="text-lg font-bold font-display text-primary mb-6">Breakdown</h3>
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData}
                          innerRadius={60}
                          outerRadius={80}
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
                  
                  <div className="space-y-3 mt-4">
                    {chartData.map((item) => (
                      <div key={item.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: CATEGORY_COLORS[item.name] }}
                          />
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
            <div className="grid md:grid-cols-2 gap-8">
              {/* Individual Contributions */}
              <div className="bg-card border border-white/5 rounded-2xl p-6">
                <h3 className="text-xl font-bold font-display text-primary mb-6">
                  {t.split.contributions}
                </h3>
                <div className="space-y-4">
                  {balances && balances.map((b) => (
                    <div key={b.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/20">
                      <div>
                        <div className="font-bold">{b.name}</div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider">
                          {b.balance > 0 ? 'Overpaid' : 'Underpaid'}
                        </div>
                      </div>
                      <div className={`font-mono font-bold ${b.balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {b.balance > 0 ? '+' : ''}{formatMoney(b.balance)}
                      </div>
                    </div>
                  ))}
                  {balances && balances.length === 0 && (
                    <p className="text-muted-foreground italic">No participants yet.</p>
                  )}
                </div>
              </div>

              {/* Settlement Plan */}
              <div className="bg-card border border-white/5 rounded-2xl p-6">
                <h3 className="text-xl font-bold font-display text-accent mb-6">
                  {t.split.settlement}
                </h3>
                <div className="space-y-4">
                  {settlements && settlements.length > 0 ? (
                    settlements.map((s, i) => (
                      <div key={i} className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-secondary/40 to-transparent border border-white/5">
                        <span className="font-bold text-red-400">{s.from}</span>
                        <div className="flex-1 flex flex-col items-center">
                          <span className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">{t.split.owes}</span>
                          <div className="h-[1px] w-full bg-white/10 relative">
                            <ArrowRight className="absolute -right-1 -top-1.5 w-3 h-3 text-muted-foreground" />
                          </div>
                        </div>
                        <span className="font-bold text-green-400">{s.to}</span>
                        <div className="ml-2 font-mono font-bold text-primary bg-primary/10 px-3 py-1 rounded-md">
                          {formatMoney(s.amount)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-10">
                      <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium text-green-400">{t.split.allSettled}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

      </main>

      {/* Modals */}
      <AddPersonDialog 
        open={isAddPersonOpen} 
        onOpenChange={setIsAddPersonOpen} 
      />
      
      <AddExpenseDialog 
        open={isAddExpenseOpen} 
        onOpenChange={(open) => {
          setIsAddExpenseOpen(open);
          if (!open) setEditingExpense(null);
        }}
        editingExpense={editingExpense}
      />
    </div>
  );
}
