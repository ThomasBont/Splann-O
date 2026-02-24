"use client";

import { cn } from "@/lib/utils";

export interface UseCase {
  emoji: string;
  title: string;
  description: string;
}

export interface UseCasesProps {
  title?: string;
  cases: UseCase[];
}

export function UseCases({ title, cases }: UseCasesProps) {
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {title && (
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-foreground mb-12">
            {title}
          </h2>
        )}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {cases.map((uc, i) => (
            <div
              key={i}
              className={cn(
                "p-6 rounded-2xl border border-border bg-card",
                "hover:border-primary/20 hover:shadow-lg transition-all duration-200",
                "text-left"
              )}
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl mb-4">
                {uc.emoji}
              </div>
              <h3 className="font-semibold text-foreground mb-2">{uc.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {uc.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
