"use client";

import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import {
  ArrowLeft,
  CalendarDays,
  Globe,
  Loader2,
  MapPin,
  Share2,
  Sparkles,
  UserMinus,
  UserPlus2,
  Users,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { usePublicProfile } from "@/hooks/use-bbq-data";
import { type FriendRelationshipStatus, useFriendStatuses, useFriends, useRemoveFriend, useSendFriendRequestByUserId } from "@/hooks/use-friends";
import { useLanguage, type Language } from "@/hooks/use-language";
import { useToast } from "@/hooks/use-toast";
import { copyText } from "@/lib/copy-text";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EventCategoryBadge } from "@/components/event/EventCategoryBadge";
import { cn } from "@/lib/utils";
import { resolveAssetUrl } from "@/lib/asset-url";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

const PUBLIC_PROFILE_COPY: Record<Language, {
  titleFallback: string;
  share: string;
  shareTitle: (name: string) => string;
  linkCopied: string;
  copyFailed: string;
  shareFailed: string;
  requestSent: string;
  alreadyFriends: string;
  friendRequestFailed: string;
  friendRemoved: string;
  removeFriendFailed: string;
  profileNotFound: string;
  profileNotFoundBody: string;
  profileLoadFailed: string;
  tryAgain: string;
  publicOnly: string;
  addFriend: string;
  unfriend: string;
  requestSentBadge: string;
  requestPendingBadge: string;
  shareProfile: string;
  publicEventsHosted: string;
  totalAttendees: string;
  profileType: string;
  publicView: string;
  visibility: string;
  privacyFirst: string;
  publicEvents: string;
  noPublicEvents: string;
  publishToShow: string;
  publicBadge: string;
  locationTba: string;
  attendees: (count: number) => string;
  dateTba: string;
}> = {
  en: {
    titleFallback: "Profile",
    share: "Share",
    shareTitle: (name) => `${name} on Splann-O`,
    linkCopied: "Link copied",
    copyFailed: "Copy failed — select and copy manually.",
    shareFailed: "Couldn't share profile link",
    requestSent: "Friend request sent",
    alreadyFriends: "Already friends",
    friendRequestFailed: "Couldn't send friend request.",
    friendRemoved: "Friend removed",
    removeFriendFailed: "Couldn't remove friend.",
    profileNotFound: "Profile not found",
    profileNotFoundBody: "This public profile does not exist, or the handle is no longer available.",
    profileLoadFailed: "Couldn't load profile",
    tryAgain: "Please try again in a moment.",
    publicOnly: "Only events you choose to make public appear here.",
    addFriend: "Add friend",
    unfriend: "Unfriend",
    requestSentBadge: "Request sent",
    requestPendingBadge: "Request pending",
    shareProfile: "Share profile",
    publicEventsHosted: "Public events hosted",
    totalAttendees: "Total attendees",
    profileType: "Profile type",
    publicView: "Public view",
    visibility: "Visibility",
    privacyFirst: "Privacy-first",
    publicEvents: "Public events",
    noPublicEvents: "No public events yet — only events you choose to make public appear here.",
    publishToShow: "Publish an event to show it here.",
    publicBadge: "Public",
    locationTba: "Location TBA",
    attendees: (count) => `${count} attendee${count === 1 ? "" : "s"}`,
    dateTba: "Date TBA",
  },
  es: {
    titleFallback: "Perfil",
    share: "Compartir",
    shareTitle: (name) => `${name} en Splann-O`,
    linkCopied: "Enlace copiado",
    copyFailed: "No se pudo copiar. Selecciónalo y cópialo manualmente.",
    shareFailed: "No se pudo compartir el perfil",
    requestSent: "Solicitud de amistad enviada",
    alreadyFriends: "Ya son amigos",
    friendRequestFailed: "No se pudo enviar la solicitud.",
    friendRemoved: "Amigo eliminado",
    removeFriendFailed: "No se pudo eliminar al amigo.",
    profileNotFound: "Perfil no encontrado",
    profileNotFoundBody: "Este perfil público no existe o el nombre ya no está disponible.",
    profileLoadFailed: "No se pudo cargar el perfil",
    tryAgain: "Inténtalo de nuevo en un momento.",
    publicOnly: "Solo aparecen aquí los eventos que elijas hacer públicos.",
    addFriend: "Agregar amigo",
    unfriend: "Eliminar amigo",
    requestSentBadge: "Solicitud enviada",
    requestPendingBadge: "Solicitud pendiente",
    shareProfile: "Compartir perfil",
    publicEventsHosted: "Eventos públicos organizados",
    totalAttendees: "Asistentes totales",
    profileType: "Tipo de perfil",
    publicView: "Vista pública",
    visibility: "Visibilidad",
    privacyFirst: "Privacidad primero",
    publicEvents: "Eventos públicos",
    noPublicEvents: "Todavía no hay eventos públicos — aquí solo aparecen los que elijas publicar.",
    publishToShow: "Publica un evento para mostrarlo aquí.",
    publicBadge: "Público",
    locationTba: "Ubicación pendiente",
    attendees: (count) => `${count} asistente${count === 1 ? "" : "s"}`,
    dateTba: "Fecha pendiente",
  },
  it: {
    titleFallback: "Profilo",
    share: "Condividi",
    shareTitle: (name) => `${name} su Splann-O`,
    linkCopied: "Link copiato",
    copyFailed: "Copia non riuscita. Selezionalo e copialo manualmente.",
    shareFailed: "Impossibile condividere il profilo",
    requestSent: "Richiesta di amicizia inviata",
    alreadyFriends: "Già amici",
    friendRequestFailed: "Impossibile inviare la richiesta.",
    friendRemoved: "Amico rimosso",
    removeFriendFailed: "Impossibile rimuovere l'amico.",
    profileNotFound: "Profilo non trovato",
    profileNotFoundBody: "Questo profilo pubblico non esiste o l'handle non è più disponibile.",
    profileLoadFailed: "Impossibile caricare il profilo",
    tryAgain: "Riprova tra poco.",
    publicOnly: "Qui compaiono solo gli eventi che scegli di rendere pubblici.",
    addFriend: "Aggiungi amico",
    unfriend: "Rimuovi amico",
    requestSentBadge: "Richiesta inviata",
    requestPendingBadge: "Richiesta in attesa",
    shareProfile: "Condividi profilo",
    publicEventsHosted: "Eventi pubblici organizzati",
    totalAttendees: "Partecipanti totali",
    profileType: "Tipo di profilo",
    publicView: "Vista pubblica",
    visibility: "Visibilità",
    privacyFirst: "Privacy-first",
    publicEvents: "Eventi pubblici",
    noPublicEvents: "Nessun evento pubblico — qui compaiono solo quelli che scegli di pubblicare.",
    publishToShow: "Pubblica un evento per mostrarlo qui.",
    publicBadge: "Pubblico",
    locationTba: "Luogo da definire",
    attendees: (count) => `${count} partecipant${count === 1 ? "e" : "i"}`,
    dateTba: "Data da definire",
  },
  nl: {
    titleFallback: "Profiel",
    share: "Delen",
    shareTitle: (name) => `${name} op Splann-O`,
    linkCopied: "Link gekopieerd",
    copyFailed: "Kopiëren mislukt — selecteer en kopieer handmatig.",
    shareFailed: "Profiellink kon niet worden gedeeld",
    requestSent: "Vriendschapsverzoek verstuurd",
    alreadyFriends: "Al bevriend",
    friendRequestFailed: "Vriendschapsverzoek kon niet worden verstuurd.",
    friendRemoved: "Vriend verwijderd",
    removeFriendFailed: "Vriend kon niet worden verwijderd.",
    profileNotFound: "Profiel niet gevonden",
    profileNotFoundBody: "Dit openbare profiel bestaat niet of de handle is niet meer beschikbaar.",
    profileLoadFailed: "Profiel kon niet worden geladen",
    tryAgain: "Probeer het zo opnieuw.",
    publicOnly: "Alleen events die je openbaar maakt verschijnen hier.",
    addFriend: "Vriend toevoegen",
    unfriend: "Ontvrienden",
    requestSentBadge: "Verzoek verstuurd",
    requestPendingBadge: "Verzoek openstaand",
    shareProfile: "Profiel delen",
    publicEventsHosted: "Openbare events georganiseerd",
    totalAttendees: "Totaal aanwezigen",
    profileType: "Profieltype",
    publicView: "Openbare weergave",
    visibility: "Zichtbaarheid",
    privacyFirst: "Privacy eerst",
    publicEvents: "Openbare events",
    noPublicEvents: "Nog geen openbare events — alleen events die je zelf openbaar maakt verschijnen hier.",
    publishToShow: "Publiceer een event om het hier te tonen.",
    publicBadge: "Openbaar",
    locationTba: "Locatie volgt",
    attendees: (count) => `${count} aanwezige${count === 1 ? "" : "n"}`,
    dateTba: "Datum volgt",
  },
};

function formatEventDate(value: string | null, fallback: string, locale: string) {
  if (!value) return fallback;
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return fallback;
  return d.toLocaleString(locale, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function memberBadge(createdAt: string | null) {
  if (!createdAt) return "Early";
  const d = new Date(createdAt);
  if (!Number.isFinite(d.getTime())) return "Early";
  return `Joined ${d.getFullYear()}`;
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border/60 bg-card p-4">
          <Skeleton className="h-3 w-20 mb-2" />
          <Skeleton className="h-6 w-12" />
        </div>
      ))}
    </div>
  );
}

function EventCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-6 w-12 rounded-full" />
      </div>
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="h-3 w-1/3" />
    </div>
  );
}

export default function PublicProfilePage() {
  const { language } = useLanguage();
  const copy = PUBLIC_PROFILE_COPY[language];
  const locale = language === "es" ? "es-ES" : language === "it" ? "it-IT" : language === "nl" ? "nl-NL" : "en-GB";
  const [, params] = useRoute("/u/:username");
  const username = params?.username ?? null;
  const { user } = useAuth();
  const { data, isLoading, error } = usePublicProfile(username);
  const { data: friends = [] } = useFriends();
  const removeFriend = useRemoveFriend();
  const sendFriendRequest = useSendFriendRequestByUserId();
  const { toast } = useToast();
  const [headerCompact, setHeaderCompact] = useState(false);
  const [statusOverride, setStatusOverride] = useState<FriendRelationshipStatus | null>(null);

  useEffect(() => {
    const onScroll = () => setHeaderCompact(window.scrollY > 72);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const profile = data?.profile;
  const events = data?.events ?? [];
  const ratioLabel = data?.stats.ratioLabel;
  const targetUserId = profile?.id ?? null;
  const friendStatusesQuery = useFriendStatuses(
    targetUserId && targetUserId !== user?.id ? [targetUserId] : [],
  );
  const friendStatus = targetUserId && targetUserId !== user?.id
    ? statusOverride ?? friendStatusesQuery.data?.[String(targetUserId)] ?? "not_friends"
    : null;
  const existingFriendshipId = targetUserId
    ? friends.find((friend) => friend.userId === Number(targetUserId))?.friendshipId ?? null
    : null;

  const shareUrl = useMemo(
    () => (username && typeof window !== "undefined" ? `${window.location.origin}/u/${encodeURIComponent(username)}` : ""),
    [username],
  );

  const handleShare = async () => {
    if (!shareUrl || !profile) return;
    const title = copy.shareTitle(profile.displayName || profile.username);
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title, url: shareUrl });
        return;
      }
      const ok = await copyText(shareUrl);
      if (ok) toast({ variant: "success", message: copy.linkCopied });
      else toast({ variant: "error", message: copy.copyFailed });
    } catch {
      toast({ variant: "error", message: copy.shareFailed });
    }
  };

  const handleAddFriend = async () => {
    if (!targetUserId || targetUserId === user?.id) return;
    const previousStatus = friendStatus ?? "not_friends";
    setStatusOverride("pending_outgoing");
    try {
      const response = await sendFriendRequest.mutateAsync(targetUserId);
      const nextStatus = response.status ?? "pending_outgoing";
      setStatusOverride(nextStatus);
      toast({ variant: nextStatus === "friends" ? "default" : "success", message: nextStatus === "friends" ? copy.alreadyFriends : copy.requestSent });
      void friendStatusesQuery.refetch();
    } catch (error) {
      setStatusOverride(previousStatus);
      toast({ variant: "error", message: error instanceof Error ? error.message : copy.friendRequestFailed });
    }
  };

  const handleRemoveFriend = async () => {
    if (!existingFriendshipId) return;
    const previousStatus = friendStatus ?? "friends";
    setStatusOverride("not_friends");
    try {
      await removeFriend.mutateAsync(existingFriendshipId);
      toast({ variant: "success", message: copy.friendRemoved });
      void friendStatusesQuery.refetch();
    } catch (error) {
      setStatusOverride(previousStatus);
      toast({ variant: "error", message: error instanceof Error ? error.message : copy.removeFriendFailed });
    }
  };

  const notFound = error instanceof Error && error.message === "not_found";
  const fetchFailed = error instanceof Error && error.message !== "not_found";

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/65">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/explore">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className={cn("flex items-center gap-2 min-w-0 transition-all duration-150", headerCompact ? "opacity-100" : "opacity-0 pointer-events-none -translate-y-1")}>
              <Avatar className="h-7 w-7">
                {profile?.profileImageUrl || profile?.avatarUrl ? (
                  <AvatarImage src={profile.profileImageUrl || profile.avatarUrl || ""} alt="" />
                ) : null}
                <AvatarFallback className="text-[10px]">{initials(profile?.displayName || profile?.username || "U")}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium truncate">{profile?.displayName || profile?.username || copy.titleFallback}</span>
            </div>
          </div>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={handleShare} disabled={!username}>
            <Share2 className="h-4 w-4" />
            {copy.share}
          </Button>
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        {isLoading && (
          <div className="space-y-6">
            <div className="rounded-3xl border border-border/60 bg-gradient-to-b from-card to-muted/20 p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <Skeleton className="h-20 w-20 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-6 w-44" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-full max-w-xl" />
                  <div className="flex gap-2 pt-1">
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-6 w-28 rounded-full" />
                  </div>
                </div>
              </div>
            </div>
            <StatsSkeleton />
            <div className="space-y-3">
              <EventCardSkeleton />
              <EventCardSkeleton />
              <EventCardSkeleton />
            </div>
          </div>
        )}

        {!isLoading && notFound && (
          <Card className="rounded-3xl border-border/60">
            <CardContent className="p-8 text-center">
              <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-muted">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <h1 className="text-xl font-semibold">{copy.profileNotFound}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{copy.profileNotFoundBody}</p>
            </CardContent>
          </Card>
        )}

        {!isLoading && fetchFailed && (
          <Card className="rounded-3xl border-border/60">
            <CardContent className="p-8 text-center">
              <h1 className="text-xl font-semibold">{copy.profileLoadFailed}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{copy.tryAgain}</p>
            </CardContent>
          </Card>
        )}

        {!isLoading && data && profile && (
          <div className="space-y-6">
            <section className="rounded-3xl border border-border/60 bg-gradient-to-b from-card via-card to-muted/20 p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4 min-w-0">
                  <div className="rounded-full bg-gradient-to-br from-primary/25 via-accent/10 to-primary/10 p-[2px]">
                    <Avatar className="h-20 w-20 sm:h-24 sm:w-24 bg-background">
                      {profile.profileImageUrl || profile.avatarUrl ? (
                        <AvatarImage src={profile.profileImageUrl || profile.avatarUrl || ""} alt="" />
                      ) : null}
                      <AvatarFallback className="text-xl font-semibold">
                        {initials(profile.displayName || profile.username)}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="min-w-0 pt-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl truncate">{profile.displayName || profile.username}</h1>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">@{profile.handle}</p>
                    {profile.bio ? (
                      <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground/90">
                        {profile.bio.slice(0, 120)}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 text-primary">
                        <Sparkles className="mr-1 h-3 w-3" />
                        {memberBadge(profile.createdAt)}
                      </Badge>
                      <Badge variant="outline" className="rounded-full text-muted-foreground">
                        {copy.publicOnly}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 self-start">
                  {friendStatus === "not_friends" ? (
                    <Button className="rounded-xl" onClick={() => void handleAddFriend()} disabled={sendFriendRequest.isPending}>
                      {sendFriendRequest.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus2 className="h-4 w-4" />}
                      {copy.addFriend}
                    </Button>
                  ) : friendStatus === "friends" ? (
                    <Button variant="outline" className="rounded-xl" onClick={() => void handleRemoveFriend()} disabled={removeFriend.isPending || !existingFriendshipId}>
                      {removeFriend.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
                      {copy.unfriend}
                    </Button>
                  ) : friendStatus === "pending_outgoing" ? (
                    <Badge variant="outline" className="rounded-full border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-700 dark:text-amber-300">
                      {copy.requestSentBadge}
                    </Badge>
                  ) : friendStatus === "pending_incoming" ? (
                    <Badge variant="outline" className="rounded-full border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-700 dark:text-amber-300">
                      {copy.requestPendingBadge}
                    </Badge>
                  ) : null}
                  <Button variant="outline" className="rounded-xl self-start" onClick={handleShare}>
                    <Share2 className="h-4 w-4" />
                    {copy.shareProfile}
                  </Button>
                </div>
              </div>
            </section>

            <section aria-label="Profile stats">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Card className="rounded-2xl border-border/60">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">{copy.publicEventsHosted}</p>
                    <p className="mt-1 text-xl font-semibold">{data.stats.publicEventsHosted}</p>
                  </CardContent>
                </Card>
                <Card className="rounded-2xl border-border/60">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">{copy.totalAttendees}</p>
                    <p className="mt-1 text-xl font-semibold">{data.stats.totalAttendees}</p>
                  </CardContent>
                </Card>
                <Card className="rounded-2xl border-border/60">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">{copy.profileType}</p>
                    <p className="mt-1 text-sm font-medium">{ratioLabel ?? copy.publicView}</p>
                  </CardContent>
                </Card>
                <Card className="rounded-2xl border-border/60">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">{copy.visibility}</p>
                    <p className="mt-1 text-sm font-medium">{copy.privacyFirst}</p>
                  </CardContent>
                </Card>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">{copy.publicEvents}</h2>
                  <p className="text-sm text-muted-foreground">{copy.publicOnly}</p>
                </div>
              </div>

              {events.length === 0 ? (
                <Card className="rounded-3xl border-border/60">
                  <CardContent className="p-8 text-center">
                    <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-muted/60">
                      <Globe className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="font-medium">{copy.noPublicEvents}</p>
                    {data.viewerIsOwner && (
                      <p className="mt-2 text-sm text-muted-foreground">{copy.publishToShow}</p>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {events.map((event) => (
                    <Link key={event.id} href={`/events/${event.publicSlug}`}>
                      <a className="block">
                        <Card className="rounded-2xl border-border/60 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.995]">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted/50 shrink-0 overflow-hidden">
                                {event.bannerImageUrl ? (
                                  <img src={resolveAssetUrl(event.bannerImageUrl) ?? ""} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <EventCategoryBadge category={event.themeCategory} compact />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="font-semibold truncate">{event.title}</h3>
                                  <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0 text-muted-foreground">{copy.publicBadge}</Badge>
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                  <span className="inline-flex items-center gap-1">
                                    <CalendarDays className="h-3.5 w-3.5" />
                                    {formatEventDate(event.date, copy.dateTba, locale)}
                                  </span>
                                  <span className="inline-flex items-center gap-1">
                                    <MapPin className="h-3.5 w-3.5" />
                                    {event.locationName ?? ([event.city, event.countryName].filter(Boolean).join(", ") || copy.locationTba)}
                                  </span>
                                  <span className="inline-flex items-center gap-1">
                                    <Users className="h-3.5 w-3.5" />
                                    {copy.attendees(event.attendeeCount)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </a>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
