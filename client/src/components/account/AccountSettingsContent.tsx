import * as React from "react";
import { Check, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { CurrencyPicker } from "@/components/currency-picker";
import { Button } from "@/components/ui/button";

type AccountSettingsContentProps = {
  compact?: boolean;
};

export function AccountSettingsContent({ compact = false }: AccountSettingsContentProps) {
  const { user, updateProfile } = useAuth();
  const { toast } = useToast();
  const [defaultCurrencyCode, setDefaultCurrencyCode] = React.useState("EUR");

  React.useEffect(() => {
    if (!user) return;
    setDefaultCurrencyCode(user.defaultCurrencyCode || "EUR");
  }, [user?.id, user?.defaultCurrencyCode]);

  if (!user) {
    return <p className="text-sm text-muted-foreground">Sign in to manage settings.</p>;
  }

  const hasChanges = (user.defaultCurrencyCode || "EUR") !== defaultCurrencyCode;

  const saveSettings = async () => {
    try {
      await updateProfile.mutateAsync({
        defaultCurrencyCode: defaultCurrencyCode.toUpperCase(),
      });
      toast({ title: "Saved", variant: "success" });
    } catch (error) {
      toast({ title: (error as Error).message || "Failed to save", variant: "destructive" });
    }
  };

  return (
    <section className={compact ? "space-y-4" : "space-y-5"}>
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Settings</h3>
        <p className="text-xs text-muted-foreground">Choose the default currency for new plans.</p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Default currency</label>
        <CurrencyPicker
          value={defaultCurrencyCode}
          onChange={setDefaultCurrencyCode}
          recentStorageUserKey={`user-${user.id}`}
          triggerClassName="w-full justify-between"
          className="w-full max-w-full"
        />
      </div>

      <div className="flex items-center justify-end pt-1">
        <Button onClick={saveSettings} disabled={!hasChanges || updateProfile.isPending}>
          {updateProfile.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
          Save
        </Button>
      </div>
    </section>
  );
}

export default AccountSettingsContent;
