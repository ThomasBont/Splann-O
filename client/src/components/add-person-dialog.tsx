import { useState } from "react";
import { useLanguage } from "@/hooks/use-language";
import { useCreateParticipant } from "@/hooks/use-participants";
import { useUpgrade } from "@/contexts/UpgradeContext";
import { UpgradeRequiredError } from "@/lib/upgrade";
import { Modal } from "@/components/ui/modal";
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
  const { showUpgrade } = useUpgrade();
  const [name, setName] = useState("");
  const createParticipant = useCreateParticipant(bbqId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !bbqId) return;

    createParticipant.mutate({ name: name.trim() }, {
      onSuccess: () => {
        setName("");
        onOpenChange(false);
      },
      onError: (err: unknown) => {
        if (err instanceof UpgradeRequiredError) showUpgrade(err.payload);
      },
    });
  };

  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      onOpenChange={onOpenChange}
      title={t.modals.addPersonTitle}
      size="md"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t.modals.cancel}
          </Button>
          <Button
            type="submit"
            form="add-person-form"
            disabled={createParticipant.isPending || !name.trim()}
            className="min-w-[118px] bg-primary text-primary-foreground font-bold"
            data-testid="button-submit-person"
          >
            {createParticipant.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : <span className="inline-block h-4 w-4 mr-2" aria-hidden />}
            {createParticipant.isPending ? "Adding..." : t.modals.add}
          </Button>
        </>
      }
      data-testid="modal-add-person"
    >
      <form id="add-person-form" onSubmit={handleSubmit} className="space-y-4">
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
      </form>
    </Modal>
  );
}
