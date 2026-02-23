import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SplannoLogo } from "@/components/splanno-logo";
import { EyeOff, Eye, CheckCircle2, AlertCircle } from "lucide-react";

export default function ResetPassword() {
  const { t } = useLanguage();
  const { resetPassword } = useAuth();
  const [, setLocation] = useLocation();

  const token = new URLSearchParams(window.location.search).get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleReset = async () => {
    setError("");
    if (!password || !confirm) return;
    if (password !== confirm) { setError(t.auth.passwordsNoMatch); return; }
    if (!token) { setError(t.auth.tokenInvalid); return; }

    try {
      await resetPassword.mutateAsync({ token, password });
      setSuccess(true);
    } catch (e: any) {
      const msg = e.message;
      if (msg === "invalid_token" || msg === "token_already_used" || msg === "token_expired") {
        setError(t.auth.tokenInvalid);
      } else {
        setError(msg);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm bg-card border border-white/10 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-2 mb-6">
          <SplannoLogo variant="icon" size={28} />
          <h1 className="font-display text-primary font-bold text-lg">{t.title}</h1>
        </div>

        {!token ? (
          <div className="text-center py-4">
            <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{t.auth.tokenInvalid}</p>
            <Button className="mt-4 w-full" onClick={() => setLocation("/")}>{t.auth.backToLogin}</Button>
          </div>
        ) : success ? (
          <div className="text-center py-4">
            <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
            <p className="font-semibold text-green-400 mb-1">{t.auth.passwordResetSuccess}</p>
            <Button className="mt-4 w-full" onClick={() => setLocation("/")}>{t.auth.backToLogin}</Button>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-bold mb-1">{t.auth.resetPasswordBtn}</h2>
            <p className="text-sm text-muted-foreground mb-5">{t.auth.forgotPasswordSubtitle}</p>

            <div className="space-y-4">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block">
                  {t.auth.newPassword}
                </Label>
                <div className="relative">
                  <Input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleReset()}
                    placeholder="••••••••"
                    className="pr-10"
                    data-testid="input-new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block">
                  {t.auth.confirmPassword}
                </Label>
                <Input
                  type={showPw ? "text" : "password"}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleReset()}
                  placeholder="••••••••"
                  data-testid="input-confirm-new-password"
                />
              </div>

              {error && (
                <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
              )}

              <Button
                className="w-full bg-primary text-primary-foreground font-bold"
                onClick={handleReset}
                disabled={resetPassword.isPending || !password || !confirm}
                data-testid="button-reset-password"
              >
                {resetPassword.isPending ? "..." : t.auth.resetPasswordBtn}
              </Button>

              <button
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors pt-1"
                onClick={() => setLocation("/")}
                data-testid="link-back-to-login"
              >
                {t.auth.backToLogin}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
