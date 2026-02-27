"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface EmptyStateProps {
  /** Theme icon (emoji) — larger, centered */
  icon: string;
  /** Main title */
  title: string;
  /** One-line description */
  description: string;
  /** Primary CTA */
  primaryAction?: {
    label: string;
    onClick: () => void;
    testId?: string;
    /** Optional icon (e.g. Plus) */
    icon?: React.ReactNode;
  };
  /** Optional secondary link/button */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  /** Additional class for icon container (theme tint) */
  iconClassName?: string;
  className?: string;
}

/**
 * Premium empty state.
 * Centered, breathable, minimal chrome.
 */
export function EmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  iconClassName,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-16 px-6",
        className
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center w-16 h-16 rounded-xl mb-5 text-4xl transition-transform duration-200 ease-out hover:scale-105",
          iconClassName
        )}
        aria-hidden
      >
        {icon}
      </div>
      <p className="font-medium text-foreground">{title}</p>
      <p className="text-sm mt-2 text-muted-foreground max-w-xs">{description}</p>
      {(primaryAction || secondaryAction) && (
        <div className="flex flex-col sm:flex-row items-center gap-3 mt-6">
          {primaryAction && (
            <Button
              size="sm"
              onClick={primaryAction.onClick}
              className="btn-interact bg-primary text-primary-foreground font-medium"
              data-testid={primaryAction.testId}
            >
              {primaryAction.icon}
              {primaryAction.label}
            </Button>
          )}
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="text-sm text-muted-foreground hover:text-foreground transition-smooth underline-offset-2 hover:underline"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
