"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { motionTransition } from "@/lib/motion";
import { PremiumPressable } from "@/components/ui/premium-pressable";

const SIZE_CLASSES = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-2xl",
  "2xl": "sm:max-w-[680px]",
} as const;

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  onOpenChange?: (open: boolean) => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
  hideCloseButton?: boolean;
  scrollable?: boolean;
  "data-testid"?: string;
}

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute("disabled") && el.offsetParent !== null
  );
}

function trapFocus(container: HTMLElement, e: KeyboardEvent) {
  if (e.key !== "Tab") return;
  const focusable = getFocusableElements(container);
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement as HTMLElement | null;
  if (e.shiftKey) {
    if (active === first) {
      e.preventDefault();
      last.focus();
    }
  } else if (active === last) {
    e.preventDefault();
    first.focus();
  }
}

export function Modal({
  open,
  onClose,
  onOpenChange,
  title,
  subtitle,
  children,
  footer,
  size = "md",
  className,
  hideCloseButton = false,
  scrollable = false,
  "data-testid": dataTestId,
}: ModalProps) {
  const cardRef = React.useRef<HTMLDivElement>(null);
  const prevActiveRef = React.useRef<HTMLElement | null>(null);
  const handleCloseRef = React.useRef(onClose);
  handleCloseRef.current = onClose;

  const handleClose = React.useCallback(() => {
    handleCloseRef.current();
    onOpenChange?.(false);
  }, [onOpenChange]);

  // Store focus before open, restore after close
  React.useEffect(() => {
    if (open) {
      prevActiveRef.current = document.activeElement as HTMLElement | null;
    } else if (prevActiveRef.current?.focus) {
      prevActiveRef.current.focus();
      prevActiveRef.current = null;
    }
  }, [open]);

  // Escape key
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, handleClose]);

  // Focus trap
  React.useEffect(() => {
    const card = cardRef.current;
    if (!open || !card) return;
    const onKeyDown = (e: KeyboardEvent) => trapFocus(card, e);
    card.addEventListener("keydown", onKeyDown);
    return () => card.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Autofocus first input when opened
  React.useEffect(() => {
    if (!open || !cardRef.current) return;
    const timer = setTimeout(() => {
      const firstInput = cardRef.current?.querySelector<HTMLElement>(
        'input:not([type="hidden"]), textarea, [role="combobox"]'
      );
      firstInput?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [open]);

  return createPortal(
    <AnimatePresence mode="wait">
      {open && (
        <React.Fragment key="modal">
          {/* Backdrop: dark overlay + blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={motionTransition.normal}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            aria-hidden
            onClick={handleClose}
          />
          {/* Center wrapper */}
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-none"
            aria-hidden
          >
            {/* Modal card */}
            <motion.div
              ref={cardRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? "modal-title" : undefined}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={motionTransition.normal}
              className={cn(
                "relative z-10 w-full pointer-events-auto overflow-hidden",
                "rounded-2xl border border-border bg-background text-foreground",
                "shadow-2xl shadow-black/25 dark:shadow-black/50",
                "ring-1 ring-white/5 dark:ring-white/10",
                "before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:pointer-events-none before:z-[1]",
                SIZE_CLASSES[size],
                scrollable && "flex flex-col max-h-[85vh] overflow-hidden",
                className
              )}
              onClick={(e) => e.stopPropagation()}
              data-testid={dataTestId}
              data-state={open ? "open" : "closed"}
            >
              <div className={cn("relative z-10", scrollable && "flex flex-col overflow-hidden flex-1 min-h-0")}>
                {/* Sticky premium header */}
                {(title || !hideCloseButton) && (
                  <div
                    className={cn(
                      "sticky top-0 z-20 flex items-start justify-between gap-4",
                      "px-6 sm:px-7 pt-6 sm:pt-7 pb-4",
                      "border-b border-border/80",
                      "bg-background/80 backdrop-blur-md",
                      "rounded-t-2xl"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      {title && (
                        <h2
                          id="modal-title"
                          className="text-xl font-semibold font-display tracking-tight text-foreground"
                        >
                          {title}
                        </h2>
                      )}
                      {subtitle && (
                        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
                      )}
                    </div>
                    {!hideCloseButton && (
                      <PremiumPressable asChild>
                        <button
                          type="button"
                          onClick={handleClose}
                          className={cn(
                            "rounded-lg p-2 -m-2 shrink-0",
                            "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                          )}
                          aria-label="Close"
                          data-testid="modal-close"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </PremiumPressable>
                    )}
                  </div>
                )}

                {/* Scrollable content */}
                <div
                  className={cn(
                    "px-6 sm:px-7 py-5 sm:py-6",
                    scrollable && "overflow-y-auto flex-1 min-h-0 overscroll-contain",
                    "[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20"
                  )}
                >
                  {children}
                </div>

                {/* Sticky premium footer */}
                {footer !== undefined && footer !== null && footer !== false && (
                  <div
                    className={cn(
                      "sticky bottom-0 z-20",
                      "px-6 sm:px-7 py-4 sm:py-5",
                      "border-t border-border/80",
                      "bg-gradient-to-t from-background via-background/95 to-background/80 backdrop-blur-md",
                      "flex flex-col-reverse sm:flex-row sm:justify-end gap-3",
                      "rounded-b-2xl"
                    )}
                  >
                    {footer}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </React.Fragment>
      )}
    </AnimatePresence>,
    document.body
  );
}

Modal.displayName = "Modal";

/** Section wrapper for modal content. Provides consistent spacing. */
export interface ModalSectionProps {
  children: React.ReactNode;
  title?: React.ReactNode;
  className?: string;
}

export function ModalSection({ children, title, className }: ModalSectionProps) {
  return (
    <section className={cn("space-y-3", className)}>
      {title && (
        <h3 className="text-sm font-medium text-foreground tracking-tight">{title}</h3>
      )}
      {children}
    </section>
  );
}
