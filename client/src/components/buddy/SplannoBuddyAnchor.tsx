import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type SplannoBuddyVisualState = "idle" | "nudge" | "expanded" | "celebrate";

export function SplannoBuddyAnchor({
  state,
  chipLabel,
  onClick,
}: {
  state: SplannoBuddyVisualState;
  chipLabel?: string | null;
  onClick: () => void;
}) {
  const isNudging = state === "nudge";
  const isCelebrating = state === "celebrate";

  return (
    <div className="pointer-events-auto relative flex items-center justify-end gap-2">
      {chipLabel ? (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.96 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-[7rem] rounded-full border border-white/65 bg-background/92 px-2.5 py-1 text-[11px] font-medium text-foreground shadow-[0_10px_24px_rgba(15,23,42,0.12)] backdrop-blur dark:border-white/10 dark:bg-[hsl(var(--surface-1))]/92"
        >
          {chipLabel}
        </motion.div>
      ) : null}
      <motion.button
        type="button"
        onClick={onClick}
        aria-label="Open Splann-O"
        className={cn(
          "relative grid h-[52px] w-[52px] place-items-center overflow-hidden rounded-full border border-white/65 bg-[radial-gradient(circle_at_32%_30%,rgba(255,255,255,0.92),rgba(255,255,255,0.25)_32%,rgba(245,166,35,0.18)_58%,rgba(59,130,246,0.15)_100%)] shadow-[0_16px_40px_rgba(15,23,42,0.18)] backdrop-blur-md dark:border-white/10 dark:bg-[radial-gradient(circle_at_32%_30%,rgba(255,255,255,0.2),rgba(255,255,255,0.04)_34%,rgba(245,166,35,0.24)_62%,rgba(59,130,246,0.22)_100%)]",
          isCelebrating && "shadow-[0_18px_48px_rgba(245,166,35,0.28)]",
        )}
        initial={false}
        animate={{
          y: state === "expanded" ? 0 : [0, -5, 0],
          scale: isCelebrating ? [1, 1.12, 0.98, 1] : isNudging ? [1, 1.03, 1] : 1,
          boxShadow: isNudging
            ? [
                "0 16px 40px rgba(15,23,42,0.18)",
                "0 20px 46px rgba(245,166,35,0.26)",
                "0 16px 40px rgba(15,23,42,0.18)",
              ]
            : undefined,
        }}
        transition={{
          y: { duration: 4.6, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" },
          scale: isCelebrating
            ? { duration: 0.72, ease: [0.22, 1, 0.36, 1] }
            : isNudging
              ? { duration: 1.8, repeat: Number.POSITIVE_INFINITY, repeatDelay: 5.5, ease: "easeInOut" }
              : { duration: 0.24 },
          boxShadow: isNudging
            ? { duration: 1.8, repeat: Number.POSITIVE_INFINITY, repeatDelay: 5.5, ease: "easeInOut" }
            : { duration: 0.24 },
        }}
      >
        <span className="absolute inset-[7px] rounded-full bg-[radial-gradient(circle_at_35%_32%,rgba(255,255,255,0.92),rgba(255,255,255,0.28)_34%,rgba(255,255,255,0.02)_100%)] dark:bg-[radial-gradient(circle_at_35%_32%,rgba(255,255,255,0.2),rgba(255,255,255,0.02)_34%,rgba(255,255,255,0.01)_100%)]" />
        <motion.span
          aria-hidden
          className="absolute inset-[12px] rounded-full border border-white/40 dark:border-white/10"
          animate={{
            opacity: isNudging || isCelebrating ? [0.35, 0.7, 0.35] : 0.35,
            scale: isCelebrating ? [1, 1.16, 1] : 1,
          }}
          transition={{
            duration: isCelebrating ? 0.72 : 1.8,
            repeat: isNudging ? Number.POSITIVE_INFINITY : 0,
            repeatDelay: 5.5,
            ease: "easeInOut",
          }}
        />
        <span className="relative h-3.5 w-3.5 rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(255,255,255,0.3))] shadow-[0_0_22px_rgba(255,255,255,0.55)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(255,255,255,0.18))]" />
      </motion.button>
    </div>
  );
}
