import * as React from "react";
import { Check, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage, SELECTABLE_LANGUAGES } from "@/hooks/use-language";
import { useTheme, type ThemePreference } from "@/hooks/use-theme";
import { useToast } from "@/hooks/use-toast";
import { CurrencyPicker } from "@/components/currency-picker";
import { Button } from "@/components/ui/button";

type AccountSettingsContentProps = {
  compact?: boolean;
};

export function AccountSettingsContent({ compact = false }: AccountSettingsContentProps) {
  const { user, updateProfile } = useAuth();
  const { language, setLanguage } = useLanguage();
  const { preference, setPreference } = useTheme();
  const { toast } = useToast();
  const [defaultCurrencyCode, setDefaultCurrencyCode] = React.useState("EUR");
  const buildId = import.meta.env.VITE_BUILD_ID as string | undefined;

  React.useEffect(() => {
    if (!user) return;
    setDefaultCurrencyCode(user.defaultCurrencyCode || "EUR");
  }, [user?.id, user?.defaultCurrencyCode]);

  if (!user) {
    return <p className="text-sm text-muted-foreground">Sign in to manage settings.</p>;
  }

  const hasChanges = (user.defaultCurrencyCode || "EUR") !== defaultCurrencyCode;
  const themeOptions: Array<{ value: ThemePreference; label: string }> = [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "system", label: "System" },
  ];

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
        <p className="text-xs text-muted-foreground">Language, theme, and defaults for your account.</p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Language</label>
        <div className="grid grid-cols-4 gap-2">
          {SELECTABLE_LANGUAGES.map((lang) => (
            <Button
              key={lang.code}
              type="button"
              variant={language === lang.code ? "default" : "outline"}
              className="h-9 px-2"
              onClick={() => setLanguage(lang.code)}
            >
              {lang.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Theme</label>
        <div className="grid grid-cols-3 gap-2">
          {themeOptions.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={preference === option.value ? "default" : "outline"}
              className="h-9 px-2"
              onClick={() => setPreference(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
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

      {import.meta.env.DEV ? (
        <p className="text-[10px] text-muted-foreground">Build: {buildId || "dev"}</p>
      ) : null}
    </section>
  );
}

export default AccountSettingsContent;
