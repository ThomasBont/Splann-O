"use client";

import { cn } from "@/lib/utils";

export interface DemoShareCardProps {
  title: string;
  participants: { name: string; balance: number; color?: string }[];
  settlements: { from: string; to: string; amount: number }[];
  symbol: string;
  className?: string;
}

export function DemoShareCard({
  title,
  participants,
  settlements,
  symbol,
  className,
}: DemoShareCardProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#1a1a1e] via-[#252530] to-[#1a1a1e] shadow-xl p-6 w-[320px]",
        className
      )}
      data-demo-share-card
    >
      <div className="h-1.5 w-full opacity-80 bg-gradient-to-r from-primary/70 via-accent/60 to-primary/70 rounded mb-4" />
      <h2 className="text-lg font-bold text-white tracking-tight mb-4">{title}</h2>
      <div className="space-y-2 mb-4">
        {participants.map((p, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <span className="text-white/90">{p.name}</span>
            <span className={p.balance >= 0 ? "text-green-400" : "text-red-400"}>
              {p.balance >= 0 ? "+" : ""}
              {symbol}
              {Math.abs(p.balance).toFixed(2)}
            </span>
          </div>
        ))}
      </div>
      {settlements.length > 0 && (
        <div className="pt-3 border-t border-white/10 space-y-1">
          {settlements.map((s, i) => (
            <p key={i} className="text-xs text-white/70">
              {s.from} → {s.to}: {symbol}
              {s.amount.toFixed(2)}
            </p>
          ))}
        </div>
      )}
      <footer className="mt-4 pt-3 border-t border-white/10">
        <p className="text-xs text-white/50 font-medium">Split smart with Splanno</p>
      </footer>
    </div>
  );
}
