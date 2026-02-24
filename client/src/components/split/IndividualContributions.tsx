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
}

/** Per-person contribution bars with balance (over/under/even). */
export function IndividualContributions({
  balances,
  totalSpent,
  formatMoney,
  emptyLabel,
  contributionsLabel,
  reducedMotion = false,
}: IndividualContributionsProps) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-4 shadow-[var(--shadow-sm)]">
      <h3 className="text-sm font-semibold text-muted-foreground mb-4">{contributionsLabel}</h3>
      {balances.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-4">{emptyLabel}</p>
      ) : (
        <div className="space-y-3">
          {balances.map((b) => {
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
