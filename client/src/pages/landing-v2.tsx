import { Link, useLocation } from "wouter";
import { useEffect } from "react";
import { ArrowRight, CheckCircle2, MessageCircle, Moon, ReceiptText, Sun, UserPlus2, Zap } from "lucide-react";
import { SplannOLogo } from "@/components/branding/SplannOLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { AuthDrawer } from "@/components/auth/AuthDrawer";
import { SELECTABLE_LANGUAGES, useLanguage } from "@/hooks/use-language";
import { useTheme } from "@/hooks/use-theme";

const BENEFITS = [
  {
    title: "Invite your crew",
    description: "Everyone stays in sync with one shared plan.",
    icon: UserPlus2,
  },
  {
    title: "Shared costs made easy",
    description: "Log expenses and see who owes what.",
    icon: ReceiptText,
  },
  {
    title: "Quick actions",
    description: "Assign tasks, vote on ideas, and keep momentum.",
    icon: Zap,
  },
  {
    title: "Chat where it matters",
    description: "Talk inside the plan, not in 10 different apps.",
    icon: MessageCircle,
  },
] as const;

const STEPS = [
  "Create a plan",
  "Invite friends",
  "Track costs & decisions",
] as const;

export default function LandingV2() {
  const { user } = useAuth();
  const { language, setLanguage } = useLanguage();
  const { theme, setPreference } = useTheme();
  const isAuthenticated = !!user;
  const [location, setLocation] = useLocation();
  const authMode = location === "/signup" ? "signup" : location === "/login" ? "login" : null;
  const isAuthDrawerOpen = authMode !== null;

  const openAuth = (mode: "login" | "signup") => {
    setLocation(mode === "signup" ? "/signup" : "/login");
  };

  const handleCreatePlan = () => {
    setLocation(user ? "/app/private" : "/signup");
  };

  const handleCloseAuthDrawer = (nextOpen: boolean) => {
    if (nextOpen) return;
    setLocation("/");
  };

  const handleAuthModeChange = (mode: "login" | "signup") => {
    setLocation(mode === "signup" ? "/signup" : "/login");
  };

  const handleAuthSuccess = () => {
    setLocation("/app/private");
  };

  useEffect(() => {
    if (!user) return;
    if (!isAuthDrawerOpen) return;
    setLocation("/app/private");
  }, [user, isAuthDrawerOpen, setLocation]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/70 bg-background/95">
        <div className="mx-auto flex h-14 w-full max-w-6xl flex-nowrap items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-8">
          <Link href="/">
            <a className="min-w-0 flex items-center gap-2.5">
              <SplannOLogo className="h-9 w-auto max-w-full sm:h-10" />
            </a>
          </Link>
          <div className="flex flex-nowrap items-center gap-2">
            {!isAuthenticated ? (
              <>
                <button
                  type="button"
                  onClick={() => setPreference(theme === "dark" ? "light" : "dark")}
                  className="hidden h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground lg:inline-flex"
                  title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                  aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                >
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
                <div className="hidden overflow-hidden rounded-lg border border-border lg:flex">
                  {SELECTABLE_LANGUAGES.map((lang) => (
                    <button
                      key={`landing-language-${lang.code}`}
                      type="button"
                      onClick={() => setLanguage(lang.code)}
                      className={`px-2 py-1 text-[11px] font-semibold transition-colors ${
                        language === lang.code
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted/60"
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
                <Button variant="ghost" size="sm" className="h-9 px-2.5 text-sm sm:px-3" onClick={() => openAuth("login")}>
                  Log in
                </Button>
                <Button size="sm" className="h-9 rounded-full px-3 sm:px-4" onClick={() => openAuth("signup")}>
                  Sign up
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => setLocation("/app/private")}>
                Open app
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-8">
          <div className="space-y-4 sm:space-y-5">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Your plan buddy for friend groups.</h1>
            <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
              Create a plan, invite your crew, track shared costs, and keep everything in one place.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button size="lg" className="w-full rounded-xl px-5 sm:w-auto" onClick={handleCreatePlan}>
                Create a plan
                <ArrowRight className="h-4 w-4" />
              </Button>
              <a href="#how-it-works" className="w-full sm:w-auto">
                <Button variant="secondary" size="lg" className="w-full rounded-xl">
                  See how it works
                </Button>
              </a>
            </div>
          </div>

          <Card className="rounded-2xl border-border/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Product preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 sm:p-6">
              <div className="flex items-center rounded-xl border border-border/70 px-3.5 py-3">
                <SplannOLogo className="h-7 w-auto max-w-full sm:h-8" />
              </div>
              <div className="w-full rounded-xl border border-border/70 p-3.5">
                <p className="text-sm font-medium">Weekend in Lisbon</p>
                <p className="text-xs text-muted-foreground">6 people · Shared chat active</p>
              </div>
              <div className="w-full rounded-xl border border-border/70 p-3.5">
                <p className="text-sm font-medium">Total spent</p>
                <p className="text-xs text-muted-foreground">€248.30 · 7 expenses logged</p>
              </div>
              <div className="w-full rounded-xl border border-border/70 p-3.5">
                <p className="text-sm font-medium">Next action</p>
                <p className="text-xs text-muted-foreground">Assign grocery list to the crew</p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <Card key={benefit.title} className="rounded-2xl border-border/70">
                <CardContent className="space-y-3 p-5">
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/70 bg-muted/40">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <h3 className="text-sm font-semibold">{benefit.title}</h3>
                  <p className="text-sm text-muted-foreground">{benefit.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section id="how-it-works" className="mt-14">
          <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <Card key={step} className="rounded-2xl border-border/70">
                <CardContent className="flex items-start gap-3 p-5">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-xs font-semibold">
                    {index + 1}
                  </div>
                  <p className="text-sm font-medium">{step}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-14 rounded-2xl border border-border/70 bg-card p-5">
          <h3 className="text-sm font-semibold">FAQ</h3>
          <div className="mt-3 space-y-3 text-sm text-muted-foreground">
            <p>Is this private by default? Yes, plans are private by default for friend groups.</p>
            <p>Can we track shared costs? Yes, you can log expenses and keep balances clear.</p>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/70">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>Turn ideas into plans.</p>
          <div className="flex items-center gap-4">
            <span>Privacy</span>
            <span>Terms</span>
          </div>
        </div>
      </footer>

      <AuthDrawer
        open={isAuthDrawerOpen}
        mode={authMode ?? "login"}
        onOpenChange={handleCloseAuthDrawer}
        onModeChange={handleAuthModeChange}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}
