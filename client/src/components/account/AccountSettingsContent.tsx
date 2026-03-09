import * as React from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage, SELECTABLE_LANGUAGES, type Language } from "@/hooks/use-language";
import { useTheme, type ThemePreference } from "@/hooks/use-theme";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

type AccountSettingsContentProps = {
  compact?: boolean;
};

const ACCOUNT_SETTINGS_COPY: Record<Language, {
  signIn: string;
  title: string;
  subtitle: string;
  language: string;
  theme: string;
  light: string;
  dark: string;
  system: string;
  developmentBuild: string;
}> = {
  en: {
    signIn: "Sign in to manage settings.",
    title: "Settings",
    subtitle: "Language and theme for your account.",
    language: "Language",
    theme: "Theme",
    light: "Light",
    dark: "Dark",
    system: "System",
    developmentBuild: "Development build",
  },
  es: {
    signIn: "Iniciá sesión para gestionar la configuración.",
    title: "Configuración",
    subtitle: "Idioma y tema para tu cuenta.",
    language: "Idioma",
    theme: "Tema",
    light: "Claro",
    dark: "Oscuro",
    system: "Sistema",
    developmentBuild: "Build de desarrollo",
  },
  it: {
    signIn: "Accedi per gestire le impostazioni.",
    title: "Impostazioni",
    subtitle: "Lingua e tema del tuo account.",
    language: "Lingua",
    theme: "Tema",
    light: "Chiaro",
    dark: "Scuro",
    system: "Sistema",
    developmentBuild: "Build di sviluppo",
  },
  nl: {
    signIn: "Log in om instellingen te beheren.",
    title: "Instellingen",
    subtitle: "Taal en thema voor je account.",
    language: "Taal",
    theme: "Thema",
    light: "Licht",
    dark: "Donker",
    system: "Systeem",
    developmentBuild: "Ontwikkelbuild",
  },
};

export function AccountSettingsContent({ compact = false }: AccountSettingsContentProps) {
  const { user } = useAuth();
  const { language, setLanguage } = useLanguage();
  const { preference, setPreference } = useTheme();
  const buildId = import.meta.env.VITE_BUILD_ID as string | undefined;
  const copy = ACCOUNT_SETTINGS_COPY[language];

  if (!user) {
    return <p className="text-sm text-muted-foreground">{copy.signIn}</p>;
  }

  const themeOptions: Array<{ value: ThemePreference; label: string }> = [
    { value: "light", label: copy.light },
    { value: "dark", label: copy.dark },
    { value: "system", label: copy.system },
  ];

  return (
    <section className={compact ? "space-y-4" : "space-y-5"}>
      <div className="space-y-1">
        <h3 className="text-base font-semibold">{copy.title}</h3>
        <p className="text-xs text-muted-foreground">{copy.subtitle}</p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">{copy.language}</label>
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
        <label className="text-sm font-medium">{copy.theme}</label>
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

      {import.meta.env.DEV && buildId ? (
        <p className="text-[10px] text-muted-foreground">{copy.developmentBuild}: {buildId}</p>
      ) : null}
    </section>
  );
}

export default AccountSettingsContent;
