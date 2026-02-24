"use client";

import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Toast } from "@/components/ui/toast";
import { ToastViewport } from "@/components/ui/toast-viewport";

export function ToastProvider() {
  const { toasts, dismissToast, pauseToast, resumeToast } = useToast();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && toasts.length > 0) {
        dismissToast(toasts[0].id);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toasts, dismissToast]);

  return (
    <ToastViewport>
      {toasts.map((item) => (
        <Toast
          key={item.id}
          item={item}
          onDismiss={dismissToast}
          onMouseEnter={pauseToast}
          onMouseLeave={resumeToast}
        />
      ))}
    </ToastViewport>
  );
}
