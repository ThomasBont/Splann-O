import { useLanguage, LANGUAGES } from "@/hooks/use-language";
import { Receipt } from "lucide-react";
import { AuthDialog } from "@/pages/home";

/**
 * Minimal shell for /app when not authenticated. Only uses useAuth + useLanguage
 * so we never run auth-dependent data hooks (useBarbecues, useFriends, etc.),
 * avoiding 401s and blank page.
 */
export function LoginShell({
  isCheckingAuth = false,
}: {
  isCheckingAuth?: boolean;
}) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="min-h-screen pb-20">
      <AuthDialog
        open={true}
        onOpenChange={() => {}}
        isCheckingAuth={isCheckingAuth}
      />

      <header
        className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-white/5"
        data-testid="header"
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="bg-gradient-to-br from-primary to-accent p-1.5 sm:p-2 rounded-lg shadow-lg shadow-orange-500/20 flex-shrink-0">
              <Receipt className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1
                className="text-base sm:text-xl md:text-2xl font-bold font-display text-primary tracking-tight truncate"
                data-testid="text-app-title"
              >
                {t.title}
              </h1>
              <p className="hidden md:block text-xs text-muted-foreground uppercase tracking-widest font-medium">
                {t.subtitle}
              </p>
            </div>
          </div>

          <div className="flex rounded-lg border border-white/10 overflow-hidden" data-testid="language-tabs">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => setLanguage(lang.code)}
                className={`px-2.5 py-1.5 text-xs font-bold transition-colors ${
                  language === lang.code
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
                data-testid={`button-lang-${lang.code}`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>
      </header>
    </div>
  );
}
