import { useEffect, useState } from "react";
import { CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { useLanguage, type Language } from "@/hooks/use-language";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { SplannOLogo } from "@/components/branding/SplannOLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type AuthMode = "login" | "signup";
type AuthTab = "login" | "register" | "forgot" | "sent";

type AuthDrawerProps = {
  open: boolean;
  mode: AuthMode;
  onOpenChange: (open: boolean) => void;
  onModeChange: (mode: AuthMode) => void;
  onSuccess?: () => void;
};

const AUTH_DRAWER_COPY: Record<Language, {
  continueWithGoogle: string;
  dividerOr: string;
  emailPlaceholder: string;
  passwordPlaceholder: string;
}> = {
  en: {
    continueWithGoogle: "Continue with Google",
    dividerOr: "or",
    emailPlaceholder: "you@example.com",
    passwordPlaceholder: "••••••",
  },
  es: {
    continueWithGoogle: "Continuar con Google",
    dividerOr: "o",
    emailPlaceholder: "tu@ejemplo.com",
    passwordPlaceholder: "••••••",
  },
  it: {
    continueWithGoogle: "Continua con Google",
    dividerOr: "oppure",
    emailPlaceholder: "tu@esempio.com",
    passwordPlaceholder: "••••••",
  },
  nl: {
    continueWithGoogle: "Doorgaan met Google",
    dividerOr: "of",
    emailPlaceholder: "jij@voorbeeld.com",
    passwordPlaceholder: "••••••",
  },
};

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.2-.9 2.2-1.9 2.9v2.4h3.1c1.8-1.7 2.8-4.2 2.8-7.2 0-.7-.1-1.3-.2-2H12z" />
      <path fill="#34A853" d="M12 21c2.5 0 4.6-.8 6.2-2.3l-3.1-2.4c-.9.6-1.9 1-3.1 1-2.4 0-4.4-1.6-5.1-3.8H3.7v2.4C5.3 19 8.4 21 12 21z" />
      <path fill="#4A90E2" d="M6.9 13.5c-.2-.6-.3-1.1-.3-1.7s.1-1.2.3-1.7V7.7H3.7C3.2 8.8 3 10 3 11.8s.2 3  .7 4.1l3.2-2.4z" />
      <path fill="#FBBC05" d="M12 6.3c1.4 0 2.6.5 3.5 1.4l2.6-2.6C16.6 3.7 14.5 3 12 3 8.4 3 5.3 5 3.7 7.7l3.2 2.4c.7-2.2 2.7-3.8 5.1-3.8z" />
    </svg>
  );
}

export function AuthDrawer({
  open,
  mode,
  onOpenChange,
  onModeChange,
  onSuccess,
}: AuthDrawerProps) {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const { login, register, forgotPassword } = useAuth();
  const copy = AUTH_DRAWER_COPY[language];

  const [tab, setTab] = useState<AuthTab>(mode === "signup" ? "register" : "login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTab(mode === "signup" ? "register" : "login");
    setError("");
  }, [open, mode]);

  const switchTab = (next: AuthTab) => {
    setTab(next);
    setError("");
    if (next === "login") onModeChange("login");
    if (next === "register") onModeChange("signup");
  };

  const handleLogin = async () => {
    setError("");
    if (!username || !password) return;
    try {
      await login.mutateAsync({ username, password });
      onSuccess?.();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "login_failed";
      setError(message === "invalid_credentials" ? t.auth.invalidCredentials : message);
    }
  };

  const handleRegister = async () => {
    setError("");
    if (!username || !email || !password) return;
    if (password.length < 8) {
      setError(t.auth.passwordHint);
      return;
    }
    if (password !== confirm) {
      setError(t.auth.passwordsNoMatch);
      return;
    }
    try {
      const result = (await register.mutateAsync({
        username,
        email,
        displayName: displayName || undefined,
        password,
      })) as { emailSent?: boolean };
      if (result?.emailSent === false) toast({ title: t.auth.welcomeEmailNotSent, variant: "default" });
      onSuccess?.();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "register_failed";
      if (message === "username_taken") setError(t.auth.usernameTaken);
      else if (message === "email_taken") setError(t.auth.emailTaken);
      else setError(message);
    }
  };

  const handleForgot = async () => {
    setError("");
    if (!email) return;
    try {
      await forgotPassword.mutateAsync({ email });
      switchTab("sent");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "forgot_failed");
    }
  };

  const isLoading = login.isPending || register.isPending || forgotPassword.isPending;
  const handleGoogleContinue = () => {
    window.location.href = "/api/auth/google";
  };

  const titleByTab: Record<AuthTab, string> = {
    login: t.auth.loginTitle,
    register: t.auth.registerTitle,
    forgot: t.auth.forgotPasswordTitle,
    sent: t.auth.checkEmail,
  };
  const subtitleByTab: Record<AuthTab, string> = {
    login: t.auth.welcomeBack,
    register: t.auth.createAccount,
    forgot: t.auth.forgotPasswordSubtitle,
    sent: t.auth.checkEmailDesc,
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="h-full w-[420px] max-w-[92vw] border-l border-slate-200 bg-white p-0 shadow-2xl dark:border-neutral-800 dark:bg-[#121212]"
      >
        <div className="flex h-full flex-col">
          <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur dark:border-neutral-800 dark:bg-[#121212]/95">
            <SheetHeader className="space-y-1 text-left">
              <SheetTitle className="text-lg font-semibold text-slate-900 dark:text-neutral-100">{titleByTab[tab]}</SheetTitle>
              <SheetDescription className="text-sm text-slate-500 dark:text-neutral-400">{subtitleByTab[tab]}</SheetDescription>
            </SheetHeader>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div className="mb-4 flex items-center justify-center">
              <SplannOLogo className="pointer-events-none h-10 w-auto max-w-full" />
            </div>

            {(tab === "login" || tab === "register") ? (
              <div className="mb-4 flex rounded-lg border border-slate-200 overflow-hidden dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => switchTab("login")}
                  className={`flex-1 py-2 text-sm font-semibold transition-colors ${tab === "login" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-slate-50 dark:hover:bg-neutral-900"}`}
                >
                  {t.auth.login}
                </button>
                <button
                  type="button"
                  onClick={() => switchTab("register")}
                  className={`flex-1 py-2 text-sm font-semibold transition-colors ${tab === "register" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-slate-50 dark:hover:bg-neutral-900"}`}
                >
                  {t.auth.register}
                </button>
              </div>
            ) : null}

            {tab === "login" ? (
              <div className="space-y-3">
                <Button type="button" variant="outline" className="w-full gap-2" onClick={handleGoogleContinue}>
                  <GoogleIcon />
                  {copy.continueWithGoogle}
                </Button>
                <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
                  <div className="h-px flex-1 bg-border" />
                  <span>{copy.dividerOr}</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t.auth.username}</Label>
                  <Input
                    placeholder={t.user.usernamePlaceholder}
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && void handleLogin()}
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t.auth.password}</Label>
                  <div className="relative">
                    <Input
                      type={showPw ? "text" : "password"}
                      placeholder={copy.passwordPlaceholder}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      onKeyDown={(event) => event.key === "Enter" && void handleLogin()}
                      className="pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((prev) => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    className="float-right text-[11px] text-primary hover:underline"
                    onClick={() => {
                      setEmail("");
                      switchTab("forgot");
                    }}
                  >
                    {t.auth.forgotPassword}
                  </button>
                </div>
                {error ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
                <Button
                  onClick={() => void handleLogin()}
                  disabled={isLoading || !username || !password}
                  className="w-full bg-primary text-primary-foreground font-bold"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.auth.login}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  {t.auth.dontHaveAccount}{" "}
                  <button type="button" onClick={() => switchTab("register")} className="font-semibold text-primary hover:underline">
                    {t.auth.register}
                  </button>
                </p>
              </div>
            ) : null}

            {tab === "register" ? (
              <div className="space-y-3">
                <Button type="button" variant="outline" className="w-full gap-2" onClick={handleGoogleContinue}>
                  <GoogleIcon />
                  {copy.continueWithGoogle}
                </Button>
                <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
                  <div className="h-px flex-1 bg-border" />
                  <span>{copy.dividerOr}</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t.auth.displayName}</Label>
                  <Input
                    placeholder={t.auth.displayNamePlaceholder}
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t.auth.username}</Label>
                  <Input
                    placeholder={t.user.usernamePlaceholder}
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">{t.auth.usernameHint}</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t.auth.email}</Label>
                  <Input
                    type="email"
                    placeholder={copy.emailPlaceholder}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t.auth.password}</Label>
                  <div className="relative">
                    <Input
                      type={showPw ? "text" : "password"}
                      placeholder={copy.passwordPlaceholder}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((prev) => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{t.auth.passwordHint}</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t.auth.confirmPassword}</Label>
                  <Input
                    type={showPw ? "text" : "password"}
                    placeholder={copy.passwordPlaceholder}
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && void handleRegister()}
                  />
                </div>
                {error ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
                <Button
                  onClick={() => void handleRegister()}
                  disabled={isLoading || !username || !email || !password || !confirm}
                  className="w-full bg-primary text-primary-foreground font-bold"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.auth.register}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  {t.auth.alreadyHaveAccount}{" "}
                  <button type="button" onClick={() => switchTab("login")} className="font-semibold text-primary hover:underline">
                    {t.auth.login}
                  </button>
                </p>
              </div>
            ) : null}

            {tab === "forgot" ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t.auth.email}</Label>
                  <Input
                    type="email"
                    placeholder={copy.emailPlaceholder}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && void handleForgot()}
                    autoFocus
                  />
                </div>
                {error ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
                <Button
                  onClick={() => void handleForgot()}
                  disabled={isLoading || !email}
                  className="w-full bg-primary text-primary-foreground font-bold"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.auth.sendResetLink}
                </Button>
                <button
                  type="button"
                  className="w-full text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => switchTab("login")}
                >
                  ← {t.auth.backToLogin}
                </button>
              </div>
            ) : null}

            {tab === "sent" ? (
              <div className="space-y-3 py-4 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                </div>
                <p className="text-sm text-muted-foreground">{t.auth.forgotPasswordSuccessGeneric}</p>
                <button type="button" onClick={() => switchTab("login")} className="text-xs font-semibold text-primary hover:underline">
                  {t.auth.backToLogin}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default AuthDrawer;
