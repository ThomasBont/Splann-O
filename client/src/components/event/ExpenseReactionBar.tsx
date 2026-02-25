"use client";

import { useMemo, useState, useCallback } from "react";
import { ChevronDown, SmilePlus } from "lucide-react";
import { REACTION_EMOJIS, type ReactionEmoji, type ReactionCounts, type ReactionUsersByEmoji } from "@/hooks/use-expense-reactions";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

interface ExpenseReactionBarProps {
  expenseId: number | string;
  reactions: ReactionCounts;
  onReact: (emoji: ReactionEmoji) => void;
  reactionUsers?: ReactionUsersByEmoji;
  myReaction?: ReactionEmoji | null;
  reducedMotion?: boolean;
  className?: string;
}

export function ExpenseReactionBar({
  expenseId: _expenseId,
  reactions,
  onReact,
  reactionUsers,
  myReaction,
  reducedMotion = false,
  className,
}: ExpenseReactionBarProps) {
  const [poppingEmoji, setPoppingEmoji] = useState<ReactionEmoji | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [emojiSearch, setEmojiSearch] = useState("");

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

  const reactionPills = useMemo(
    () =>
      Object.entries(reactions)
        .filter(([, count]) => (count ?? 0) > 0)
        .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)) as Array<[ReactionEmoji, number]>,
    [reactions]
  );

  const filteredPickerEmojis = useMemo(() => {
    const q = emojiSearch.trim();
    if (!q) return REACTION_EMOJIS;
    return REACTION_EMOJIS.filter((emoji) => emoji.includes(q));
  }, [emojiSearch]);

  return (
    <div
      className={cn("flex items-center gap-1 mt-2 pt-2 border-t border-white/5 flex-wrap", className)}
      role="group"
      aria-label="Reactions"
    >
      {reactionPills.map(([emoji, count]) => {
        const isPopping = !reducedMotion && poppingEmoji === emoji;
        const isMine = myReaction === emoji;
        const users = reactionUsers?.[emoji] ?? [];
        return (
          <Popover key={`pill-${emoji}`}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors border",
                  "border-border/60 bg-muted/30 text-foreground hover:bg-muted/50",
                  isMine && "border-primary/40 bg-primary/10 text-primary"
                )}
                aria-label={`${emoji} reactions`}
              >
                <span
                  className={cn("inline-block", isPopping && "animate-reaction-pop")}
                  style={{ transformOrigin: "center" }}
                >
                  {emoji}
                </span>
                <span className="tabular-nums min-w-[1ch]">{count}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-52 p-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium">{emoji} Reactions</p>
                  <button
                    type="button"
                    onClick={() => handleClick(emoji)}
                    className="text-[11px] text-primary hover:underline"
                  >
                    {isMine ? "Remove mine" : "React"}
                  </button>
                </div>
                {users.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No names yet</p>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {users.map((name, i) => (
                      <div key={`${emoji}-${name}-${i}`} className="text-xs px-2 py-1 rounded bg-muted/40">
                        {name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        );
      })}

      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors border",
              "border-border/60 bg-background/50 text-muted-foreground hover:text-foreground hover:bg-muted/50",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              myReaction && "border-primary/30"
            )}
            aria-label="Add reaction"
          >
            {myReaction ? <span>{myReaction}</span> : <SmilePlus className="w-3.5 h-3.5" />}
            <ChevronDown className="w-3 h-3 opacity-70" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-2">
          <div className="space-y-2">
            <Input
              value={emojiSearch}
              onChange={(e) => setEmojiSearch(e.target.value)}
              placeholder="Search emoji..."
              className="h-8"
            />
            <div className="grid grid-cols-6 gap-1 max-h-52 overflow-y-auto">
              {filteredPickerEmojis.map((emoji) => (
                <button
                  key={`picker-${emoji}`}
                  type="button"
                  onClick={() => {
                    handleClick(emoji);
                    setPickerOpen(false);
                  }}
                  className={cn(
                    "h-9 rounded-md border text-base hover:bg-muted/50 transition-colors",
                    myReaction === emoji ? "border-primary bg-primary/10" : "border-border/60 bg-background/40"
                  )}
                  aria-label={`React with ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
