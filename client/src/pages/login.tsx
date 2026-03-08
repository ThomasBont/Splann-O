import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { AuthDialog } from "@/pages/home";
import { Link } from "wouter";
import { ArrowLeft, Loader2 } from "lucide-react";
import { fetchInvitePreviewByPath, parseInvitePath } from "@/lib/invite-context";

/**
 * Dedicated full-page Login/Sign-up. Redirects to /app on success or when already logged in.
 */
export default function LoginPage() {
  const search = typeof window !== "undefined" ? window.location.search : "";
  const params = new URLSearchParams(search);
  const redirectTo = (() => {
    const raw = params.get("redirect")?.trim() ?? "";
    if (!raw.startsWith("/")) return "/app";
    if (raw.startsWith("//")) return "/app";
    return raw;
  })();
  const [, setLocation] = useLocation();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(true);
  const inviteRedirect = parseInvitePath(redirectTo);
  const { data: inviteContext } = useQuery({
    queryKey: ["/api/auth-invite-context", redirectTo],
    queryFn: () => fetchInvitePreviewByPath(redirectTo),
    enabled: !!inviteRedirect,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    if (!isAuthLoading && user) {
      setLocation(redirectTo);
    }
  }, [redirectTo, user, isAuthLoading, setLocation]);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Redirecting...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="p-4">
        <Link href="/">
          <a className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </a>
        </Link>
      </div>
      <div className="flex-1 flex items-center justify-center px-4 pb-20">
        <AuthDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setLocation("/");
          }}
          isCheckingAuth={false}
          googleRedirectTo={redirectTo}
          inviteContext={inviteContext ?? null}
          onSuccess={() => setLocation(redirectTo)}
        />
      </div>
    </div>
  );
}
