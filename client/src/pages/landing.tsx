import { useLanguage, LANGUAGES } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Receipt, UserCircle } from "lucide-react";

export default function Landing() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-white/5 py-3 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-gradient-to-br from-primary to-accent p-1.5 rounded-lg">
            <Receipt className="w-5 h-5 text-white" />
          </div>
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

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12">
        <h1 className="text-xl sm:text-2xl font-display font-bold text-center text-foreground mb-2">
          {t.landing.heading}
        </h1>
        <p className="text-sm text-muted-foreground text-center mb-8 max-w-sm">
          {t.landing.subheading}
        </p>

        <div className="grid sm:grid-cols-2 gap-4 w-full max-w-lg">
          <Link href="/basic">
            <a className="block">
              <div className="h-full p-6 rounded-2xl border border-white/10 bg-card/60 hover:bg-card/80 hover:border-primary/30 transition-all text-left group">
                <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center mb-4 group-hover:bg-primary/20">
                  <Receipt className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                </div>
                <h2 className="font-semibold text-foreground mb-1">{t.landing.basicTitle}</h2>
                <p className="text-xs text-muted-foreground mb-4">{t.landing.basicDesc}</p>
                <Button variant="outline" size="sm" className="w-full">
                  {t.landing.tryBasic}
                </Button>
              </div>
            </a>
          </Link>

          <Link href="/app">
            <a className="block">
              <div className="h-full p-6 rounded-2xl border border-white/10 bg-card/60 hover:bg-card/80 hover:border-primary/30 transition-all text-left group">
                <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center mb-4 group-hover:bg-primary/20">
                  <UserCircle className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                </div>
                <h2 className="font-semibold text-foreground mb-1">{t.landing.fullTitle}</h2>
                <p className="text-xs text-muted-foreground mb-4">{t.landing.fullDesc}</p>
                <Button size="sm" className="w-full bg-primary text-primary-foreground">
                  {t.landing.logInFull}
                </Button>
              </div>
            </a>
          </Link>
        </div>
      </main>
    </div>
  );
}
