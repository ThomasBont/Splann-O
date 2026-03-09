"use client";

import { Link, useRoute } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { MapPin, CalendarDays, Share2, Users, BadgeCheck, Ticket, MessageSquare } from "lucide-react";
import { useConversation, useCreatePublicConversation, usePublicEvent, usePublicEventMessagingEligibility, usePublicEventRsvpSummary, useSendConversationMessage, useSubmitPublicEventRsvp } from "@/hooks/use-bbq-data";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage, type Language } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { copyText } from "@/lib/copy-text";
import { buildIcs, downloadIcs, inferEventDateRange } from "@/lib/calendar-ics";
import { buildMapsUrl, openMaps } from "@/lib/maps";
import { EMPTY_COPY, UI_COPY } from "@/lib/emotional-copy";
import { resolveAssetUrl } from "@/lib/asset-url";

const PUBLIC_EVENT_COPY: Record<Language, {
  metaDescriptionFallback: (location: string) => string;
  publicPageCreated: string;
  readyToShare: string;
  copyShareLink: string;
  pressCopyManually: string;
  copyFailed: string;
  shareFailed: string;
  invalidDate: string;
  calendarDownloaded: string;
  conversationOpenFailed: string;
  messageSendFailed: string;
  messageAfterJoin: string;
  backToExplore: string;
  addToCalendar: string;
  unavailable: string;
  expired: string;
  unavailableBody: string;
  unavailableHint: string;
  rateLimited: string;
  loadFailed: string;
  bannerPlaceholder: string;
  joinable: string;
  marketing: string;
  public: string;
  unlistedDraft: string;
  locationTba: string;
  openInMaps: string;
  dateTba: string;
  organizer: string;
  publicEventsHosted: (count: number) => string;
  organizerProfile: string;
  ticketsRsvp: string;
  free: string;
  priceOnRequest: string;
  capacity: (count: number) => string;
  going: (count: number) => string;
  soldOut: string;
  requestToJoin: string;
  joinWithInvite: string;
  marketingMode: string;
  requestToJoinTitle: string;
  requestToJoinBody: string;
  yourRsvp: (status: string) => string;
  askOrganizerInvite: string;
  askOrganizerInviteBody: string;
  messageOrganizer: string;
  messageOrganizerBody: string;
  organizerUseInbox: string;
  requestToJoinToMessage: string;
  onlyApprovedCanMessage: string;
  signInToMessage: string;
  eventInbox: string;
  organizerConversation: string;
  openConversationPrompt: string;
  inboxHelper: string;
  anonymousUser: string;
  writeMessage: string;
  send: string;
  loadConversationFailed: string;
}> = {
  en: {
    metaDescriptionFallback: (location) => `Public event in ${location} on Splann-O`,
    publicPageCreated: "Public page created",
    readyToShare: "Your event is ready to share.",
    copyShareLink: "Copy share link",
    pressCopyManually: "Press Ctrl/Cmd+C to copy the link",
    copyFailed: "Copy failed — select and copy manually.",
    shareFailed: "Couldn't share event link. Try again.",
    invalidDate: "Event date is missing or invalid.",
    calendarDownloaded: "Calendar file downloaded",
    conversationOpenFailed: "Could not open conversation",
    messageSendFailed: "Could not send message",
    messageAfterJoin: "You can message the organizer after requesting to join.",
    backToExplore: "Back to Explore",
    addToCalendar: "Add to Calendar",
    unavailable: "Not available",
    expired: "This public listing has expired.",
    unavailableBody: "This public event is not available.",
    unavailableHint: "It may be private, inactive, or no longer listed on Explore.",
    rateLimited: "Too many requests. Please try again in a minute.",
    loadFailed: "Failed to load public event.",
    bannerPlaceholder: "Banner placeholder",
    joinable: "Joinable",
    marketing: "Marketing",
    public: "Public",
    unlistedDraft: "Unlisted draft",
    locationTba: "Location TBA",
    openInMaps: "Open in Maps",
    dateTba: "Date TBA",
    organizer: "Organizer",
    publicEventsHosted: (count) => `${count} public event${count === 1 ? "" : "s"} hosted`,
    organizerProfile: "Organizer profile",
    ticketsRsvp: "Tickets / RSVP",
    free: "Free",
    priceOnRequest: "Price on request",
    capacity: (count) => `Capacity ${count}`,
    going: (count) => `${count} going`,
    soldOut: "Sold out",
    requestToJoin: "Request to join",
    joinWithInvite: "Join with invite link",
    marketingMode: "Marketing mode",
    requestToJoinTitle: "Request to join",
    requestToJoinBody: "Choose a tier above to send a request. Organizers can review requests before approving.",
    yourRsvp: (status) => `Your RSVP: ${status}`,
    askOrganizerInvite: "Ask organizer for invite",
    askOrganizerInviteBody: "Visible on Explore. People can view details, but can only join with an invite link.",
    messageOrganizer: "Message organizer",
    messageOrganizerBody: "Ask a question or follow up on your join request in the event inbox.",
    organizerUseInbox: "You're the organizer. Use the Event Inbox in your event workspace.",
    requestToJoinToMessage: "Request to join to message the organizer.",
    onlyApprovedCanMessage: "Only invited or approved attendees can message the organizer.",
    signInToMessage: "Sign in to message the organizer.",
    eventInbox: "Event inbox",
    organizerConversation: "Organizer conversation",
    openConversationPrompt: "Open a conversation to message the organizer.",
    inboxHelper: "Professional event inbox. Messages stay linked to this event.",
    anonymousUser: "User",
    writeMessage: "Write a message to the organizer…",
    send: "Send",
    loadConversationFailed: "Couldn't load conversation.",
  },
  es: {
    metaDescriptionFallback: (location) => `Evento público en ${location} en Splann-O`,
    publicPageCreated: "Página pública creada",
    readyToShare: "Tu evento ya está listo para compartir.",
    copyShareLink: "Copiar enlace",
    pressCopyManually: "Pulsa Ctrl/Cmd+C para copiar el enlace",
    copyFailed: "No se pudo copiar. Selecciónalo y cópialo manualmente.",
    shareFailed: "No se pudo compartir el enlace del evento. Inténtalo de nuevo.",
    invalidDate: "La fecha del evento falta o no es válida.",
    calendarDownloaded: "Archivo de calendario descargado",
    conversationOpenFailed: "No se pudo abrir la conversación",
    messageSendFailed: "No se pudo enviar el mensaje",
    messageAfterJoin: "Podrás escribir al organizador después de solicitar unirte.",
    backToExplore: "Volver a Explorar",
    addToCalendar: "Añadir al calendario",
    unavailable: "No disponible",
    expired: "Esta publicación pública ha caducado.",
    unavailableBody: "Este evento público no está disponible.",
    unavailableHint: "Puede ser privado, estar inactivo o ya no figurar en Explorar.",
    rateLimited: "Demasiadas solicitudes. Inténtalo de nuevo en un minuto.",
    loadFailed: "No se pudo cargar el evento público.",
    bannerPlaceholder: "Vista previa del banner",
    joinable: "Unible",
    marketing: "Promocional",
    public: "Público",
    unlistedDraft: "Borrador no listado",
    locationTba: "Ubicación pendiente",
    openInMaps: "Abrir en Maps",
    dateTba: "Fecha pendiente",
    organizer: "Organizador",
    publicEventsHosted: (count) => `${count} evento${count === 1 ? "" : "s"} público${count === 1 ? "" : "s"} organizados`,
    organizerProfile: "Perfil del organizador",
    ticketsRsvp: "Entradas / RSVP",
    free: "Gratis",
    priceOnRequest: "Precio a consultar",
    capacity: (count) => `Capacidad ${count}`,
    going: (count) => `${count} asistentes`,
    soldOut: "Agotado",
    requestToJoin: "Solicitar unirse",
    joinWithInvite: "Unirse con enlace",
    marketingMode: "Modo promocional",
    requestToJoinTitle: "Solicitar unirse",
    requestToJoinBody: "Elige una opción arriba para enviar tu solicitud. Los organizadores pueden revisarla antes de aprobar.",
    yourRsvp: (status) => `Tu RSVP: ${status}`,
    askOrganizerInvite: "Pedir invitación al organizador",
    askOrganizerInviteBody: "Visible en Explorar. Se pueden ver los detalles, pero solo se entra con un enlace de invitación.",
    messageOrganizer: "Escribir al organizador",
    messageOrganizerBody: "Haz una pregunta o sigue tu solicitud desde la bandeja del evento.",
    organizerUseInbox: "Eres el organizador. Usa la bandeja del evento dentro del espacio de trabajo.",
    requestToJoinToMessage: "Solicita unirte para escribir al organizador.",
    onlyApprovedCanMessage: "Solo invitados o asistentes aprobados pueden escribir al organizador.",
    signInToMessage: "Inicia sesión para escribir al organizador.",
    eventInbox: "Bandeja del evento",
    organizerConversation: "Conversación con el organizador",
    openConversationPrompt: "Abre una conversación para escribir al organizador.",
    inboxHelper: "Bandeja profesional del evento. Los mensajes quedan vinculados a este evento.",
    anonymousUser: "Usuario",
    writeMessage: "Escribe un mensaje al organizador…",
    send: "Enviar",
    loadConversationFailed: "No se pudo cargar la conversación.",
  },
  it: {
    metaDescriptionFallback: (location) => `Evento pubblico a ${location} su Splann-O`,
    publicPageCreated: "Pagina pubblica creata",
    readyToShare: "Il tuo evento è pronto da condividere.",
    copyShareLink: "Copia link",
    pressCopyManually: "Premi Ctrl/Cmd+C per copiare il link",
    copyFailed: "Copia non riuscita. Selezionalo e copialo manualmente.",
    shareFailed: "Impossibile condividere il link dell'evento. Riprova.",
    invalidDate: "La data dell'evento manca o non è valida.",
    calendarDownloaded: "File calendario scaricato",
    conversationOpenFailed: "Impossibile aprire la conversazione",
    messageSendFailed: "Impossibile inviare il messaggio",
    messageAfterJoin: "Potrai scrivere all'organizzatore dopo aver richiesto l'accesso.",
    backToExplore: "Torna a Esplora",
    addToCalendar: "Aggiungi al calendario",
    unavailable: "Non disponibile",
    expired: "Questa pubblicazione pubblica è scaduta.",
    unavailableBody: "Questo evento pubblico non è disponibile.",
    unavailableHint: "Potrebbe essere privato, inattivo o non più visibile in Esplora.",
    rateLimited: "Troppe richieste. Riprova tra un minuto.",
    loadFailed: "Impossibile caricare l'evento pubblico.",
    bannerPlaceholder: "Segnaposto banner",
    joinable: "Accessibile",
    marketing: "Vetrina",
    public: "Pubblico",
    unlistedDraft: "Bozza non pubblicata",
    locationTba: "Luogo da definire",
    openInMaps: "Apri in Maps",
    dateTba: "Data da definire",
    organizer: "Organizzatore",
    publicEventsHosted: (count) => `${count} event${count === 1 ? "o pubblico organizzato" : "i pubblici organizzati"}`,
    organizerProfile: "Profilo organizzatore",
    ticketsRsvp: "Biglietti / RSVP",
    free: "Gratis",
    priceOnRequest: "Prezzo su richiesta",
    capacity: (count) => `Capienza ${count}`,
    going: (count) => `${count} partecipanti`,
    soldOut: "Esaurito",
    requestToJoin: "Richiedi accesso",
    joinWithInvite: "Accedi con link invito",
    marketingMode: "Modalità vetrina",
    requestToJoinTitle: "Richiedi di partecipare",
    requestToJoinBody: "Scegli un'opzione sopra per inviare la richiesta. Gli organizzatori possono approvarla prima di confermare.",
    yourRsvp: (status) => `Il tuo RSVP: ${status}`,
    askOrganizerInvite: "Chiedi un invito all'organizzatore",
    askOrganizerInviteBody: "Visibile in Esplora. Si possono vedere i dettagli, ma si entra solo con un link di invito.",
    messageOrganizer: "Scrivi all'organizzatore",
    messageOrganizerBody: "Fai una domanda o segui la tua richiesta dalla inbox dell'evento.",
    organizerUseInbox: "Sei l'organizzatore. Usa l'inbox evento nel tuo workspace.",
    requestToJoinToMessage: "Richiedi di partecipare per scrivere all'organizzatore.",
    onlyApprovedCanMessage: "Solo invitati o partecipanti approvati possono scrivere all'organizzatore.",
    signInToMessage: "Accedi per scrivere all'organizzatore.",
    eventInbox: "Inbox evento",
    organizerConversation: "Conversazione con l'organizzatore",
    openConversationPrompt: "Apri una conversazione per scrivere all'organizzatore.",
    inboxHelper: "Inbox professionale dell'evento. I messaggi restano collegati a questo evento.",
    anonymousUser: "Utente",
    writeMessage: "Scrivi un messaggio all'organizzatore…",
    send: "Invia",
    loadConversationFailed: "Impossibile caricare la conversazione.",
  },
  nl: {
    metaDescriptionFallback: (location) => `Openbaar event in ${location} op Splann-O`,
    publicPageCreated: "Openbare pagina aangemaakt",
    readyToShare: "Je event is klaar om te delen.",
    copyShareLink: "Deellink kopiëren",
    pressCopyManually: "Druk op Ctrl/Cmd+C om de link te kopiëren",
    copyFailed: "Kopiëren mislukt — selecteer en kopieer handmatig.",
    shareFailed: "Eventlink kon niet worden gedeeld. Probeer opnieuw.",
    invalidDate: "Eventdatum ontbreekt of is ongeldig.",
    calendarDownloaded: "Kalenderbestand gedownload",
    conversationOpenFailed: "Conversatie kon niet worden geopend",
    messageSendFailed: "Bericht kon niet worden verzonden",
    messageAfterJoin: "Je kunt de organisator berichten nadat je om deelname hebt gevraagd.",
    backToExplore: "Terug naar Ontdekken",
    addToCalendar: "Aan kalender toevoegen",
    unavailable: "Niet beschikbaar",
    expired: "Deze openbare vermelding is verlopen.",
    unavailableBody: "Dit openbare event is niet beschikbaar.",
    unavailableHint: "Het kan privé, inactief of niet langer zichtbaar in Ontdekken zijn.",
    rateLimited: "Te veel verzoeken. Probeer het over een minuut opnieuw.",
    loadFailed: "Openbaar event kon niet worden geladen.",
    bannerPlaceholder: "Banner placeholder",
    joinable: "Mee te doen",
    marketing: "Promotie",
    public: "Openbaar",
    unlistedDraft: "Niet-gepubliceerd concept",
    locationTba: "Locatie volgt",
    openInMaps: "Open in Maps",
    dateTba: "Datum volgt",
    organizer: "Organisator",
    publicEventsHosted: (count) => `${count} openbaar event${count === 1 ? "" : "s"} georganiseerd`,
    organizerProfile: "Profiel organisator",
    ticketsRsvp: "Tickets / RSVP",
    free: "Gratis",
    priceOnRequest: "Prijs op aanvraag",
    capacity: (count) => `Capaciteit ${count}`,
    going: (count) => `${count} aanwezig`,
    soldOut: "Uitverkocht",
    requestToJoin: "Deelname aanvragen",
    joinWithInvite: "Doe mee met uitnodigingslink",
    marketingMode: "Promotiemodus",
    requestToJoinTitle: "Deelname aanvragen",
    requestToJoinBody: "Kies hierboven een optie om een verzoek te sturen. Organisatoren kunnen dit eerst beoordelen.",
    yourRsvp: (status) => `Jouw RSVP: ${status}`,
    askOrganizerInvite: "Vraag organisator om uitnodiging",
    askOrganizerInviteBody: "Zichtbaar in Ontdekken. Mensen kunnen details zien, maar alleen meedoen met een uitnodigingslink.",
    messageOrganizer: "Organisator berichten",
    messageOrganizerBody: "Stel een vraag of volg je verzoek op in de event-inbox.",
    organizerUseInbox: "Jij bent de organisator. Gebruik de event-inbox in je workspace.",
    requestToJoinToMessage: "Vraag deelname aan om de organisator te berichten.",
    onlyApprovedCanMessage: "Alleen uitgenodigde of goedgekeurde deelnemers kunnen de organisator berichten.",
    signInToMessage: "Log in om de organisator te berichten.",
    eventInbox: "Event inbox",
    organizerConversation: "Gesprek met organisator",
    openConversationPrompt: "Open een gesprek om de organisator te berichten.",
    inboxHelper: "Professionele event-inbox. Berichten blijven gekoppeld aan dit event.",
    anonymousUser: "Gebruiker",
    writeMessage: "Schrijf een bericht aan de organisator…",
    send: "Verzenden",
    loadConversationFailed: "Conversatie kon niet worden geladen.",
  },
};

export default function PublicEventPage() {
  const { language } = useLanguage();
  const copy = PUBLIC_EVENT_COPY[language];
  const locale = language === "es" ? "es-ES" : language === "it" ? "it-IT" : language === "nl" ? "nl-NL" : "en-GB";
  const [, params] = useRoute("/events/:slug");
  const slug = params?.slug ?? null;
  const { data, isLoading, error } = usePublicEvent(slug);
  const rsvpSummary = usePublicEventRsvpSummary(slug);
  const submitRsvp = useSubmitPublicEventRsvp(slug);
  const { user } = useAuth();
  const { toast } = useToast();
  const [messageOpen, setMessageOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState("");
  const [bannerLoaded, setBannerLoaded] = useState(false);
  const messagingEligibility = usePublicEventMessagingEligibility(data?.id ?? null, !!data && !!user);
  const createConversation = useCreatePublicConversation(data?.id ?? null);
  const conversation = useConversation(conversationId, messageOpen && !!conversationId);
  const sendMessage = useSendConversationMessage(conversationId);
  const errorCode = error instanceof Error ? error.message : "";
  const isExpired = errorCode === "gone";
  const isUnavailable = errorCode === "not_found" || errorCode === "gone";
  const shareUrl = useMemo(() => (slug && typeof window !== "undefined" ? `${window.location.origin}/events/${slug}` : ""), [slug]);

  useEffect(() => {
    setBannerLoaded(false);
  }, [data?.bannerImageUrl, data?.id]);

  useEffect(() => {
    if (!data || typeof document === "undefined") return;
    document.title = `${data.title} · Splann-O`;
    const metaDesc = document.querySelector('meta[name="description"]') ?? (() => {
      const m = document.createElement("meta");
      m.setAttribute("name", "description");
      document.head.appendChild(m);
      return m;
    })();
    metaDesc.setAttribute("content", data.publicDescription || copy.metaDescriptionFallback(data.city || data.countryName || "your city"));
    const ogImage = document.querySelector('meta[property="og:image"]') ?? (() => {
      const m = document.createElement("meta");
      m.setAttribute("property", "og:image");
      document.head.appendChild(m);
      return m;
    })();
    ogImage.setAttribute("content", data.bannerImageUrl || `${window.location.origin}/api/share/event/${data.id}.svg`);
  }, [copy, data]);

  useEffect(() => {
    if (!data || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("created") !== "1") return;
    toast({
      variant: "success",
      title: copy.publicPageCreated,
      message: copy.readyToShare,
      actionLabel: copy.copyShareLink,
      onAction: async () => {
        if (!shareUrl) return;
        const ok = await copyText(shareUrl);
        if (ok) {
          toast({ variant: "success", message: UI_COPY.toasts.copied });
        } else {
          toast({ variant: "default", message: copy.pressCopyManually });
        }
      },
    });
    url.searchParams.delete("created");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [copy, data, shareUrl, toast]);

  const templateClasses = {
    classic: "bg-background",
    keynote: "bg-gradient-to-b from-background to-muted/20",
    workshop: "bg-gradient-to-b from-background to-emerald-500/5",
    nightlife: "bg-gradient-to-b from-background to-fuchsia-500/5",
    meetup: "bg-gradient-to-b from-background to-sky-500/5",
  } as const;

  const handleShare = async () => {
    if (!shareUrl || !data) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: data.title, url: shareUrl });
        return;
      }
      const ok = await copyText(shareUrl);
      if (ok) toast({ variant: "success", message: UI_COPY.toasts.copied });
      else toast({ variant: "default", message: copy.copyFailed });
    } catch {
      toast({ variant: "error", message: copy.shareFailed });
    }
  };

  const handleAddToCalendar = () => {
    if (!data?.date || !slug) return;
    const range = inferEventDateRange(data.date);
    if (!range) {
      toast({ variant: "default", message: copy.invalidDate });
      return;
    }
    const location = (data.locationName ?? [data.city, data.countryName].filter(Boolean).join(", ")) || null;
    const url = typeof window !== "undefined" ? `${window.location.origin}/events/${slug}` : "";
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const ics = buildIcs({
      uid: data.publicSlug ? `event-${data.publicSlug}@splanno` : `event-${data.id}@splanno`,
      title: data.title,
      start: range.start,
      end: range.end,
      allDay: range.allDay,
      location,
      description: data.publicDescription ?? data.subtitle ?? null,
      url,
      timezone,
    });
    const safeName = (data.title || "public-event")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "public-event";
    downloadIcs(`${safeName}.ics`, ics);
    toast({ variant: "success", message: copy.calendarDownloaded });
  };

  const handleOpenInMaps = () => {
    if (!data) return;
    const query = data.locationName ?? [data.city, data.countryName].filter(Boolean).join(", ");
    if (!query) return;
    const url = buildMapsUrl({
      query,
      label: data.title,
      lat: data.latitude ?? undefined,
      lng: data.longitude ?? undefined,
    });
    openMaps(url);
  };

  const openMessaging = async () => {
    if (!data) return;
    try {
      const convo = await createConversation.mutateAsync();
      setConversationId(convo.id);
      setMessageOpen(true);
    } catch (err) {
      toast({ variant: "destructive", title: (err as Error).message || copy.conversationOpenFailed });
    }
  };

  const submitMessage = async () => {
    const body = draftMessage.trim();
    if (!body) return;
    try {
      await sendMessage.mutateAsync(body);
      setDraftMessage("");
    } catch (err) {
      const msg = (err as Error).message || copy.messageSendFailed;
      toast({ variant: "destructive", title: msg === "NOT_AUTHORIZED" ? copy.messageAfterJoin : msg });
    }
  };

  return (
    <div className={`min-h-screen ${data ? templateClasses[data.publicTemplate ?? "classic"] : "bg-background"}`}>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between mb-6">
          <Link href="/explore">
            <Button variant="outline">{copy.backToExplore}</Button>
          </Link>
          <div className="flex items-center gap-2">
            {data?.date && (
              <Button variant="outline" onClick={handleAddToCalendar}>
                <CalendarDays className="h-4 w-4 mr-1.5" />
                {copy.addToCalendar}
              </Button>
            )}
            <Button variant="outline" onClick={handleShare} disabled={!data}>
              <Share2 className="h-4 w-4 mr-1.5" />
              {UI_COPY.actions.share}
            </Button>
          </div>
        </div>

        {isLoading && (
          <div className="space-y-5">
            <div className="h-48 sm:h-60 rounded-2xl border border-border/60 bg-card p-3">
              <Skeleton className="h-full w-full rounded-xl" />
            </div>
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-8 w-2/3" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-2/5" />
                </div>
                <div className="rounded-xl border border-border/60 p-4 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-48" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        {isUnavailable && (
          <Card>
            <CardContent className="pt-6 space-y-2">
              <h1 className="text-xl font-semibold">{copy.unavailable}</h1>
              <p className="text-sm text-muted-foreground">
                {isExpired
                  ? copy.expired
                  : copy.unavailableBody}
              </p>
              <p className="text-xs text-muted-foreground">
                {copy.unavailableHint}
              </p>
            </CardContent>
          </Card>
        )}
        {error && !isUnavailable && (
          <p className="text-sm text-destructive">
            {errorCode === "rate_limited" ? copy.rateLimited : copy.loadFailed}
          </p>
        )}

        {data && (
          <div className="space-y-5">
            <div className={`relative h-48 sm:h-60 rounded-2xl border bg-gradient-to-br from-muted to-muted/40 flex items-center justify-center text-muted-foreground overflow-hidden ${data.publicTemplate === "keynote" ? "shadow-lg" : ""}`}>
              {data.bannerImageUrl ? (
                <>
                  <img
                    src={resolveAssetUrl(data.bannerImageUrl) ?? ""}
                    alt={data.title}
                    onLoad={() => setBannerLoaded(true)}
                    className={`h-full w-full object-cover rounded-2xl transition-opacity duration-200 ${bannerLoaded ? "opacity-100" : "opacity-0"}`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/10 to-transparent pointer-events-none" />
                </>
              ) : (
                <span>{copy.bannerPlaceholder}</span>
              )}
            </div>

            <Card className={data.publicTemplate === "nightlife" ? "border-fuchsia-500/20" : undefined}>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <h1 className={`font-semibold ${data.publicTemplate === "keynote" ? "text-3xl" : "text-2xl"}`}>{data.title}</h1>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="rounded-full">{data.publicMode === "joinable" ? copy.joinable : copy.marketing}</Badge>
                      <Badge variant="outline" className="rounded-full">{copy.public}</Badge>
                      {data.publicListingStatus !== "active" ? (
                        <Badge variant="outline" className="rounded-full text-muted-foreground">{copy.unlistedDraft}</Badge>
                      ) : null}
                    </div>
                  </div>
                  {data.subtitle && (
                    <p className="text-sm text-foreground/80 mt-1">{data.subtitle}</p>
                  )}
                  {data.organizationName && (
                    <p className="text-sm text-muted-foreground mt-1">{data.organizationName}</p>
                  )}
                </div>

                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-2 min-w-0">
                      <MapPin className="h-4 w-4 shrink-0" />
                      <span className="truncate">
                        {(data.locationName ?? [data.city, data.countryName].filter(Boolean).join(", ")) || copy.locationTba}
                      </span>
                    </p>
                    {(data.locationName || data.city || data.countryName) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-[11px] shrink-0"
                        onClick={handleOpenInMaps}
                        aria-label={copy.openInMaps}
                      >
                        {copy.openInMaps}
                      </Button>
                    )}
                  </div>
                  <p className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    {data.date ? new Date(data.date).toLocaleString(locale) : copy.dateTba}
                  </p>
                </div>

                <p className="text-sm leading-6 whitespace-pre-wrap text-foreground/90">
                  {data.publicDescription || EMPTY_COPY.publicNoDetails}
                </p>

                {data.organizer && (
                  <div className="rounded-xl border bg-muted/15 p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{copy.organizer}</p>
                      <Link href={`/u/${data.organizer.handle || data.organizer.username}`}>
                        <a className="inline-flex items-center gap-1.5 text-sm font-semibold hover:text-primary">
                          {data.organizer.displayName || data.organizer.username}
                          {data.organizer.verifiedHost && <BadgeCheck className="h-4 w-4 text-primary" />}
                        </a>
                      </Link>
                      <p className="text-xs text-muted-foreground mt-0.5">{copy.publicEventsHosted(data.organizer.publicEventsHosted)}</p>
                    </div>
                      <Link href={`/u/${data.organizer.handle || data.organizer.username}`}>
                      <Button variant="outline" size="sm">{copy.organizerProfile}</Button>
                    </Link>
                  </div>
                )}

                {data.rsvpTiers.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Ticket className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium">{copy.ticketsRsvp}</p>
                    </div>
                    <div className="space-y-2">
                      {(rsvpSummary.data?.tiers ?? data.rsvpTiers.map((t) => ({ ...t, counts: { requested: 0, approved: 0, declined: 0, going: 0 }, soldOut: false }))).map((tier) => (
                        <div key={tier.id} className="rounded-xl border border-border/60 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold">{tier.name}</p>
                              {tier.description && <p className="text-xs text-muted-foreground mt-1">{tier.description}</p>}
                              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{tier.isFree ? copy.free : (tier.priceLabel || copy.priceOnRequest)}</span>
                                {tier.capacity != null && <span>{copy.capacity(tier.capacity)}</span>}
                                {(tier.counts.approved + tier.counts.going) > 0 && <span>{copy.going(tier.counts.approved + tier.counts.going)}</span>}
                              </div>
                            </div>
                            {data.publicMode === "joinable" ? (
                              <Button
                                size="sm"
                                disabled={tier.soldOut || submitRsvp.isPending}
                                onClick={() => submitRsvp.mutate({ tierId: tier.id, status: "requested" })}
                              >
                                {tier.soldOut ? copy.soldOut : copy.requestToJoin}
                              </Button>
                            ) : (
                              <div className="text-right">
                                <p className="text-xs font-medium text-muted-foreground">{copy.joinWithInvite}</p>
                                <p className="text-xs text-muted-foreground mt-1">{copy.marketingMode}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-lg border bg-muted/20 p-4">
                  {data.publicMode === "joinable" ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">{copy.requestToJoinTitle}</p>
                      <p className="text-sm text-muted-foreground">{copy.requestToJoinBody}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        {rsvpSummary.data?.myRsvp ? copy.yourRsvp(rsvpSummary.data.myRsvp.status) : EMPTY_COPY.publicNoRsvp}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{copy.askOrganizerInvite}</p>
                      <p className="text-sm text-muted-foreground">
                        {copy.askOrganizerInviteBody}
                      </p>
                    </div>
                  )}
                </div>

                <div className="rounded-lg border bg-card/70 p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{copy.messageOrganizer}</p>
                      <p className="text-xs text-muted-foreground">
                        {copy.messageOrganizerBody}
                      </p>
                      {user && messagingEligibility.data?.isOrganizer && (
                        <p className="text-xs text-muted-foreground">{copy.organizerUseInbox}</p>
                      )}
                      {user && messagingEligibility.data && !messagingEligibility.data.canMessageOrganizer && !messagingEligibility.data.isOrganizer && (
                        <p className="text-xs text-muted-foreground">
                          {messagingEligibility.data.reason === "request_to_join_first"
                            ? copy.requestToJoinToMessage
                            : copy.onlyApprovedCanMessage}
                        </p>
                      )}
                      {!user && (
                        <p className="text-xs text-muted-foreground">{copy.signInToMessage}</p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      onClick={openMessaging}
                      disabled={!user || messagingEligibility.data?.isOrganizer === true || !!(messagingEligibility.data && !messagingEligibility.data.canMessageOrganizer) || createConversation.isPending}
                    >
                      <MessageSquare className="h-4 w-4 mr-1.5" />
                      {copy.messageOrganizer}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <Modal
        open={messageOpen}
        onClose={() => setMessageOpen(false)}
        onOpenChange={setMessageOpen}
        title={copy.eventInbox}
        subtitle={data ? `${data.title} — ${copy.organizerConversation}` : undefined}
        size="xl"
        scrollable
        className="w-[760px] max-w-[96vw] h-[70vh] max-h-[85vh]"
      >
        {!conversationId ? (
          <div className="py-10 text-center text-sm text-muted-foreground">{copy.openConversationPrompt}</div>
        ) : conversation.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="h-12 w-1/2 ml-auto" />
            <Skeleton className="h-12 w-3/5" />
          </div>
        ) : conversation.data ? (
          <div className="flex h-full min-h-0 flex-col gap-3">
            <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
              {copy.inboxHelper}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
              {conversation.data.messages.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">{EMPTY_COPY.publicNoMessages}</p>
              ) : (
                conversation.data.messages.map((msg) => {
                  const mine = !!user && msg.senderUserId === user.id;
                  return (
                    <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted/30 border border-border/50"}`}>
                        <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                        <p className={`mt-1 text-[10px] ${mine ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
                          {msg.sender?.displayName || msg.sender?.username || copy.anonymousUser} · {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="flex items-end gap-2 pt-1">
              <Textarea
                value={draftMessage}
                onChange={(e) => setDraftMessage(e.target.value)}
                placeholder={copy.writeMessage}
                className="min-h-[72px]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void submitMessage();
                  }
                }}
              />
              <Button onClick={() => void submitMessage()} disabled={sendMessage.isPending || !draftMessage.trim()}>
                {copy.send}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{copy.loadConversationFailed}</p>
        )}
      </Modal>
    </div>
  );
}
