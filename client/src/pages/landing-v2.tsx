import { Link } from "wouter";
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  CircleDot,
  Heart,
  House,
  Moon,
  Sparkles,
  Sun,
  Users,
  Utensils,
  Plane,
  PartyPopper,
} from "lucide-react";
import { SplannoLogo } from "@/components/splanno-logo";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";
import { useLanguage, SELECTABLE_LANGUAGES } from "@/hooks/use-language";
import { cn } from "@/lib/utils";

type UseCase = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
};

const useCases: UseCase[] = [
  { icon: House, title: "Housemates", description: "Rent, groceries, utilities and the little things in one shared flow." },
  { icon: Plane, title: "Travel crews", description: "Trips stay organized from planning to the last airport coffee." },
  { icon: Utensils, title: "Dinners", description: "Track shared dinners without turning the night into admin." },
  { icon: PartyPopper, title: "Friend groups", description: "Recurring groups, shared costs, and memories that stay together." },
  { icon: Heart, title: "Couples", description: "A calmer way to manage shared life without spreadsheets." },
];

const testimonials = [
  "Finally something that feels better than Splitwise.",
  "Managing trips with friends has never been this easy.",
  "It feels like the app already knows how our group works.",
];

function Section({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", className)}>
      {children}
    </section>
  );
}

function AvatarStack() {
  const avatars = [
    { label: "A", color: "bg-primary/20 text-primary" },
    { label: "M", color: "bg-accent/15 text-accent" },
    { label: "J", color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
    { label: "S", color: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
  ];
  return (
    <div className="flex items-center -space-x-3">
      {avatars.map((a, i) => (
        <div
          key={`${a.label}-${i}`}
          className={cn(
            "h-10 w-10 rounded-full border border-background shadow-sm grid place-items-center text-sm font-semibold",
            a.color,
          )}
        >
          {a.label}
        </div>
      ))}
      <div className="ml-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
        Shared circle active
      </div>
    </div>
  );
}

function HeroPreviewCard() {
  return (
    <div className="relative mx-auto w-full max-w-md rounded-3xl border border-border/70 bg-card/90 p-4 shadow-[0_20px_60px_-25px_rgba(0,0,0,0.18)] backdrop-blur supports-[backdrop-filter]:bg-card/75 transition-transform duration-150 ease-out motion-reduce:transition-none hover:-translate-y-0.5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Summer crew</p>
          <p className="text-xs text-muted-foreground">Barcelona trip • 6 people</p>
        </div>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          Private-first
        </span>
      </div>

      <div className="space-y-3">
        <div className="rounded-2xl bg-secondary/50 p-3">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">Dinner at El Born</span>
            <span className="text-muted-foreground">€84</span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Paid by Maya</span>
            <span>Suggested split saved</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-background/80 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            Smart defaults
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl bg-muted/50 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">Payer</p>
              <p className="font-medium">Maya (last used)</p>
            </div>
            <div className="rounded-xl bg-muted/50 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">Split</p>
              <p className="font-medium">Equal • 6 people</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingV2() {
  const { theme, setPreference } = useTheme();
  const { language, setLanguage } = useLanguage();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-gradient-to-b from-primary/10 via-accent/5 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(circle_at_12%_12%,hsl(var(--primary)/0.14),transparent_48%),radial-gradient(circle_at_88%_18%,hsl(var(--accent)/0.12),transparent_42%),radial-gradient(circle_at_50%_0%,hsl(var(--foreground)/0.03),transparent_52%)]" />

      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/65">
        <Section className="flex h-16 items-center justify-between">
          <Link href="/">
            <a className="flex items-center gap-3">
              <SplannoLogo variant="icon" size={38} />
              <div className="leading-tight">
                <p className="font-display text-base font-bold text-foreground">Splanno</p>
                <p className="text-[11px] text-muted-foreground">The OS for shared life</p>
              </div>
            </a>
          </Link>

          <div className="flex items-center gap-2">
            <Link href="/explore">
              <a className="hidden sm:inline-flex">
                <Button variant="ghost" size="sm" className="rounded-xl text-muted-foreground hover:text-foreground">
                  Explore
                </Button>
              </a>
            </Link>
            <Link href="/login">
              <a className="hidden sm:inline-flex">
                <Button variant="outline" size="sm" className="rounded-xl">Log in</Button>
              </a>
            </Link>
            <button
              type="button"
              onClick={() => setPreference(theme === "dark" ? "light" : "dark")}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <div className="hidden sm:flex rounded-xl border border-border overflow-hidden">
              {SELECTABLE_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setLanguage(lang.code)}
                  className={cn(
                    "px-2.5 py-1.5 text-xs font-semibold transition-colors",
                    language === lang.code ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>
        </Section>
      </header>

      <main className="relative">
        <Section className="pt-16 sm:pt-24 lg:pt-28 pb-16">
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-1.5 text-xs text-muted-foreground">
                <CircleDot className="h-3.5 w-3.5 text-primary" />
                Private-first shared life platform
              </div>

              <div className="space-y-4">
                <h1 className="max-w-xl font-hero text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                  Split costs. Keep memories. Stay friends.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                  Splanno makes managing shared life effortless — trips, housemates, dinners and everything in between.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link href="/login">
                  <a>
                    <Button size="lg" className="w-full sm:w-auto rounded-xl px-5">
                      Start your first circle
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </a>
                </Link>
                <a href="#how-it-works">
                  <Button variant="ghost" size="lg" className="w-full sm:w-auto rounded-xl text-muted-foreground hover:text-foreground">
                    See how it works
                  </Button>
                </a>
              </div>

              <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:gap-5">
                <AvatarStack />
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 -z-10 blur-3xl bg-[radial-gradient(circle_at_50%_40%,hsl(var(--primary)/0.18),transparent_55%),radial-gradient(circle_at_40%_70%,hsl(var(--accent)/0.12),transparent_60%)]" />
              <HeroPreviewCard />
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-border/70 bg-card/80 p-3 text-center">
                  <p className="text-[11px] text-muted-foreground">Circles</p>
                  <p className="text-lg font-semibold">Recurring</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-card/80 p-3 text-center">
                  <p className="text-[11px] text-muted-foreground">Setup</p>
                  <p className="text-lg font-semibold">Low-friction</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-card/80 p-3 text-center">
                  <p className="text-[11px] text-muted-foreground">Feel</p>
                  <p className="text-lg font-semibold">Calm</p>
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section className="py-8 sm:py-12">
          <div className="mx-auto max-w-3xl text-center space-y-4 sm:space-y-5">
            <p className="text-2xl sm:text-3xl lg:text-4xl font-display text-foreground">Group expenses get messy.</p>
            <p className="text-2xl sm:text-3xl lg:text-4xl font-display text-foreground">Chats get chaotic.</p>
            <p className="text-2xl sm:text-3xl lg:text-4xl font-display text-foreground">Someone always pays too much.</p>
            <p className="pt-2 text-xl sm:text-2xl font-semibold text-primary">Splanno fixes that.</p>
          </div>
        </Section>

        <Section id="how-it-works" className="py-14 sm:py-18">
          <div className="mb-8 sm:mb-10">
            <h2 className="font-hero text-3xl sm:text-4xl font-semibold tracking-tight">More than splitting expenses</h2>
          </div>
          <div className="grid gap-4 sm:gap-5 md:grid-cols-3">
            {[
              {
                icon: Brain,
                emoji: "🧠",
                title: "Smart by default",
                points: ["Remembers how your group works", "Smart suggestions", "Zero friction"],
              },
              {
                icon: Users,
                emoji: "👥",
                title: "Built for real friend groups",
                points: ["Circles, not just events", "Recurring groups", "Private-first design"],
              },
              {
                icon: Heart,
                emoji: "🧾",
                title: "Shared memories, not just numbers",
                points: ["Trips become timelines", "Moments stay together", "Emotional UX"],
              },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.title}
                  className="rounded-3xl bg-card/85 p-5 sm:p-6 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.18)] ring-1 ring-border/60"
                >
                  <div className="mb-4 flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{card.emoji}</p>
                      <h3 className="font-semibold leading-tight">{card.title}</h3>
                    </div>
                  </div>
                  <ul className="space-y-2.5 text-sm text-muted-foreground">
                    {card.points.map((point) => (
                      <li key={point} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary/80" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Section>

        <Section className="py-14 sm:py-18">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-border/60 bg-muted/30 p-6 sm:p-7">
              <p className="mb-4 text-sm font-medium text-muted-foreground">Other apps</p>
              <ul className="space-y-3 text-sm sm:text-base text-muted-foreground">
                <li>Cold expense tools</li>
                <li>One-off events</li>
                <li>Just numbers</li>
                <li>Manual setup</li>
              </ul>
            </div>
            <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-accent/5 p-6 sm:p-7 shadow-[0_16px_45px_-25px_rgba(0,0,0,0.2)]">
              <p className="mb-4 text-sm font-medium text-primary">Splanno</p>
              <ul className="space-y-3 text-sm sm:text-base">
                <li className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Warm, social UX</li>
                <li className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Recurring circles</li>
                <li className="flex items-center gap-2"><Heart className="h-4 w-4 text-primary" /> Memories included</li>
                <li className="flex items-center gap-2"><Brain className="h-4 w-4 text-primary" /> Smart defaults</li>
              </ul>
            </div>
          </div>
        </Section>

        <Section className="py-14 sm:py-18">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <h2 className="font-hero text-3xl sm:text-4xl font-semibold tracking-tight">Made for every kind of group</h2>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {useCases.map((useCase) => {
              const Icon = useCase.icon;
              return (
                <div key={useCase.title} className="rounded-3xl bg-card/85 p-5 sm:p-6 ring-1 ring-border/60 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.18)]">
                  <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary/70 text-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold">{useCase.title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{useCase.description}</p>
                </div>
              );
            })}
          </div>
        </Section>

        <Section className="py-14 sm:py-18">
          <div className="rounded-3xl border border-border/60 bg-card/75 p-6 sm:p-8 lg:p-10">
            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div className="space-y-4">
                <h2 className="font-hero text-3xl sm:text-4xl font-semibold tracking-tight">It just feels smarter</h2>
                <p className="max-w-2xl text-base sm:text-lg leading-7 text-muted-foreground">
                  Splanno learns how your groups work — so things get easier over time.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {["Smart defaults", "Faster over time", "Built for real life"].map((label) => (
                    <span key={label} className="rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                      {label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold">Next expense</p>
                  <span className="text-xs text-muted-foreground">Suggested</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2 text-sm">
                    <span>Payer</span>
                    <span className="font-medium">Maya</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2 text-sm">
                    <span>Participants</span>
                    <span className="font-medium">Last group • 6</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2 text-sm">
                    <span>Category</span>
                    <span className="font-medium">Dinner</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section className="py-14 sm:py-18">
          <div className="mb-6">
            <h2 className="font-hero text-2xl sm:text-3xl font-semibold tracking-tight">What early users say</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {testimonials.map((quote, i) => (
              <blockquote key={quote} className="rounded-3xl bg-card/85 p-5 sm:p-6 ring-1 ring-border/60">
                <p className="text-base leading-7">“{quote}”</p>
                <footer className="mt-3 text-xs text-muted-foreground">Early user #{i + 1}</footer>
              </blockquote>
            ))}
          </div>
        </Section>

        <Section className="py-12 sm:py-16">
          <div className="rounded-3xl border border-border/60 bg-gradient-to-br from-card via-card to-muted/30 p-6 sm:p-8 text-center">
            <h2 className="font-hero text-2xl sm:text-3xl font-semibold tracking-tight">We’re building the future of shared life</h2>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground">
              Today: expenses and circles
              <span className="mx-2 text-border">•</span>
              Tomorrow: everything you share with people you care about
            </p>
          </div>
        </Section>

        <Section className="py-16 sm:py-20">
          <div className="rounded-[2rem] border border-border/60 bg-gradient-to-b from-card to-muted/25 p-8 sm:p-12 text-center shadow-[0_20px_50px_-30px_rgba(0,0,0,0.22)]">
            <h2 className="font-hero text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight">Start your first circle</h2>
            <p className="mt-4 text-base sm:text-lg text-muted-foreground">Bring your friends. We’ll handle the rest.</p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/login">
                <a>
                  <Button size="lg" className="w-full sm:w-auto rounded-xl px-6">
                    Try Splanno
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </a>
              </Link>
              <Link href="/basic">
                <a>
                  <Button variant="ghost" size="lg" className="w-full sm:w-auto rounded-xl">
                    Join the beta
                  </Button>
                </a>
              </Link>
            </div>
          </div>
        </Section>

        <Section className="pb-10">
          <footer className="flex flex-col gap-4 border-t border-border/60 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <SplannoLogo variant="icon" size={24} />
              <span>Splanno • Shared life, made simple.</span>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Link href="/explore"><a className="hover:text-foreground transition-colors">Explore</a></Link>
              <Link href="/login"><a className="hover:text-foreground transition-colors">Log in</a></Link>
              <Link href="/basic"><a className="hover:text-foreground transition-colors">Try demo</a></Link>
            </div>
          </footer>
        </Section>
      </main>
    </div>
  );
}
