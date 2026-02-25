import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { SplannoLogo } from "@/components/splanno-logo";
import { Mail } from "lucide-react";

/**
 * Shown after user requests email verification. Instructs them to check inbox.
 */
export default function CheckEmailPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-8 shadow-lg text-center">
        <Mail className="w-12 h-12 text-primary mx-auto mb-4" />
        <div className="flex items-center justify-center gap-2 mb-6">
          <SplannoLogo variant="icon" size={24} />
          <h1 className="font-display font-bold text-lg text-foreground">Check your email</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          We sent a verification link to your email address. Click the link to verify your Splanno account.
        </p>
        <p className="text-xs text-muted-foreground mb-6">
          The link expires in 24 hours. If you don&apos;t see it, check your spam folder.
        </p>
        <Button className="w-full" onClick={() => setLocation("/app")}>
          Back to app
        </Button>
      </div>
    </div>
  );
}
