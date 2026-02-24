import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { UpgradeRequiredPayload } from "@/lib/upgrade";

export interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload: UpgradeRequiredPayload | null;
}

function getLimitMessage(payload: UpgradeRequiredPayload | null): string {
  if (!payload?.limits) return "Upgrade to Pro to do this.";
  const { current, max } = payload.limits;
  if (payload.feature === "more_events") {
    return `Free plan allows up to ${max} events. You have ${current}. Upgrade to Pro for unlimited events.`;
  }
  if (payload.feature === "more_participants") {
    return `Free plan allows up to ${max} participants per event. This event has ${current}. Upgrade to Pro for unlimited participants.`;
  }
  return payload.message || "Upgrade to Pro to use this feature.";
}

export function UpgradeModal({ open, onOpenChange, payload }: UpgradeModalProps) {
  const [, setLocation] = useLocation();

  const handleUpgrade = () => {
    onOpenChange(false);
    setLocation("/upgrade");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upgrade to Pro</DialogTitle>
          <DialogDescription>{getLimitMessage(payload)}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleUpgrade}>Upgrade</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
