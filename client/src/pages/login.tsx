import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { AuthDialog } from "@/pages/home";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

/**
 * Dedicated full-page Login/Sign-up. Redirects to /app on success or when already logged in.
 */
export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { user, isLoading: isAuthLoading } = useAuth();

  useEffect(() => {
    if (!isAuthLoading && user) {
      setLocation("/app");
    }
  }, [user, isAuthLoading, setLocation]);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground text-sm">{/* loading */}</div>
      </div>
    );
  }

  if (user) {
    return null;
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
          open={true}
          onOpenChange={() => {}}
          isCheckingAuth={false}
          onSuccess={() => setLocation("/app")}
        />
      </div>
    </div>
  );
}
