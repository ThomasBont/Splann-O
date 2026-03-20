import { useEffect, useMemo, useRef, useState } from "react";
import type { SplannoBuddyAction, SplannoBuddyModel } from "@/lib/splanno-buddy";
import { SplannoBuddyAnchor, type SplannoBuddyVisualState } from "@/components/buddy/SplannoBuddyAnchor";

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
    return model.presenceState === "nudge" ? "nudge" : "idle";
  }, [celebrating, model.intent, model.presenceState]);

  return (
    <div
      className={`pointer-events-none fixed right-4 z-30 lg:hidden ${className}`}
      style={{ bottom: bottomOffset }}
    >
      <div className="flex flex-col items-end gap-3">
        <SplannoBuddyAnchor
          state={visualState}
          chipLabel={model.presenceState === "nudge" ? model.chipLabel : null}
          onClick={() => onAction({ id: "buddy-ai-assistant", label: "AI Assistant", intent: "ai-assistant" })}
        />
      </div>
    </div>
  );
}
