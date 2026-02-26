"use client";

import type { Balance } from "@/lib/split/calc";
import { AnimatedBalance } from "@/components/event/AnimatedBalance";

export interface IndividualContributionsProps {
  balances: Balance[];
  totalSpent: number;
  formatMoney: (amount: number) => string;
  emptyLabel: string;
  contributionsLabel: string;
  reducedMotion?: boolean;
  warm?: boolean;
}

/** Per-person contribution bars with balance (over/under/even). */
export function IndividualContributions({
  balances,
  totalSpent,
  formatMoney,
  emptyLabel,
  contributionsLabel,
  reducedMotion = false,
  warm = false,
}: IndividualContributionsProps) {
  return (
    <div className={`rounded-[var(--radius-lg)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-4 shadow-[var(--shadow-sm)] ${warm ? "rounded-2xl border-border/60 bg-gradient-to-b from-[hsl(var(--surface-1))] to-[hsl(var(--surface-0))] shadow-sm shadow-neutral-200/40 dark:shadow-black/20 p-[1.1rem]" : ""}`}>
      <h3 className="text-sm font-semibold text-muted-foreground mb-4">{contributionsLabel}</h3>
      {balances.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-4">{warm ? "This circle is quiet… for now 🫶" : emptyLabel}</p>
      ) : (
        <div className={warm ? "space-y-3.5" : "space-y-3"}>
          {balances.map((b) => {
            const isOver = b.balance > 0.01;
            const isUnder = b.balance < -0.01;
            return (
              <div key={b.id} className={`flex items-center gap-3 ${warm ? "rounded-xl px-2 py-1 hover:bg-muted/25 transition-colors" : ""}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium">{b.name}</span>
                    <span className="text-primary font-semibold">{formatMoney(b.paid)}</span>
                  </div>
                  <div className="h-1.5 bg-muted/40 dark:bg-muted/30 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: totalSpent > 0 ? `${Math.min(100, (b.paid / totalSpent) * 100)}%` : "0%" }}
                    />
                  </div>
                </div>
                <div
                  className={`text-xs font-semibold px-2 py-0.5 rounded flex-shrink-0 transition-shadow duration-300 ${
                    isOver
                      ? "bg-green-500/15 text-green-600 dark:text-green-400"
                      : isUnder
                        ? "bg-red-500/15 text-red-600 dark:text-red-400"
                        : "bg-green-500/10 text-green-600 dark:text-green-400 drop-shadow-[0_0_6px_rgba(34,197,94,0.25)]"
                  }`}
                >
                  {isOver ? (
                    <AnimatedBalance
                      value={b.balance}
                      format={(n) => `+${formatMoney(n)}`}
                      reducedMotion={!!reducedMotion}
                      glowWhenZero={false}
                    />
                  ) : isUnder ? (
                    <AnimatedBalance
                      value={b.balance}
                      format={formatMoney}
                      reducedMotion={!!reducedMotion}
                      glowWhenZero={true}
                    />
                  ) : (
                    "✓"
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
