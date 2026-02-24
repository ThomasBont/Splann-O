"use client";

import { Shield, EyeOff, Scale } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export interface TrustBoostersProps {
  noAds: string;
  noTracking: string;
  fairSplits: string;
  faq?: Array< { q: string; a: string } >;
}

export function TrustBoosters({ noAds, noTracking, fairSplits, faq }: TrustBoostersProps) {
  return (
    <section className="py-16 sm:py-24 border-t border-border/60">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="grid sm:grid-cols-3 gap-6 mb-12">
          <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-600 dark:text-green-400">
              <Shield className="w-5 h-5" />
            </div>
            <span className="font-medium text-foreground">{noAds}</span>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <EyeOff className="w-5 h-5" />
            </div>
            <span className="font-medium text-foreground">{noTracking}</span>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
              <Scale className="w-5 h-5" />
            </div>
            <span className="font-medium text-foreground">{fairSplits}</span>
          </div>
        </div>
        {faq && faq.length > 0 && (
          <Accordion type="single" collapsible className="w-full">
            {faq.map((item, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-left">{item.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>
    </section>
  );
}
