"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZE_CLASSES = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-2xl",
} as const;

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Optional: for compatibility with onOpenChange(boolean) */
  onOpenChange?: (open: boolean) => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  /** Hide the default close (X) button */
  hideCloseButton?: boolean;
  /** When true, restricts modal height and enables scroll for content */
  scrollable?: boolean;
  /** Optional data-testid for the modal card */
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
  children,
  footer,
  size = "md",
  className,
  hideCloseButton = false,
  scrollable = false,
  "data-testid": dataTestId,
}: ModalProps) {
  const cardRef = React.useRef<HTMLDivElement>(null);
  const handleCloseRef = React.useRef(onClose);
  handleCloseRef.current = onClose;

  const handleClose = React.useCallback(() => {
    handleCloseRef.current();
    onOpenChange?.(false);
  }, [onOpenChange]);

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
    const timer = requestAnimationFrame(() => {
      const firstInput = cardRef.current?.querySelector<HTMLElement>(
        'input:not([type="hidden"]), textarea, [role="combobox"]'
      );
      firstInput?.focus();
    });
    return () => cancelAnimationFrame(timer);
  }, [open]);

  if (!open) return null;

  const content = (
    <>
      {/* Backdrop: z-40, pointer-events-auto, closes on click */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-200"
        style={{ animationDuration: "180ms" }}
        aria-hidden
        onClick={handleClose}
      />
      {/* Center wrapper: z-50, pointer-events-none so backdrop receives outside clicks */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
        aria-hidden
      >
        {/* Modal card: pointer-events-auto, stops propagation so inside clicks don't close */}
        <div
          ref={cardRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? "modal-title" : undefined}
          data-state={open ? "open" : "closed"}
          className={cn(
            "relative z-10 w-full pointer-events-auto",
            "rounded-2xl border border-border bg-card text-card-foreground",
            "shadow-xl shadow-black/20 dark:shadow-black/40",
            "animate-in zoom-in-95 fade-in-0 duration-200",
            SIZE_CLASSES[size],
            scrollable && "flex flex-col max-h-[90vh] overflow-hidden",
            className
          )}
          style={{ animationDuration: "180ms" }}
          onClick={(e) => e.stopPropagation()}
          data-testid={dataTestId}
        >
          {/* Subtle inner gradient overlay - decorative, pointer-events-none */}
          <div
            className="absolute inset-0 rounded-2xl pointer-events-none z-0"
            style={{
              background:
                "linear-gradient(to bottom, hsl(var(--card)) 0%, hsl(var(--muted) / 0.3) 100%)",
              opacity: 0.5,
            }}
          />
          <div className={cn("relative z-10", scrollable ? "flex flex-col overflow-hidden flex-1 min-h-0" : "")}>
            {/* Header: title + close button */}
            {(title || !hideCloseButton) && (
              <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-0">
                {title ? (
                  <h2 id="modal-title" className="text-xl font-semibold font-display leading-tight">
                    {title}
                  </h2>
                ) : (
                  <span />
                )}
                {!hideCloseButton && (
                  <button
                    type="button"
                    onClick={handleClose}
                    className="rounded-md p-1.5 opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 shrink-0"
                    aria-label="Close"
                    data-testid="modal-close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
            <div
              className={cn(
                "px-6",
                title || !hideCloseButton ? "pt-4" : "pt-6",
                "pb-6",
                scrollable && "overflow-y-auto flex-1 min-h-0"
              )}
            >
              {children}
            </div>
            {footer !== undefined && footer !== null && footer !== false && (
              <div className="px-6 pb-6 pt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 border-t border-border/50">
                {footer}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(content, document.body);
}

Modal.displayName = "Modal";
