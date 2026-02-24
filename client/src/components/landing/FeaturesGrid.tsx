"use client";

import { cn } from "@/lib/utils";

export interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export interface FeaturesGridProps {
  title?: string;
  features: Feature[];
}

export function FeaturesGrid({ title, features }: FeaturesGridProps) {
  return (
    <section className="py-16 sm:py-24 bg-muted/30 dark:bg-muted/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {title && (
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-foreground mb-12">
            {title}
          </h2>
        )}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((f, i) => (
            <div key={i} className="text-center">
              <div className="inline-flex w-14 h-14 rounded-2xl bg-card border border-border items-center justify-center text-2xl mb-4 shadow-sm">
                {f.icon}
              </div>
              <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
