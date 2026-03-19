import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type PanelState =
  | { type: "overview" }
  | { type: "expense"; id: string }
  | { type: "expenses" }
  | { type: "photos" }
  | { type: "notes" }
  | {
    type: "add-expense";
    source?: "overview" | "expenses";
    editExpenseId?: number | null;
    initialResolutionMode?: "later" | "now";
    prefill?: {
      amount?: number | null;
      item?: string | null;
      paidBy?: string | null;
      splitCount?: number | null;
    } | null;
  }
  | { type: "settlement"; settlementId?: string; createMode?: "direct-split" | "balance-settlement" }
  | { type: "polls" }
  | { type: "add-poll"; source?: "polls" | "overview" }
  | { type: "crew" }
  | { type: "invite"; source?: "overview" | "crew" }
  | { type: "member-profile"; username: string; source?: "overview" | "crew" }
  | { type: "next-action" }
  | { type: "recent-activity" }
  | { type: "plan-details" }
  | null;

type PanelContextValue = {
  panel: PanelState;
  openPanel: (panel: Exclude<PanelState, null>) => void;
  closePanel: () => void;
  replacePanel: (panel: Exclude<PanelState, null>) => void;
};

const PanelContext = createContext<PanelContextValue | null>(null);

export function PanelProvider({ children }: { children: ReactNode }) {
  const [panel, setPanel] = useState<PanelState>(null);

  const openPanel = useCallback((nextPanel: Exclude<PanelState, null>) => {
    setPanel(nextPanel);
  }, []);

  const closePanel = useCallback(() => {
    setPanel(null);
  }, []);

  const replacePanel = useCallback((nextPanel: Exclude<PanelState, null>) => {
    setPanel(nextPanel);
  }, []);

  const value = useMemo<PanelContextValue>(() => ({
    panel,
    openPanel,
    closePanel,
    replacePanel,
  }), [panel, openPanel, closePanel, replacePanel]);

  return (
    <PanelContext.Provider value={value}>
      {children}
    </PanelContext.Provider>
  );
}

export function usePanel() {
  const context = useContext(PanelContext);
  if (!context) throw new Error("usePanel must be used within a PanelProvider.");
  return context;
}
