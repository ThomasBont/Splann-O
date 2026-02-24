import { useLanguage, SELECTABLE_LANGUAGES } from "@/hooks/use-language";
import { useTheme } from "@/hooks/use-theme";
import { Link } from "wouter";
import { SplannoLogo } from "@/components/splanno-logo";
import { LandingHero } from "@/components/landing/LandingHero";
import { SocialProof } from "@/components/landing/SocialProof";
import { UseCases } from "@/components/landing/UseCases";
import { FeaturesGrid } from "@/components/landing/FeaturesGrid";
import { ViralCTA } from "@/components/landing/ViralCTA";
import { TrustBoosters } from "@/components/landing/TrustBoosters";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { Sun, Moon, Percent, Users, Palette, Coins } from "lucide-react";

export default function Landing() {
  const { language, setLanguage, t } = useLanguage();
  const { theme, setPreference } = useTheme();

  const useCases = [
    { emoji: "🎒", title: t.landing.useCaseTrips, description: t.landing.useCaseTripsDesc },
    { emoji: "🎉", title: t.landing.useCaseParties, description: t.landing.useCasePartiesDesc },
    { emoji: "🎪", title: t.landing.useCaseFestivals, description: t.landing.useCaseFestivalsDesc },
    { emoji: "🏠", title: t.landing.useCaseRoommates, description: t.landing.useCaseRoommatesDesc },
  ];

  const features = [
    { icon: <Percent className="w-6 h-6 text-primary" />, title: t.landing.featureSmartSplit, description: t.landing.featureSmartSplitDesc },
    { icon: <Users className="w-6 h-6 text-primary" />, title: t.landing.featureOptIn, description: t.landing.featureOptInDesc },
    { icon: <Palette className="w-6 h-6 text-primary" />, title: t.landing.featureThemes, description: t.landing.featureThemesDesc },
    { icon: <Coins className="w-6 h-6 text-primary" />, title: t.landing.featureMultiCurrency, description: t.landing.featureMultiCurrencyDesc },
  ];

  const faq = [
    { q: t.landing.faqFreeQ, a: t.landing.faqFreeA },
    { q: t.landing.faqAccountsQ, a: t.landing.faqAccountsA },
    { q: t.landing.faqCurrenciesQ, a: t.landing.faqCurrenciesA },
  ];

  const footerProduct = [
    { label: t.landing.footerLogin, href: "/login" },
    { label: t.landing.footerTryDemo, href: "/basic" },
  ];

  const footerFeatures = [
    { label: t.landing.featureSmartSplit, href: "#" },
    { label: t.landing.featureOptIn, href: "#" },
    { label: t.landing.featureThemes, href: "#" },
    { label: t.landing.featureMultiCurrency, href: "#" },
  ];

  const footerAbout: { label: string; href: string }[] = [];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border py-3 px-4 flex items-center justify-between sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Link href="/">
          <div className="flex items-center gap-3 cursor-pointer">
            <SplannoLogo variant="icon" size={40} />
            <span className="font-display font-bold text-primary text-base sm:text-lg truncate">
              {t.title}
            </span>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPreference(theme === "dark" ? "light" : "dark")}
            className="p-2 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <div className="flex rounded-xl border border-border overflow-hidden">
            {SELECTABLE_LANGUAGES.map((lang) => (
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

      <main className="flex-1">
        <LandingHero
          title={t.landing.heroTitle}
          subtitle={t.landing.heroSubtitle}
          ctaPrimary={t.landing.ctaStartFree}
          ctaSecondary={t.landing.ctaTryDemo}
          shareHook={t.landing.shareHook}
        />
        <SocialProof
          tagline={t.landing.socialProofTagline}
          eventsCount={t.landing.eventsSplit}
          sharedCosts={t.landing.sharedCosts}
          countries={t.landing.countries}
        />
        <UseCases title={t.landing.useCasesTitle} cases={useCases} />
        <FeaturesGrid title={t.landing.featuresTitle} features={features} />
        <ViralCTA
          title={t.landing.viralTitle}
          copy={t.landing.viralCopy}
          microCopy={t.landing.viralMicroCopy}
          ctaLabel={t.landing.viralCta}
        />
        <TrustBoosters
          noAds={t.landing.trustNoAds}
          noTracking={t.landing.trustNoTracking}
          fairSplits={t.landing.trustFairSplits}
          faq={faq}
        />
        <LandingFooter
          tagline={t.landing.footerTagline}
          product={footerProduct}
          features={footerFeatures}
          about={footerAbout}
        />
      </main>
    </div>
  );
}
