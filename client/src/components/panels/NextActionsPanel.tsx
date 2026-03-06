import { PanelHeader, PanelShell } from "@/components/panels/panel-primitives";

export function NextActionsPanel() {
  return (
    <PanelShell>
      <PanelHeader label="Next actions" title="Next actions" />
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 p-4 text-sm text-muted-foreground">
          Next actions can be surfaced here without leaving the chat.
        </div>
      </div>
    </PanelShell>
  );
}

export default NextActionsPanel;
