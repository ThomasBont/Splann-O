import { useState } from "react";
import { useLanguage } from "@/hooks/use-language";
import { useCreateParticipant } from "@/hooks/use-participants";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { DraggableDialogContent } from "@/components/ui/draggable-dialog-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface AddPersonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bbqId: number | null;
}

export function AddPersonDialog({ open, onOpenChange, bbqId }: AddPersonDialogProps) {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const createParticipant = useCreateParticipant(bbqId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !bbqId) return;

    createParticipant.mutate({ name: name.trim() }, {
      onSuccess: () => {
        setName("");
        onOpenChange(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DraggableDialogContent className="sm:max-w-md bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-display text-primary">{t.modals.addPersonTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="uppercase text-xs tracking-wider text-muted-foreground">
              {t.modals.nameLabel}
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex"
              className="bg-secondary/50 border-white/10 focus-visible:ring-primary/50"
              autoFocus
              data-testid="input-person-name"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              {t.modals.cancel}
            </Button>
            <Button
              type="submit"
              disabled={createParticipant.isPending || !name.trim()}
              className="bg-primary text-primary-foreground font-bold"
              data-testid="button-submit-person"
            >
              {createParticipant.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {t.modals.add}
            </Button>
          </DialogFooter>
        </form>
      </DraggableDialogContent>
    </Dialog>
  );
}
