"use client";

import { Link } from "wouter";
import { SplannOLogo } from "@/components/branding/SplannOLogo";

export interface FooterLink {
  label: string;
  href: string;
}

export interface LandingFooterProps {
  tagline: string;
  product: FooterLink[];
  features: FooterLink[];
  about: FooterLink[];
}

export function LandingFooter({ tagline, product, features, about }: LandingFooterProps) {
  return (
    <footer className="border-t border-border bg-muted/20 dark:bg-muted/10 py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2 md:col-span-1">
            <SplannOLogo className="h-9 w-auto max-w-full" />
            <p className="mt-2 text-sm text-muted-foreground max-w-[200px]">{tagline}</p>
          </div>
          <div>
            <h4 className="font-semibold text-foreground mb-4">Product</h4>
            <ul className="space-y-2">
              {product.map((l, i) => (
                <li key={i}>
                  <Link href={l.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-foreground mb-4">Features</h4>
            <ul className="space-y-2">
              {features.map((l, i) => (
                <li key={i}>
                  <Link href={l.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-foreground mb-4">About</h4>
            <ul className="space-y-2">
              {about.map((l, i) => (
                <li key={i}>
                  <Link href={l.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            © {new Date().getFullYear()} Splann-O. Split costs, stay friends.
          </p>
        </div>
      </div>
    </footer>
  );
}
