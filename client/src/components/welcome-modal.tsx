import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/use-language";
import { SplannoLogo } from "@/components/splanno-logo";
import { Sparkles } from "lucide-react";

type WelcomeModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  onGetStarted: () => void;
};

export function WelcomeModal({
  open,
  onOpenChange,
  userName,
  onGetStarted,
}: WelcomeModalProps) {
  const { t } = useLanguage();
  const displayName = userName || t.user.hi;

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      onGetStarted();
    }
    onOpenChange(nextOpen);
  };

  const titleText = t.welcome.title.replace("{name}", displayName);

  return (
    <Modal
      open={open}
      onClose={() => handleClose(false)}
      onOpenChange={handleClose}
      size="md"
      className="border-primary/20 bg-gradient-to-b from-background to-card"
      data-testid="modal-welcome"
    >
      <div className="space-y-4 text-center">
        {/* Decorative - pointer-events-none */}
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-orange-500/20 [--brand-secondary:0_0%_100%] pointer-events-none"
          aria-hidden
        >
          <SplannoLogo variant="icon" size={40} />
        </div>
        <div className="flex items-center justify-center gap-1.5 text-primary">
          <Sparkles className="h-4 w-4" />
          <h2 className="text-xl font-display font-bold">
            {titleText}
          </h2>
          <Sparkles className="h-4 w-4" />
        </div>
        <p className="text-left text-sm text-muted-foreground">
          {t.welcome.description}
        </p>
        <div className="flex justify-center pt-2">
          <Button
            onClick={() => handleClose(false)}
            className="min-w-[180px] bg-primary font-bold text-primary-foreground shadow-md shadow-orange-500/20 hover:bg-primary/90"
            data-testid="button-welcome-get-started"
          >
            {t.welcome.getStarted}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
