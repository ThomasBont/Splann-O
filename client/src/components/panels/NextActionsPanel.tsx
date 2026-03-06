import { PanelHeader, PanelShell } from "@/components/panels/panel-primitives";

export function NextActionPanel() {
  return (
    <PanelShell>
      <PanelHeader label="Next action" title="Next action" />
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 p-5">
          <p className="text-base font-semibold text-foreground">Next action</p>
          <p className="mt-2 text-sm text-muted-foreground">
            This space will help the group decide what to do next.
          </p>
          <p className="mt-4 text-sm font-medium text-foreground">A clear place for upcoming actions</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            <li>• settle balances</li>
            <li>• plan payments</li>
            <li>• assign tasks</li>
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">(Coming soon)</p>
        </div>
      </div>
    </PanelShell>
  );
}

export default NextActionPanel;
