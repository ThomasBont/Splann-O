"use client";

import { Link } from "wouter";
import { Link2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ViralCTAProps {
  title: string;
  copy: string;
  microCopy: string;
  ctaLabel: string;
}

export function ViralCTA(props: ViralCTAProps) {
  const { title, copy, microCopy, ctaLabel } = props;
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
          {title}
        </h2>
        <p className="text-lg text-muted-foreground mb-6">{copy}</p>
        <div className="flex justify-center gap-4 mb-8 flex-wrap">
          <div className="flex -space-x-2">
            {["A", "B", "C", "D"].map((l, i) => (
              <div
                key={i}
                className="w-10 h-10 rounded-full bg-primary/20 border-2 border-background dark:border-card flex items-center justify-center text-xs font-semibold text-primary"
              >
                {l}
              </div>
            ))}
          </div>
          <div className="flex items-center text-muted-foreground">
            <Link2 className="w-5 h-5 mr-2" />
            <span className="text-sm font-medium">{microCopy}</span>
          </div>
        </div>
        <Link href="/login">
          <span
            className={cn(
              buttonVariants({ size: "lg" }),
              "px-8 py-6 text-base font-semibold rounded-xl inline-block"
            )}
          >
            {ctaLabel}
          </span>
        </Link>
      </div>
    </section>
  );
}
