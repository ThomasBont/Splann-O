"use client";

import { cn } from "@/lib/utils";

const AVATAR_GRADIENTS = [
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-emerald-500 to-teal-600",
  "from-blue-500 to-indigo-600",
  "from-violet-500 to-purple-600",
];

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s/)
    .map((s) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";
}

export interface DemoShareCardProps {
  title: string;
  participants: { name: string; balance: number; color?: string }[];
  settlements: { from: string; to: string; amount: number }[];
  symbol: string;
  total?: number;
  className?: string;
}

export function DemoShareCard({
  title,
  participants,
  settlements,
  symbol,
  total,
  className,
}: DemoShareCardProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-[#1a1a1e] via-[#1e1e28] to-[#16161d] shadow-2xl p-6 w-[320px]",
        "shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_20px_50px_-12px_rgba(0,0,0,0.5)]",
        className
      )}
      data-demo-share-card
    >
      <div className="h-1.5 w-full rounded-full bg-gradient-to-r from-primary/80 via-amber-500/70 to-accent/80 mb-4" />
      <h2 className="text-lg font-bold text-white tracking-tight mb-3">{title}</h2>
      {total != null && (
        <p className="text-xl font-bold text-white/95 mb-4">
          {symbol}
          {total.toFixed(2)} total
        </p>
      )}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {participants.slice(0, 6).map((p, i) => (
          <div
            key={i}
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white bg-gradient-to-br flex-shrink-0",
              AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length]
            )}
            title={p.name}
          >
            {getInitials(p.name)}
          </div>
        ))}
      </div>
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
        <p className="text-xs text-white/50 font-medium tracking-wide">Split smart with Splanno</p>
      </footer>
    </div>
  );
}
