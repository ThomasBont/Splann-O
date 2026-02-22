import { useLanguage, LANGUAGES } from "@/hooks/use-language";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { SplannoLogo } from "@/components/splanno-logo";
import { UserCircle } from "lucide-react";

export default function Landing() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-white/5 py-3 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SplannoLogo size="sm" iconOnly />
          <span className="font-display font-bold text-primary text-sm sm:text-base truncate">
            {t.title}
          </span>
        </div>
        <div className="flex rounded-lg border border-white/10 overflow-hidden">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              className={`px-2.5 py-1.5 text-xs font-bold transition-colors ${
                language === lang.code
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-white/5"
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </header>

      <main className="relative flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12 overflow-hidden">
        {/* Watermark: subtle logo behind content, non-interactive */}
        <div
          className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none"
          aria-hidden
        >
          <div className="translate-y-[-5%] scale-150 sm:scale-[2] opacity-[0.06] sm:opacity-[0.07]">
            <SplannoLogo size="2xl" iconOnly />
          </div>
        </div>

        {/* Content above watermark */}
        <div className="relative z-10 flex flex-col items-center w-full">
          <div className="scale-[0.75] sm:scale-100 origin-center mb-6 sm:mb-8">
            <SplannoLogo size="xl" />
          </div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-center text-foreground mb-2">
            {t.landing.heading}
          </h1>
          <p className="text-sm text-muted-foreground text-center mb-8 max-w-sm">
            {t.landing.subheading}
          </p>

          <div className="grid sm:grid-cols-2 gap-4 w-full max-w-lg">
            <Link href="/basic" className="block h-full">
              <div className="h-full p-6 rounded-2xl border border-white/10 bg-card/60 hover:bg-card/80 hover:border-primary/30 transition-all text-left group">
                <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center mb-4 group-hover:bg-primary/20 text-[hsl(var(--brand-primary))]">
                  <SplannoLogo size="sm" iconOnly />
                </div>
                <h2 className="font-semibold text-foreground mb-1">{t.landing.basicTitle}</h2>
                <p className="text-xs text-muted-foreground mb-4">{t.landing.basicDesc}</p>
                <span className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full inline-flex justify-center")}>
                  {t.landing.tryBasic}
                </span>
              </div>
            </Link>

            <Link href="/login" className="block h-full">
              <div className="h-full p-6 rounded-2xl border border-white/10 bg-card/60 hover:bg-card/80 hover:border-primary/30 transition-all text-left group">
                <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center mb-4 group-hover:bg-primary/20">
                  <UserCircle className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                </div>
                <h2 className="font-semibold text-foreground mb-1">{t.landing.fullTitle}</h2>
                <p className="text-xs text-muted-foreground mb-4">{t.landing.fullDesc}</p>
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
