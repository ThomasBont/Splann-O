import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { SplannoLogo } from "@/components/splanno-logo";
import { AlertCircle } from "lucide-react";

/**
 * Shown when user clicks an invalid or expired verify-email link.
 */
export default function VerifyErrorPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-8 shadow-lg text-center">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
        <div className="flex items-center justify-center gap-2 mb-6">
          <SplannoLogo variant="icon" size={24} />
          <h1 className="font-display font-bold text-lg text-foreground">Link invalid or expired</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          This verification link is invalid or has expired. Request a new one from your profile or the app banner.
        </p>
        <Button className="w-full" onClick={() => setLocation("/app")}>
          Back to app
        </Button>
      </div>
    </div>
  );
}
