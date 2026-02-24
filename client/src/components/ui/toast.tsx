"use client";

import * as React from "react";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToastItem, ToastVariant } from "@/hooks/use-toast";

const VARIANTS: Record<
  ToastVariant,
  { icon: React.ComponentType<{ className?: string }>; accentClass: string }
> = {
  success: {
    icon: CheckCircle2,
    accentClass: "border-l-4 border-l-green-500 dark:border-l-green-600",
  },
  error: {
    icon: AlertCircle,
    accentClass: "border-l-4 border-l-red-500 dark:border-l-red-600",
  },
  warning: {
    icon: AlertTriangle,
    accentClass: "border-l-4 border-l-amber-500 dark:border-l-amber-600",
  },
  info: {
    icon: Info,
    accentClass: "border-l-4 border-l-blue-500 dark:border-l-blue-600",
  },
  loading: {
    icon: Loader2,
    accentClass: "border-l-4 border-l-muted-foreground/50",
  },
};

export interface ToastProps {
  item: ToastItem;
  onDismiss: (id: string) => void;
  onMouseEnter: (id: string) => void;
  onMouseLeave: (id: string) => void;
}

export function Toast({ item, onDismiss, onMouseEnter, onMouseLeave }: ToastProps) {
  const variant = VARIANTS[item.variant];
  const Icon = variant.icon;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onDismiss(item.id);
    }
  };

  return (
    <div
      role={item.variant === "error" ? "alert" : "status"}
      aria-live={item.variant === "error" ? "assertive" : "polite"}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => onMouseEnter(item.id)}
      onMouseLeave={() => onMouseLeave(item.id)}
      className={cn(
        "pointer-events-auto w-full rounded-xl border border-border bg-card text-card-foreground shadow-lg overflow-hidden",
        "animate-in fade-in-0 slide-in-from-top-full duration-200",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-right-full data-[state=closed]:duration-200",
        variant.accentClass
      )}
      style={{ animationDuration: "180ms" }}
      data-toast-id={item.id}
    >
      <div className="flex items-start gap-3 p-4">
        <div className="flex-shrink-0 mt-0.5">
          {item.variant === "loading" ? (
            <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
          ) : (
            <Icon
              className={cn(
                "h-5 w-5",
                item.variant === "success" && "text-green-600 dark:text-green-500",
                item.variant === "error" && "text-red-600 dark:text-red-500",
                item.variant === "warning" && "text-amber-600 dark:text-amber-500",
                item.variant === "info" && "text-blue-600 dark:text-blue-500"
              )}
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          {item.title && (
            <p className="text-sm font-semibold text-foreground">{item.title}</p>
          )}
          <p className={cn("text-sm text-muted-foreground", item.title && "mt-0.5")}>
            {item.message}
          </p>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {item.actionLabel && item.onAction && (
              <button
                type="button"
                onClick={() => {
                  item.onAction?.();
                  onDismiss(item.id);
                }}
                className="text-xs font-semibold text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
              >
                {item.actionLabel}
              </button>
            )}
            <button
              type="button"
              onClick={() => onDismiss(item.id)}
              className="text-xs font-medium text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
            >
              {item.dismissLabel}
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onDismiss(item.id)}
          className="flex-shrink-0 rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
