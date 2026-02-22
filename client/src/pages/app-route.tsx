import { useAuth } from "@/hooks/use-auth";
import Home from "@/pages/home";
import { LoginShell } from "@/pages/login-shell";

/**
 * /app route: show login shell when not authenticated so we never run
 * auth-dependent hooks (useBarbecues, useFriends, etc.) and avoid blank page.
 * When authenticated, render full Home.
 */
export default function AppRoute() {
  const { user, isLoading: isAuthLoading } = useAuth();

  if (!user) {
    return <LoginShell isCheckingAuth={isAuthLoading} />;
  }

  return <Home />;
}
