import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import type { SplannoBuddyAction, SplannoBuddyModel } from "@/lib/splanno-buddy";
import { SplannoBuddyAnchor, type SplannoBuddyVisualState } from "@/components/buddy/SplannoBuddyAnchor";
import { SplannoBuddyCard } from "@/components/buddy/SplannoBuddyCard";

export function SplannoBuddyLayer({
  model,
  onAction,
  className = "",
  bottomOffset = "calc(env(safe-area-inset-bottom) + 5.75rem)",
}: {
  model: SplannoBuddyModel;
  onAction: (action: SplannoBuddyAction) => void;
  className?: string;
  bottomOffset?: string;
}) {
  const [open, setOpen] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const seenMilestoneRef = useRef<string | null>(null);

  useEffect(() => {
    if (!model.milestoneKey || seenMilestoneRef.current === model.milestoneKey) return;
    seenMilestoneRef.current = model.milestoneKey;
    setCelebrating(true);
    const timer = window.setTimeout(() => setCelebrating(false), 820);
    return () => window.clearTimeout(timer);
  }, [model.milestoneKey]);

  const visualState = useMemo<SplannoBuddyVisualState>(() => {
    if (celebrating || model.intent === "celebrate") return "celebrate";
    if (open) return "expanded";
    return model.presenceState === "nudge" ? "nudge" : "idle";
  }, [celebrating, model.intent, model.presenceState, open]);

  return (
    <div
      className={`pointer-events-none fixed right-4 z-30 lg:hidden ${className}`}
      style={{ bottom: bottomOffset }}
    >
      <div className="flex flex-col items-end gap-3">
        <AnimatePresence>
          {open ? (
            <SplannoBuddyCard
              intent={model.intent}
              title={model.title}
              summary={model.summary}
              primaryAttention={model.primaryAttention}
              stats={model.stats}
              actions={model.actions}
              onAction={(action) => {
                onAction(action);
                setOpen(false);
              }}
            />
          ) : null}
        </AnimatePresence>
        <SplannoBuddyAnchor
          state={visualState}
          chipLabel={!open && model.presenceState === "nudge" ? model.chipLabel : null}
          onClick={() => setOpen((prev) => !prev)}
        />
      </div>
    </div>
  );
}
