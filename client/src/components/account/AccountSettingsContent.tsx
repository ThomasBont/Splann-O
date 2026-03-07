import * as React from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage, SELECTABLE_LANGUAGES } from "@/hooks/use-language";
import { useTheme, type ThemePreference } from "@/hooks/use-theme";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

type AccountSettingsContentProps = {
  compact?: boolean;
};

export function AccountSettingsContent({ compact = false }: AccountSettingsContentProps) {
  const { user } = useAuth();
  const { language, setLanguage } = useLanguage();
  const { preference, setPreference } = useTheme();
  const buildId = import.meta.env.VITE_BUILD_ID as string | undefined;

  if (!user) {
    return <p className="text-sm text-muted-foreground">Sign in to manage settings.</p>;
  }

  const themeOptions: Array<{ value: ThemePreference; label: string }> = [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "system", label: "System" },
  ];

  return (
    <section className={compact ? "space-y-4" : "space-y-5"}>
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Settings</h3>
        <p className="text-xs text-muted-foreground">Language and theme for your account.</p>
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

      {import.meta.env.DEV ? (
        <p className="text-[10px] text-muted-foreground">Build: {buildId || "dev"}</p>
      ) : null}
    </section>
  );
}

export default AccountSettingsContent;
