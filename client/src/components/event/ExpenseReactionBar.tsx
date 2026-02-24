"use client";

import { useState, useCallback } from "react";
import { REACTION_EMOJIS, type ReactionEmoji, type ReactionCounts } from "@/hooks/use-expense-reactions";
import { cn } from "@/lib/utils";

interface ExpenseReactionBarProps {
  expenseId: number | string;
  reactions: ReactionCounts;
  onReact: (emoji: ReactionEmoji) => void;
  reducedMotion?: boolean;
  className?: string;
}

export function ExpenseReactionBar({
  expenseId,
  reactions,
  onReact,
  reducedMotion = false,
  className,
}: ExpenseReactionBarProps) {
  const [poppingEmoji, setPoppingEmoji] = useState<ReactionEmoji | null>(null);

  const handleClick = useCallback(
    (emoji: ReactionEmoji) => {
      onReact(emoji);
      if (!reducedMotion) {
        setPoppingEmoji(emoji);
        const t = setTimeout(() => setPoppingEmoji(null), 400);
        return () => clearTimeout(t);
      }
    },
    [onReact, reducedMotion]
  );

  return (
    <div
      className={cn("flex items-center gap-1 mt-2 pt-2 border-t border-white/5 flex-wrap", className)}
      role="group"
      aria-label="Reactions"
    >
      {REACTION_EMOJIS.map((emoji) => {
        const count = reactions[emoji] ?? 0;
        const show = count > 0;
        const isPopping = !reducedMotion && poppingEmoji === emoji;
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => handleClick(emoji)}
            className={cn(
              "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium transition-colors",
              "text-muted-foreground hover:text-foreground hover:bg-muted/50",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              show && "text-foreground"
            )}
            aria-label={`React with ${emoji}`}
          >
            <span
              className={cn(
                "inline-block",
                isPopping && "animate-reaction-pop"
              )}
              style={{ transformOrigin: "center" }}
            >
              {emoji}
            </span>
            {count > 0 && (
              <span className="tabular-nums min-w-[1ch]">{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
