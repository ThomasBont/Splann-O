import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { LanguageProvider } from "@/hooks/use-language";
import { ThemeProvider } from "@/hooks/use-theme";
import { UpgradeProvider } from "@/contexts/UpgradeContext";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import ThemeGalleryPage from "@/pages/theme-gallery";
import Basic from "@/pages/basic";
import LoginPage from "@/pages/login";
import AppRoute from "@/pages/app-route";
import ResetPassword from "@/pages/reset-password";
import JoinPage from "@/pages/join";
import UpgradePage from "@/pages/upgrade";
import CheckEmailPage from "@/pages/check-email";
import VerifiedPage from "@/pages/verified";
import VerifyErrorPage from "@/pages/verify-error";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/join/:token" component={JoinPage} />
      <Route path="/basic" component={Basic} />
      <Route path="/login" component={LoginPage} />
      <Route path="/app" component={AppRoute} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/check-email" component={CheckEmailPage} />
      <Route path="/verified" component={VerifiedPage} />
      <Route path="/verify-error" component={VerifyErrorPage} />
      <Route path="/theme-gallery" component={ThemeGalleryPage} />
      <Route path="/upgrade" component={UpgradePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          <UpgradeProvider>
            <Router />
            <Toaster />
          </UpgradeProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
