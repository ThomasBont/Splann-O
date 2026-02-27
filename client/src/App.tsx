import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { LanguageProvider } from "@/hooks/use-language";
import { ThemeProvider } from "@/hooks/use-theme";
import { UpgradeProvider } from "@/contexts/UpgradeContext";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import LandingV2 from "@/pages/landing-v2";
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
import SettingsPage from "@/pages/settings";
import ExplorePage from "@/pages/explore";
import PublicEventPage from "@/pages/public-event";
import PublicProfilePage from "@/pages/public-profile";

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingV2} />
      <Route path="/join/:token" component={JoinPage} />
      <Route path="/basic" component={Basic} />
      <Route path="/login" component={LoginPage} />
      <Route path="/app/e/:eventId" component={AppRoute} />
      <Route path="/app/home" component={AppRoute} />
      <Route path="/app/private" component={AppRoute} />
      <Route path="/app/public" component={AppRoute} />
      <Route path="/app/explore" component={AppRoute} />
      <Route path="/app" component={AppRoute} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/explore" component={ExplorePage} />
      <Route path="/u/:username" component={PublicProfilePage} />
      <Route path="/events/:slug" component={PublicEventPage} />
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
