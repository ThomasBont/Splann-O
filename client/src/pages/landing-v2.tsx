import { Link, useLocation } from "wouter";
import { ArrowRight, CheckCircle2, MessageCircle, ReceiptText, UserPlus2, Zap } from "lucide-react";
import { SplannoLogo } from "@/components/splanno-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";

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
  const [, setLocation] = useLocation();

  const handleCreatePlan = () => {
    setLocation(user ? "/app/private" : "/login");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/70 bg-background/95">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/">
            <a className="flex items-center gap-3">
              <SplannoLogo variant="icon" size={36} />
              <span className="text-base font-semibold tracking-tight">Splanno</span>
            </a>
          </Link>
          <Link href={user ? "/app/private" : "/login"}>
            <a>
              <Button variant="ghost" size="sm">Log in</Button>
            </a>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-5">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Your plan buddy for friend groups.</h1>
            <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
              Create a plan, invite your crew, track shared costs, and keep everything in one place.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button size="lg" className="rounded-xl px-5" onClick={handleCreatePlan}>
                Create a plan
                <ArrowRight className="h-4 w-4" />
              </Button>
              <a href="#how-it-works">
                <Button variant="secondary" size="lg" className="rounded-xl">
                  See how it works
                </Button>
              </a>
            </div>
          </div>

          <Card className="rounded-2xl border-border/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Product preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl border border-border/70 p-3">
                <p className="text-sm font-medium">Weekend in Lisbon</p>
                <p className="text-xs text-muted-foreground">6 people · Shared chat active</p>
              </div>
              <div className="rounded-xl border border-border/70 p-3">
                <p className="text-sm font-medium">Total spent</p>
                <p className="text-xs text-muted-foreground">€248.30 · 7 expenses logged</p>
              </div>
              <div className="rounded-xl border border-border/70 p-3">
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
    </div>
  );
}
