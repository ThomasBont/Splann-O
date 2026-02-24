"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export interface SettleUpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  pending?: boolean;
  title: string;
  body1: string;
  body2: string;
  body3: string;
  cancel: string;
  sendSummary: string;
}

export function SettleUpModal({
  open,
  onOpenChange,
  onConfirm,
  pending,
  title,
  body1,
  body2,
  body3,
  cancel,
  sendSummary,
}: SettleUpModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground mb-2">This will:</p>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
            {body1}
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
            {body2}
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
            {body3}
          </li>
        </ul>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {cancel}
          </Button>
          <Button onClick={onConfirm} disabled={pending}>
            {sendSummary}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
