import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { SplannoLogo } from "@/components/splanno-logo";
import { CheckCircle2 } from "lucide-react";

/**
 * Shown after user clicks verify-email link successfully. Invalid/expired links redirect to /verify-error.
 */
export default function VerifiedPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-8 shadow-lg text-center">
        <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <div className="flex items-center justify-center gap-2 mb-6">
          <SplannoLogo variant="icon" size={24} />
          <h1 className="font-display font-bold text-lg text-foreground">Email verified</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Your email has been verified. You&apos;re all set!
        </p>
        <Button className="w-full" onClick={() => setLocation("/app")}>
          Continue to app
        </Button>
      </div>
    </div>
  );
}
