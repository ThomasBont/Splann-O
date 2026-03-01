import { useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";

export function useAppToast() {
  const { toast } = useToast();
  const toastSuccess = useCallback((message: string, title?: string) => (
    toast({ variant: "success", title, message })
  ), [toast]);
  const toastError = useCallback((message: string, title?: string) => (
    toast({ variant: "error", title, message })
  ), [toast]);
  const toastInfo = useCallback((message: string, title?: string) => (
    toast({ variant: "info", title, message })
  ), [toast]);
  const toastWarning = useCallback((message: string, title?: string) => (
    toast({ variant: "warning", title, message })
  ), [toast]);

  return useMemo(() => ({
    toastSuccess,
    toastError,
    toastInfo,
    toastWarning,
  }), [toastSuccess, toastError, toastInfo, toastWarning]);
}
