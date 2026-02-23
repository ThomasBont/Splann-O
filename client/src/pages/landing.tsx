import { useLanguage, LANGUAGES } from "@/hooks/use-language";
import { useTheme } from "@/hooks/use-theme";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { SplannoLogo } from "@/components/splanno-logo";
import { UserCircle, Sun, Moon, Receipt } from "lucide-react";

export default function Landing() {
  const { language, setLanguage, t } = useLanguage();
  const { theme, setPreference } = useTheme();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border py-3 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SplannoLogo variant="icon" size={32} />
          <span className="font-display font-bold text-primary text-sm sm:text-base truncate">
            {t.title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPreference(theme === "dark" ? "light" : "dark")}
            className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <div className="flex rounded-lg border border-border overflow-hidden">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              className={`px-2.5 py-1.5 text-xs font-bold transition-colors ${
                language === lang.code
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {lang.label}
            </button>
          ))}
          </div>
        </div>
      </header>

      <main className="relative isolate flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12 overflow-hidden">
        {/* Readability veil above watermark, below content */}
        <div
          className="absolute inset-0 z-10 pointer-events-none bg-[radial-gradient(circle_at_50%_30%,hsl(var(--background)/0.18),hsl(var(--background)/0.72)_48%,hsl(var(--background)/0.92)_100%)]"
          aria-hidden
        />

        {/* Content above watermark + veil */}
        <div className="relative z-20 flex flex-col items-center w-full">
          <div className="scale-[0.75] sm:scale-100 origin-center mb-6 sm:mb-8">
            <SplannoLogo variant="full" size={88} />
          </div>
          <h1 className="font-hero text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-center text-foreground mb-2 sm:mb-3">
            {t.landing.heading}
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground text-center mb-10 sm:mb-12 max-w-xl mx-auto">
            {t.landing.subheading}
          </p>

          <div className="grid sm:grid-cols-2 gap-5 sm:gap-6 w-full max-w-2xl">
            <Link href="/basic" className="block h-full">
              <div className="h-full p-6 sm:p-7 rounded-[18px] border border-border bg-card shadow-hero-card hover:shadow-md hover:-translate-y-0.5 hover:border-primary/20 transition-all duration-200 text-left group">
                <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center mb-4 group-hover:bg-primary/20 text-[hsl(var(--brand-primary))]">
                  <Receipt className="w-5 h-5" />
                </div>
                <h2 className="font-semibold text-foreground mb-1">{t.landing.basicTitle}</h2>
                <p className="text-sm text-muted-foreground mb-4">{t.landing.basicDesc}</p>
                <span className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full inline-flex justify-center")}>
                  {t.landing.tryBasic}
                </span>
              </div>
            </Link>

            <Link href="/login" className="block h-full">
              <div className="h-full p-6 sm:p-7 rounded-[18px] border border-border bg-card shadow-hero-card hover:shadow-md hover:-translate-y-0.5 hover:border-primary/20 transition-all duration-200 text-left group">
                <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center mb-4 group-hover:bg-primary/20">
                  <UserCircle className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                </div>
                <h2 className="font-semibold text-foreground mb-1">{t.landing.fullTitle}</h2>
                <p className="text-sm text-muted-foreground mb-4">{t.landing.fullDesc}</p>
                <span className={cn(buttonVariants({ size: "sm" }), "w-full inline-flex justify-center bg-primary text-primary-foreground")}>
                  {t.landing.logInFull}
                </span>
              </div>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
