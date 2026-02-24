"use client";

import { Link } from "wouter";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface LandingHeroProps {
  title: string;
  subtitle: string;
  ctaPrimary: string;
  ctaSecondary: string;
  shareHook?: string;
}

export function LandingHero(props: LandingHeroProps) {
  const { title, subtitle, ctaPrimary, ctaSecondary, shareHook } = props;
  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute inset-0 -z-10 opacity-[0.6] dark:opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, hsl(var(--primary) / 0.08), transparent 60%), radial-gradient(ellipse 60% 40% at 80% 80%, hsl(var(--accent) / 0.06), transparent 50%)",
        }}
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 lg:pt-20 pb-16 sm:pb-24">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="text-center lg:text-left">
            <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground">
              {title}
            </h1>
            <p className="mt-4 text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0">
              {subtitle}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Link href="/login" className="inline-flex">
                <span
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "w-full sm:w-auto px-8 py-6 text-base font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all"
                  )}
                >
                  {ctaPrimary}
                </span>
              </Link>
              <Link href="/basic" className="inline-flex">
                <span
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "w-full sm:w-auto px-8 py-6 text-base font-semibold rounded-xl"
                  )}
                >
                  {ctaSecondary}
                </span>
              </Link>
            </div>
            {shareHook && (
              <p className="mt-4 text-sm text-muted-foreground">
                <Link href="/basic" className="hover:text-foreground transition-colors underline-offset-2 hover:underline">
                  {shareHook}
                </Link>
              </p>
            )}
          </div>
          <div className="flex justify-center lg:justify-end">
            <IPhoneMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

function IPhoneMockup() {
  const tabs = ["Expenses", "People", "Split"];
  const rows = [
    { color: "bg-blue-500/20" },
    { color: "bg-orange-500/20" },
    { color: "bg-green-500/20" },
  ];
  return (
    <div className="relative group">
      <div
        className="relative rounded-[2.5rem] border-[10px] border-foreground/90 dark:border-foreground/80 bg-foreground/90 p-2 shadow-2xl shadow-black/20 dark:shadow-black/40 transition-transform duration-300 group-hover:scale-[1.02]"
        style={{ width: 260 }}
      >
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-7 rounded-full bg-black/80 z-10" />
        <div className="rounded-[1.75rem] overflow-hidden bg-card border border-border aspect-[9/19] min-h-[420px]">
          <div className="h-full flex flex-col p-3">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-sm">
                🏖️
              </div>
              <div className="flex-1 min-w-0">
                <div className="h-3 w-20 bg-foreground/20 rounded" />
                <div className="h-2 w-28 mt-1 bg-muted rounded" />
              </div>
            </div>
            <div className="flex gap-2 mb-3">
              {tabs.map((tab, i) => (
                <div
                  key={tab}
                  className={
                    i === 2
                      ? "h-6 px-2 rounded-md text-[10px] flex items-center bg-primary text-primary-foreground font-medium"
                      : "h-6 px-2 rounded-md text-[10px] flex items-center bg-muted/50 text-muted-foreground"
                  }
                >
                  {tab}
                </div>
              ))}
            </div>
            <div className="space-y-2 flex-1">
              {rows.map((row, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs ${row.color}`}
                  >
                    {"\u{2022}"}
                  </div>
                  <div className="flex-1 h-2.5 w-14 bg-foreground/30 rounded" />
                  <div className="h-2.5 w-10 bg-primary/40 rounded" />
                </div>
              ))}
            </div>
            <div className="pt-2 border-t border-border mt-auto">
              <div className="flex justify-between items-center">
                <div className="h-2 w-12 bg-muted rounded" />
                <div className="h-3 w-14 bg-primary/60 rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
