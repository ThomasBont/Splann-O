import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage, SELECTABLE_LANGUAGES, type Language } from "@/hooks/use-language";
import { useTheme, type ThemePreference } from "@/hooks/use-theme";
import { useToast } from "@/hooks/use-toast";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

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
  notifications: string;
  notificationsSubtitle: string;
  notificationsHint: string;
  notificationsChatMessages: string;
  notificationsExpenses: string;
  notificationsPaymentRequests: string;
  notificationsPlanInvites: string;
  notificationsStatus: string;
  notificationsEnabled: string;
  notificationsDisabled: string;
  notificationsUnsupported: string;
  notificationsSecureContext: string;
  notificationsIosHomeScreen: string;
  notificationsBlocked: string;
  notificationsEnabledToast: string;
  notificationsDisabledToast: string;
  notificationsFailed: string;
  notificationsAdvanced: string;
  notificationsShowAdvanced: string;
  notificationsHideAdvanced: string;
  telegram: string;
  telegramSubtitle: string;
  telegramConnectedAs: string;
  telegramNotConnected: string;
  telegramConnect: string;
  telegramDisconnect: string;
  telegramLoading: string;
  telegramBotMissing: string;
  telegramDomainHint: string;
  telegramLinkSuccess: string;
  telegramLinkError: string;
  telegramLinkAuthRequired: string;
  telegramDisconnectedToast: string;
  telegramDisconnectFailed: string;
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
    notifications: "Notifications",
    notificationsSubtitle: "Receive a notification when there is a new expense or payment request.",
    notificationsHint: "Choose exactly which push notifications you want to receive.",
    notificationsChatMessages: "All chat messages",
    notificationsExpenses: "New expenses",
    notificationsPaymentRequests: "Payment requests",
    notificationsPlanInvites: "Plan invites",
    notificationsStatus: "Status",
    notificationsEnabled: "On",
    notificationsDisabled: "Off",
    notificationsUnsupported: "Not supported on this device",
    notificationsSecureContext: "Push requires HTTPS or localhost.",
    notificationsIosHomeScreen: "On iPhone and iPad, install Splann-O to your Home Screen and open it from there.",
    notificationsBlocked: "Blocked in browser settings",
    notificationsEnabledToast: "Push notifications enabled",
    notificationsDisabledToast: "Push notifications disabled",
    notificationsFailed: "Unable to update notifications.",
    notificationsAdvanced: "Advanced options",
    notificationsShowAdvanced: "Show advanced",
    notificationsHideAdvanced: "Hide advanced",
    telegram: "Telegram",
    telegramSubtitle: "Link your Telegram identity for matching and future invite flows.",
    telegramConnectedAs: "Connected as",
    telegramNotConnected: "Not connected",
    telegramConnect: "Connect Telegram",
    telegramDisconnect: "Disconnect",
    telegramLoading: "Checking Telegram connection...",
    telegramBotMissing: "Telegram bot username is not configured on this environment.",
    telegramDomainHint: "If you see “Bot domain invalid”, add splanno.app in BotFather > /setdomain.",
    telegramLinkSuccess: "Telegram account connected.",
    telegramLinkError: "Telegram link failed. Check BotFather domain settings.",
    telegramLinkAuthRequired: "Please sign in again before connecting Telegram.",
    telegramDisconnectedToast: "Telegram disconnected",
    telegramDisconnectFailed: "Unable to disconnect Telegram.",
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
    notifications: "Notificaciones",
    notificationsSubtitle: "Recibe una notificación cuando haya un nuevo gasto o una solicitud de pago.",
    notificationsHint: "Elige exactamente qué notificaciones push quieres recibir.",
    notificationsChatMessages: "Todos los mensajes del chat",
    notificationsExpenses: "Nuevos gastos",
    notificationsPaymentRequests: "Solicitudes de pago",
    notificationsPlanInvites: "Invitaciones al plan",
    notificationsStatus: "Estado",
    notificationsEnabled: "Activadas",
    notificationsDisabled: "Desactivadas",
    notificationsUnsupported: "No compatible en este dispositivo",
    notificationsSecureContext: "Push requiere HTTPS o localhost.",
    notificationsIosHomeScreen: "En iPhone y iPad, instala Splann-O en tu pantalla de inicio y ábrelo desde allí.",
    notificationsBlocked: "Bloqueadas en la configuración del navegador",
    notificationsEnabledToast: "Notificaciones push activadas",
    notificationsDisabledToast: "Notificaciones push desactivadas",
    notificationsFailed: "No se pudieron actualizar las notificaciones.",
    notificationsAdvanced: "Opciones avanzadas",
    notificationsShowAdvanced: "Mostrar avanzadas",
    notificationsHideAdvanced: "Ocultar avanzadas",
    telegram: "Telegram",
    telegramSubtitle: "Vincula tu identidad de Telegram para matching e invitaciones futuras.",
    telegramConnectedAs: "Conectado como",
    telegramNotConnected: "No conectado",
    telegramConnect: "Conectar Telegram",
    telegramDisconnect: "Desconectar",
    telegramLoading: "Comprobando conexión de Telegram...",
    telegramBotMissing: "El nombre del bot de Telegram no está configurado en este entorno.",
    telegramDomainHint: "Si ves “Bot domain invalid”, añade splanno.app en BotFather > /setdomain.",
    telegramLinkSuccess: "Cuenta de Telegram conectada.",
    telegramLinkError: "No se pudo vincular Telegram. Revisa el dominio en BotFather.",
    telegramLinkAuthRequired: "Inicia sesión de nuevo antes de conectar Telegram.",
    telegramDisconnectedToast: "Telegram desconectado",
    telegramDisconnectFailed: "No se pudo desconectar Telegram.",
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
    notifications: "Notifiche",
    notificationsSubtitle: "Ricevi una notifica quando c'è una nuova spesa o una richiesta di pagamento.",
    notificationsHint: "Scegli esattamente quali notifiche push vuoi ricevere.",
    notificationsChatMessages: "Tutti i messaggi della chat",
    notificationsExpenses: "Nuove spese",
    notificationsPaymentRequests: "Richieste di pagamento",
    notificationsPlanInvites: "Inviti al piano",
    notificationsStatus: "Stato",
    notificationsEnabled: "Attive",
    notificationsDisabled: "Disattive",
    notificationsUnsupported: "Non supportato su questo dispositivo",
    notificationsSecureContext: "Le notifiche push richiedono HTTPS o localhost.",
    notificationsIosHomeScreen: "Su iPhone e iPad, installa Splann-O nella schermata Home e aprilo da lì.",
    notificationsBlocked: "Bloccate nelle impostazioni del browser",
    notificationsEnabledToast: "Notifiche push attivate",
    notificationsDisabledToast: "Notifiche push disattivate",
    notificationsFailed: "Impossibile aggiornare le notifiche.",
    notificationsAdvanced: "Opzioni avanzate",
    notificationsShowAdvanced: "Mostra avanzate",
    notificationsHideAdvanced: "Nascondi avanzate",
    telegram: "Telegram",
    telegramSubtitle: "Collega la tua identità Telegram per matching e futuri inviti.",
    telegramConnectedAs: "Collegato come",
    telegramNotConnected: "Non collegato",
    telegramConnect: "Collega Telegram",
    telegramDisconnect: "Disconnetti",
    telegramLoading: "Verifica connessione Telegram...",
    telegramBotMissing: "Username del bot Telegram non configurato in questo ambiente.",
    telegramDomainHint: "Se vedi “Bot domain invalid”, aggiungi splanno.app in BotFather > /setdomain.",
    telegramLinkSuccess: "Account Telegram collegato.",
    telegramLinkError: "Collegamento Telegram fallito. Controlla il dominio in BotFather.",
    telegramLinkAuthRequired: "Accedi di nuovo prima di collegare Telegram.",
    telegramDisconnectedToast: "Telegram disconnesso",
    telegramDisconnectFailed: "Impossibile disconnettere Telegram.",
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
    notifications: "Meldingen",
    notificationsSubtitle: "Ontvang een melding als er een nieuwe uitgave of betaalverzoek is.",
    notificationsHint: "Kies precies welke pushmeldingen je wilt ontvangen.",
    notificationsChatMessages: "Alle chatberichten",
    notificationsExpenses: "Nieuwe uitgaven",
    notificationsPaymentRequests: "Betaalverzoeken",
    notificationsPlanInvites: "Planuitnodigingen",
    notificationsStatus: "Status",
    notificationsEnabled: "Aan",
    notificationsDisabled: "Uit",
    notificationsUnsupported: "Niet ondersteund op dit apparaat",
    notificationsSecureContext: "Push vereist HTTPS of localhost.",
    notificationsIosHomeScreen: "Installeer Splann-O op iPhone of iPad eerst op je beginscherm en open het daarna van daaruit.",
    notificationsBlocked: "Geblokkeerd in browserinstellingen",
    notificationsEnabledToast: "Pushmeldingen ingeschakeld",
    notificationsDisabledToast: "Pushmeldingen uitgeschakeld",
    notificationsFailed: "Meldingen konden niet worden bijgewerkt.",
    notificationsAdvanced: "Geavanceerde opties",
    notificationsShowAdvanced: "Toon geavanceerd",
    notificationsHideAdvanced: "Verberg geavanceerd",
    telegram: "Telegram",
    telegramSubtitle: "Koppel je Telegram-identiteit voor matching en toekomstige invite-flows.",
    telegramConnectedAs: "Verbonden als",
    telegramNotConnected: "Niet verbonden",
    telegramConnect: "Connect Telegram",
    telegramDisconnect: "Ontkoppelen",
    telegramLoading: "Telegram-koppeling controleren...",
    telegramBotMissing: "Telegram bot-gebruikersnaam is niet ingesteld in deze omgeving.",
    telegramDomainHint: "Zie je “Bot domain invalid”? Voeg splanno.app toe in BotFather > /setdomain.",
    telegramLinkSuccess: "Telegram-account gekoppeld.",
    telegramLinkError: "Telegram koppelen mislukt. Controleer de BotFather-domeininstelling.",
    telegramLinkAuthRequired: "Log opnieuw in voordat je Telegram koppelt.",
    telegramDisconnectedToast: "Telegram ontkoppeld",
    telegramDisconnectFailed: "Telegram ontkoppelen is mislukt.",
  },
};

type TelegramIdentityStatus = {
  connected: boolean;
  account: {
    telegramUserId: string;
    username: string | null;
    firstName: string;
    lastName: string | null;
    photoUrl: string | null;
    linkedAt: string | null;
  } | null;
  botUsername: string | null;
  callbackPath: string;
};

export function AccountSettingsContent({ compact = false }: AccountSettingsContentProps) {
  const { user } = useAuth();
  const { language, setLanguage } = useLanguage();
  const { preference, setPreference } = useTheme();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const pushNotifications = usePushNotifications();
  const buildId = import.meta.env.VITE_BUILD_ID as string | undefined;
  const copy = ACCOUNT_SETTINGS_COPY[language];
  const telegramWidgetRef = React.useRef<HTMLDivElement | null>(null);
  const [showAdvancedNotifications, setShowAdvancedNotifications] = React.useState(false);
  const telegramStatusQuery = useQuery({
    queryKey: ["/api/me/integrations/telegram-account"],
    enabled: !!user,
    queryFn: () => apiRequest<TelegramIdentityStatus>("/api/me/integrations/telegram-account"),
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      const data = query.state.data as TelegramIdentityStatus | undefined;
      return data?.connected ? false : 4000;
    },
  });
  const unlinkTelegramMutation = useMutation({
    mutationFn: () => apiRequest<{ ok: boolean; removed: boolean }>("/api/me/integrations/telegram-account", { method: "DELETE" }),
    onSuccess: () => {
      toast({ variant: "success", message: copy.telegramDisconnectedToast });
      void queryClient.invalidateQueries({ queryKey: ["/api/me/integrations/telegram-account"] });
    },
    onError: () => {
      toast({ variant: "destructive", title: copy.telegramDisconnectFailed });
    },
  });

  if (!user) {
    return <p className="text-sm text-muted-foreground">{copy.signIn}</p>;
  }

  const themeOptions: Array<{ value: ThemePreference; label: string }> = [
    { value: "light", label: copy.light },
    { value: "dark", label: copy.dark },
    { value: "system", label: copy.system },
  ];
  const pushStatusLabel = !pushNotifications.isSupported
    ? pushNotifications.supportReason === "insecure_context"
      ? copy.notificationsSecureContext
      : pushNotifications.supportReason === "ios_home_screen_required"
        ? copy.notificationsIosHomeScreen
      : copy.notificationsUnsupported
    : pushNotifications.isSubscribed
      ? copy.notificationsEnabled
      : pushNotifications.permission === "denied"
        ? copy.notificationsBlocked
        : copy.notificationsDisabled;
  const telegramStatus = telegramStatusQuery.data ?? null;
  const telegramConnected = !!telegramStatus?.connected;
  const telegramDisplayName = telegramStatus?.account
    ? telegramStatus.account.username
      ? `@${telegramStatus.account.username}`
      : [telegramStatus.account.firstName, telegramStatus.account.lastName].filter(Boolean).join(" ")
    : "";
  const telegramAuthUrl = React.useMemo(() => {
    if (typeof window === "undefined") return null;
    if (!telegramStatus?.botUsername || !telegramStatus.callbackPath) return null;
    const callbackUrl = new URL(telegramStatus.callbackPath, window.location.origin);
    callbackUrl.searchParams.set("redirect", `${window.location.pathname}${window.location.search}`);
    return callbackUrl.toString();
  }, [telegramStatus?.botUsername, telegramStatus?.callbackPath]);

  const handlePushToggle = async (checked: boolean) => {
    try {
      if (checked) {
        await pushNotifications.subscribe(pushNotifications.preferences);
        toast({ variant: "success", message: copy.notificationsEnabledToast });
      } else {
        await pushNotifications.unsubscribe();
        toast({ variant: "success", message: copy.notificationsDisabledToast });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: error instanceof Error ? error.message : copy.notificationsFailed,
      });
    }
  };

  const handlePreferenceToggle = async (
    key: keyof typeof pushNotifications.preferences,
    checked: boolean,
  ) => {
    const nextPreferences = {
      ...pushNotifications.preferences,
      [key]: checked,
    };
    try {
      if (pushNotifications.isSubscribed) {
        await pushNotifications.updatePreferences(nextPreferences);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: error instanceof Error ? error.message : copy.notificationsFailed,
      });
      return;
    }
  };

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const status = url.searchParams.get("telegramAccountLink");
    if (!status) return;

    if (status === "linked") {
      toast({ variant: "success", message: copy.telegramLinkSuccess });
      void queryClient.invalidateQueries({ queryKey: ["/api/me/integrations/telegram-account"] });
    } else if (status === "auth_required") {
      toast({ variant: "destructive", title: copy.telegramLinkAuthRequired });
    } else if (status === "error") {
      toast({ variant: "destructive", title: copy.telegramLinkError });
    }

    url.searchParams.delete("telegramAccountLink");
    url.searchParams.delete("telegramLink");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [copy.telegramLinkAuthRequired, copy.telegramLinkError, copy.telegramLinkSuccess, queryClient, toast]);

  React.useEffect(() => {
    const container = telegramWidgetRef.current;
    if (!container) return;
    container.innerHTML = "";
    if (!telegramAuthUrl || !telegramStatus?.botUsername || telegramConnected) return;

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", telegramStatus.botUsername);
    script.setAttribute("data-size", "medium");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-auth-url", telegramAuthUrl);
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [telegramAuthUrl, telegramConnected, telegramStatus?.botUsername]);

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

      <div className="rounded-xl border border-border/70 bg-card/70 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">{copy.notifications}</p>
            <p className="text-xs text-muted-foreground">{copy.notificationsSubtitle}</p>
            <p className="text-xs text-muted-foreground">{copy.notificationsStatus}: {pushStatusLabel}</p>
          </div>
          <Switch
            checked={pushNotifications.isSubscribed}
            onCheckedChange={handlePushToggle}
            disabled={!pushNotifications.isSupported || pushNotifications.isLoading}
            aria-label="Toggle push notifications"
          />
        </div>
        <div className="mt-3 border-t border-border/60 pt-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">{copy.notificationsAdvanced}</p>
            <Button
              type="button"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => setShowAdvancedNotifications((prev) => !prev)}
            >
              {showAdvancedNotifications ? copy.notificationsHideAdvanced : copy.notificationsShowAdvanced}
              {showAdvancedNotifications ? <ChevronUp className="ml-1 h-3.5 w-3.5" /> : <ChevronDown className="ml-1 h-3.5 w-3.5" />}
            </Button>
          </div>
          {showAdvancedNotifications ? (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-muted-foreground">{copy.notificationsHint}</p>
              {([
                ["chatMessages", copy.notificationsChatMessages],
                ["expenses", copy.notificationsExpenses],
                ["paymentRequests", copy.notificationsPaymentRequests],
                ["planInvites", copy.notificationsPlanInvites],
              ] as const).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <p className="text-sm">{label}</p>
                  <Switch
                    checked={pushNotifications.preferences[key]}
                    onCheckedChange={(checked) => { void handlePreferenceToggle(key, checked); }}
                    disabled={!pushNotifications.isSupported || pushNotifications.isLoading}
                    aria-label={label}
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-card/70 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">{copy.telegram}</p>
            <p className="text-xs text-muted-foreground">{copy.telegramSubtitle}</p>
            {telegramStatusQuery.isLoading ? (
              <p className="text-xs text-muted-foreground">{copy.telegramLoading}</p>
            ) : telegramConnected ? (
              <p className="text-xs text-muted-foreground">{copy.telegramConnectedAs}: {telegramDisplayName || copy.telegram}</p>
            ) : (
              <p className="text-xs text-muted-foreground">{copy.telegramNotConnected}</p>
            )}
          </div>
          {telegramConnected ? (
            <Button
              type="button"
              variant="outline"
              className="h-8 px-3"
              disabled={unlinkTelegramMutation.isPending}
              onClick={() => unlinkTelegramMutation.mutate()}
            >
              {unlinkTelegramMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : copy.telegramDisconnect}
            </Button>
          ) : null}
        </div>
        {!telegramConnected ? (
          <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
            {telegramAuthUrl && telegramStatus?.botUsername ? (
              <>
                <div ref={telegramWidgetRef} className="min-h-10" />
                <p className="text-[11px] text-muted-foreground">{copy.telegramDomainHint}</p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">{copy.telegramBotMissing}</p>
            )}
          </div>
        ) : null}
      </div>

      {import.meta.env.DEV && buildId ? (
        <p className="text-[10px] text-muted-foreground">{copy.developmentBuild}: {buildId}</p>
      ) : null}
    </section>
  );
}

export default AccountSettingsContent;
