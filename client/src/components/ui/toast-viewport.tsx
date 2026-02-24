"use client";

import * as React from "react";
import { createPortal } from "react-dom";

export interface ToastViewportProps {
  children: React.ReactNode;
  className?: string;
}

export function ToastViewport({ children, className = "" }: ToastViewportProps) {
  const content = (
    <div
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 p-4 flex flex-col-reverse gap-3 max-h-[50vh] overflow-hidden pointer-events-none z-[9999] sm:bottom-auto sm:top-4 sm:right-4 sm:left-auto sm:translate-x-0 sm:flex-col md:max-w-[420px] w-full max-w-[calc(100vw-2rem)] sm:max-h-screen ${className}`}
      aria-live="polite"
      aria-label="Notifications"
    >
      {children}
    </div>
  );

  return createPortal(content, document.body);
}
