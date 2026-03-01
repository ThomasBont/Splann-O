import * as React from "react";

export type ToastVariant = "success" | "error" | "info" | "warning" | "loading";

export interface ToastOptions {
  title?: string;
  /** Primary message. Legacy: "description" is aliased to message. */
  message?: string;
  /** @deprecated Use message. Kept for backward compatibility. */
  description?: string;
  variant?: ToastVariant | "default" | "destructive";
  duration?: number;
  actionLabel?: string;
  onAction?: () => void;
  dismissLabel?: string;
  onDismiss?: () => void;
}

export interface ToastItem extends Omit<ToastOptions, "description"> {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
  addedAt: number;
  timerId: ReturnType<typeof setTimeout> | null;
  timerStartedAt: number | null;
  /** When paused (hover), remaining ms until auto-dismiss */
  pauseRemaining: number | null;
}

const MAX_VISIBLE = 4;
const DEFAULT_DURATION = 3500;
const COALESCE_WINDOW_MS = 2000;

function genId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

const store: ToastItem[] = [];
const listeners = new Set<() => void>();
let isDismissingAll = false;

function emit() {
  listeners.forEach((fn) => fn());
}

function clearTimer(item: ToastItem) {
  if (item.timerId) {
    clearTimeout(item.timerId);
    item.timerId = null;
  }
}

function startTimer(item: ToastItem, remainingMs?: number) {
  clearTimer(item);
  if (item.variant === "loading") return;
  const ms = remainingMs ?? item.duration;
  if (ms <= 0) return;
  item.timerStartedAt = Date.now();
  item.timerId = setTimeout(() => {
    item.timerId = null;
    item.timerStartedAt = null;
    dismissToast(item.id);
  }, ms);
}

function findCoalesceMatch(opts: ToastOptions): ToastItem | null {
  const now = Date.now();
  const msg = opts.message ?? opts.description ?? opts.title ?? "";
  const variant = opts.variant === "destructive" ? "error" : opts.variant === "default" || !opts.variant ? "info" : opts.variant;
  const key = `${opts.title ?? ""}|${msg}|${variant}`;
  for (const t of store) {
    if (t.variant === "loading") continue;
    const tKey = `${t.title ?? ""}|${t.message}|${t.variant}`;
    if (tKey === key && now - t.addedAt < COALESCE_WINDOW_MS) return t;
  }
  return null;
}

function makeRoom(excludeId?: string) {
  const nonLoading = store.filter((t) => t.variant !== "loading" && t.id !== excludeId);
  if (store.length >= MAX_VISIBLE && nonLoading.length > 0) {
    const toRemove = nonLoading[nonLoading.length - 1];
    clearTimer(toRemove);
    const idx = store.indexOf(toRemove);
    if (idx > -1) store.splice(idx, 1);
  }
}

function normalizeOptions(opts: ToastOptions): ToastOptions {
  const desc = opts.description ?? opts.message;
  const hasDesc = desc != null && desc !== "";
  const message = opts.message ?? opts.description ?? opts.title ?? "";
  const title = hasDesc ? opts.title : undefined;
  const variant =
    opts.variant === "destructive"
      ? "error"
      : opts.variant === "default" || !opts.variant
        ? "info"
        : opts.variant;
  return { ...opts, message, title, variant };
}

export function toast(opts: ToastOptions): string {
  const normalized = normalizeOptions(opts);
  const variant = normalized.variant as ToastVariant;
  const duration = normalized.duration ?? (variant === "loading" ? 0 : DEFAULT_DURATION);
  const message = normalized.message!;

  const match = findCoalesceMatch(normalized);
  if (match) {
    updateToast(match.id, {
      ...normalized,
      duration,
    });
    return match.id;
  }

  const id = genId();
  const item: ToastItem = {
    id,
    title: normalized.title,
    message,
    variant,
    duration,
    actionLabel: normalized.actionLabel,
    onAction: normalized.onAction,
    dismissLabel: normalized.dismissLabel ?? "Dismiss",
    onDismiss: normalized.onDismiss,
    addedAt: Date.now(),
    timerId: null,
    timerStartedAt: null,
    pauseRemaining: null,
  };

  makeRoom(id);
  store.unshift(item);
  startTimer(item);
  emit();
  return id;
}

export function dismissToast(id?: string): void {
  if (id) {
    const item = store.find((t) => t.id === id);
    if (item) {
      clearTimer(item);
      item.onDismiss?.();
      const idx = store.indexOf(item);
      if (idx > -1) store.splice(idx, 1);
    }
  } else {
    if (isDismissingAll) return;
    isDismissingAll = true;
    store.forEach((t) => {
      clearTimer(t);
      t.onDismiss?.();
    });
    store.length = 0;
    isDismissingAll = false;
  }
  emit();
}

export function pauseToast(id: string): void {
  const item = store.find((t) => t.id === id);
  if (!item || item.variant === "loading") return;
  if (item.timerId && item.timerStartedAt != null && item.duration > 0) {
    const elapsed = Date.now() - item.timerStartedAt;
    item.pauseRemaining = Math.max(0, item.duration - elapsed);
  }
  clearTimer(item);
  item.timerStartedAt = null;
}

export function resumeToast(id: string): void {
  const item = store.find((t) => t.id === id);
  if (!item || item.variant === "loading") return;
  const remaining = item.pauseRemaining ?? item.duration;
  item.pauseRemaining = null;
  startTimer(item, remaining);
}

export function updateToast(id: string, patch: Partial<ToastOptions>): void {
  const item = store.find((t) => t.id === id);
  if (!item) return;

  if (patch.title !== undefined) item.title = patch.title;
  if (patch.message !== undefined) item.message = patch.message;
  if (patch.description !== undefined) item.message = patch.description;
  if (patch.variant !== undefined) {
    item.variant =
      patch.variant === "destructive"
        ? "error"
        : patch.variant === "default"
          ? "info"
          : (patch.variant as ToastVariant);
  }
  if (patch.duration !== undefined) item.duration = patch.duration;
  if (patch.actionLabel !== undefined) item.actionLabel = patch.actionLabel;
  if (patch.onAction !== undefined) item.onAction = patch.onAction;
  if (patch.dismissLabel !== undefined) item.dismissLabel = patch.dismissLabel;
  if (patch.onDismiss !== undefined) item.onDismiss = patch.onDismiss;

  clearTimer(item);
  const newDuration = patch.duration ?? item.duration;
  if (item.variant !== "loading" && newDuration > 0) {
    startTimer(item, newDuration);
  }
  emit();
}

export function useToast() {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const getSnapshot = React.useCallback(() => [...store], []);
  const areEqual = React.useCallback((a: ToastItem[], b: ToastItem[]) => {
    if (a === b) return true;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      const left = a[i];
      const right = b[i];
      if (
        left.id !== right.id ||
        left.message !== right.message ||
        left.title !== right.title ||
        left.variant !== right.variant ||
        left.duration !== right.duration ||
        left.actionLabel !== right.actionLabel ||
        left.dismissLabel !== right.dismissLabel ||
        left.addedAt !== right.addedAt
      ) {
        return false;
      }
    }
    return true;
  }, []);

  React.useEffect(() => {
    setToasts((prev) => {
      const next = getSnapshot();
      return areEqual(prev, next) ? prev : next;
    });
    const onUpdate = () => {
      setToasts((prev) => {
        const next = getSnapshot();
        return areEqual(prev, next) ? prev : next;
      });
    };
    listeners.add(onUpdate);
    return () => {
      listeners.delete(onUpdate);
    };
  }, [areEqual, getSnapshot]);

  return {
    toasts,
    toast,
    dismissToast,
    updateToast,
    pauseToast,
    resumeToast,
  };
}
