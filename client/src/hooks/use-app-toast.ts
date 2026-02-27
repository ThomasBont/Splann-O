import { useToast } from "@/hooks/use-toast";

export function useAppToast() {
  const { toast } = useToast();

  return {
    toastSuccess: (message: string, title?: string) =>
      toast({ variant: "success", title, message }),
    toastError: (message: string, title?: string) =>
      toast({ variant: "error", title, message }),
    toastInfo: (message: string, title?: string) =>
      toast({ variant: "info", title, message }),
    toastWarning: (message: string, title?: string) =>
      toast({ variant: "warning", title, message }),
  };
}
