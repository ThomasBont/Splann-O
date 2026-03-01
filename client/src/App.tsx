import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
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
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { FEATURE_PUBLIC_PLANS } from "@/lib/features";

function PublicDisabledPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-6 text-center space-y-3">
        <div className="mx-auto w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center">
          <Lock className="w-5 h-5 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">Public plans are temporarily disabled</h1>
        <p className="text-sm text-muted-foreground">
          We are currently focused on helping friend groups make plans.
        </p>
        <div className="pt-2">
          <Button onClick={() => setLocation("/app/private")}>Go to Private</Button>
        </div>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingV2} />
      <Route path="/join/:token" component={JoinPage} />
      <Route path="/invite/:token" component={JoinPage} />
      <Route path="/basic" component={Basic} />
      <Route path="/login" component={LoginPage} />
      <Route path="/app/e/:eventId" component={AppRoute} />
      <Route path="/app/home" component={AppRoute} />
      <Route path="/app/private" component={AppRoute} />
      <Route path="/app/public" component={FEATURE_PUBLIC_PLANS ? AppRoute : PublicDisabledPage} />
      <Route path="/app/explore" component={FEATURE_PUBLIC_PLANS ? AppRoute : PublicDisabledPage} />
      <Route path="/app" component={AppRoute} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/explore" component={FEATURE_PUBLIC_PLANS ? AppRoute : PublicDisabledPage} />
      <Route path="/u/:username" component={FEATURE_PUBLIC_PLANS ? AppRoute : PublicDisabledPage} />
      <Route path="/events/:slug" component={FEATURE_PUBLIC_PLANS ? AppRoute : PublicDisabledPage} />
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
  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === "undefined") return;

    const points = () => ([
      { name: "top-left", x: 12, y: 12 },
      { name: "top-right", x: window.innerWidth - 12, y: 12 },
      { name: "center", x: Math.floor(window.innerWidth / 2), y: Math.floor(window.innerHeight / 2) },
      { name: "bottom-left", x: 12, y: window.innerHeight - 12 },
      { name: "bottom-right", x: window.innerWidth - 12, y: window.innerHeight - 12 },
    ]);

    const logHitTest = (label: string) => {
      try {
        console.group(`[ui-hit-test] ${label}`);
        points().forEach((p) => {
          const el = document.elementFromPoint(p.x, p.y) as HTMLElement | null;
          if (!el) {
            console.log(p.name, "no element");
            return;
          }
          const style = window.getComputedStyle(el);
          console.log(p.name, {
            tagName: el.tagName,
            id: el.id || null,
            className: el.className || null,
            zIndex: style.zIndex,
            pointerEvents: style.pointerEvents,
            position: style.position,
          });
        });
        console.groupEnd();
      } catch {
        // dev-only debug; swallow
      }
    };

    const ensureOutlineStyle = () => {
      if (document.getElementById("__splanno-outline-style")) return;
      const style = document.createElement("style");
      style.id = "__splanno-outline-style";
      style.textContent = `html.__splanno-debug-outline * { outline: 1px solid rgba(255, 0, 0, 0.15) !important; }`;
      document.head.appendChild(style);
    };

    const toggleOutlineDebug = () => {
      ensureOutlineStyle();
      document.documentElement.classList.add("__splanno-debug-outline");
      window.setTimeout(() => {
        document.documentElement.classList.remove("__splanno-debug-outline");
      }, 2000);
    };

    const healPointerEvents = () => {
      const bodyPointer = window.getComputedStyle(document.body).pointerEvents;
      const openDialog = document.querySelector("[data-state='open'][role='dialog']");
      const openOverlay = document.querySelector("[data-state='open'][data-radix-dialog-overlay]");
      if (!openDialog && !openOverlay && bodyPointer === "none") {
        document.body.style.pointerEvents = "auto";
        console.warn("[ui-heal] reset body pointer-events to auto");
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "\\") {
        toggleOutlineDebug();
        logHitTest("keyboard-shortcut");
      }
    };

    logHitTest("app-mount");
    healPointerEvents();
    window.addEventListener("keydown", onKeyDown);
    const observer = new MutationObserver(() => {
      healPointerEvents();
    });
    observer.observe(document.body, { attributes: true, childList: true, subtree: true });

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      observer.disconnect();
    };
  }, []);

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
