import { createContext, useContext, useState, useCallback } from "react";
import type { UpgradeRequiredPayload } from "@/lib/upgrade";
import { UpgradeModal } from "@/components/UpgradeModal";

interface UpgradeContextValue {
  showUpgrade: (payload: UpgradeRequiredPayload) => void;
}

const UpgradeContext = createContext<UpgradeContextValue | null>(null);

export function UpgradeProvider({ children }: { children: React.ReactNode }) {
  const [payload, setPayload] = useState<UpgradeRequiredPayload | null>(null);
  const [open, setOpen] = useState(false);

  const showUpgrade = useCallback((p: UpgradeRequiredPayload) => {
    setPayload(p);
    setOpen(true);
  }, []);

  return (
    <UpgradeContext.Provider value={{ showUpgrade }}>
      {children}
      <UpgradeModal open={open} onOpenChange={setOpen} payload={payload} />
    </UpgradeContext.Provider>
  );
}

export function useUpgrade() {
  const ctx = useContext(UpgradeContext);
  if (!ctx) return { showUpgrade: () => {} };
  return ctx;
}
