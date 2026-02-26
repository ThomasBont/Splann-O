"use client";

import { CheckCircle2, ArrowRight } from "lucide-react";
import type { Settlement } from "@/lib/split/calc";
import { ShareSettlementWithMenu } from "@/components/share/ShareSettlementWithMenu";
import type { SettleCardData } from "@/utils/shareCard";
import type { ThemeToken } from "@/theme/eventThemes";

export interface SettlementPlanProps {
  settlements: Settlement[];
  allSettledLabel: string;
  owesLabel: string;
  settlementLabel: string;
  formatMoney: (amount: number) => string;
  getSettleCardData: (s: Settlement) => SettleCardData;
  getEventTheme: () => ThemeToken;
  shareLink: string | null;
  shareLabels: {
    share: string;
    shareWhatsApp: string;
    shareMore: string;
    downloadPng: string;
    copyImage: string;
    copyImageUnsupported: string;
    copyShareLink: string;
    copied: string;
    downloaded: string;
    shared: string;
    error: string;
  };
  warm?: boolean;
}

/** Settlement plan list with per-row share menu. */
export function SettlementPlan({
  settlements,
  allSettledLabel,
  owesLabel,
  settlementLabel,
  formatMoney,
  getSettleCardData,
  getEventTheme,
  shareLink,
  shareLabels,
  warm = false,
}: SettlementPlanProps) {
  return (
    <div className={`rounded-[var(--radius-lg)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-4 shadow-[var(--shadow-sm)] ${warm ? "rounded-2xl border-border/60 bg-gradient-to-b from-[hsl(var(--surface-1))] to-[hsl(var(--surface-0))] shadow-sm shadow-neutral-200/40 dark:shadow-black/20 p-[1.1rem]" : ""}`}>
      <h3 className="text-sm font-semibold text-muted-foreground mb-4">{settlementLabel}</h3>
      {settlements.length === 0 ? (
        <div className={`text-center py-4 text-muted-foreground ${warm ? "rounded-2xl bg-emerald-500/5 border border-emerald-500/15" : ""}`}>
          <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-400 opacity-70" />
          <p className="text-sm">{warm ? "All settled. Still friends 🫶" : allSettledLabel}</p>
        </div>
      ) : (
        <div className={warm ? "space-y-2.5" : "space-y-2"}>
          {settlements.map((s, i) => {
            const eventTheme = getEventTheme();
            const settleCardData = getSettleCardData(s);
            return (
              <div
                key={i}
                className={`group relative flex flex-col gap-2 border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-2))]/50 rounded-[var(--radius-md)] px-3 py-2.5 ${warm ? "rounded-2xl border-border/60 shadow-sm shadow-neutral-200/25 dark:shadow-black/10 hover:scale-[1.01] transition-transform duration-150 motion-reduce:transition-none" : ""}`}
                data-testid={`settlement-${i}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <ArrowRight className="w-4 h-4 text-red-400" />
                  </div>
                  <div className="flex-1 text-sm min-w-0">
                    <span className="font-bold text-red-400">{s.from}</span>
                    <span className="text-muted-foreground mx-2">{owesLabel}</span>
                    <span className="font-bold text-green-400">{s.to}</span>
                  </div>
                  <span className="font-bold text-primary flex-shrink-0">{formatMoney(s.amount)}</span>
                  <div className="flex-shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <ShareSettlementWithMenu
                      data={settleCardData}
                      theme={eventTheme}
                      shareLink={shareLink}
                      labels={shareLabels}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
