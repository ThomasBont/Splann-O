import { useState } from "react";
import { useLanguage } from "@/hooks/use-language";
import { useCreateParticipant } from "@/hooks/use-participants";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface AddPersonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddPersonDialog({ open, onOpenChange }: AddPersonDialogProps) {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const createParticipant = useCreateParticipant();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createParticipant.mutate({ name: name.trim() }, {
      onSuccess: () => {
        setName("");
        onOpenChange(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
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
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
            >
              {createParticipant.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {t.modals.add}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
