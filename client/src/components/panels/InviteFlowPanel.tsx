import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MessageCircle, Users } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InviteLink } from "@/components/events/invite-link";
import { useAppToast } from "@/hooks/use-app-toast";
import { useEnsureInviteToken } from "@/hooks/use-bbq-data";
import { usePlan } from "@/hooks/use-plan-data";
import { useEventGuests } from "@/hooks/use-event-guests";
import { useSearchUsers } from "@/hooks/use-friends";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage, type Language } from "@/hooks/use-language";
import type { EventInviteView } from "@/hooks/use-participants";
import { PanelHeader, PanelSection, PanelShell, useActiveEventId } from "@/components/panels/panel-primitives";
import { resolveAssetUrl } from "@/lib/asset-url";
import { getClientPlanStatus } from "@/lib/plan-lifecycle";
import { buildInviteUrl, generateInviteMessage } from "@/lib/invite-share";

type UserSearchRow = {
  id: number;
  displayName: string;
  username: string;
  avatarUrl?: string | null;
};

type SettlementRoundsResponse = {
  activeFinalSettlementRound: { id: string } | null;
};

const INVITE_PANEL_COPY: Record<Language, {
  prepareInviteLinkFailed: string;
  inviteSent: (name: string) => string;
  inviteFailed: string;
  searchPrompt: string;
  searching: string;
  loadUsersFailed: string;
  noUsersFound: string;
  invite: string;
  label: string;
  title: string;
  pendingInvitesMeta: (count: number) => string;
  openPlanPrompt: string;
  loadingInviteFlow: string;
  addUserTitle: string;
  addUserBody: string;
  searchPlaceholder: string;
  shareLinkTitle: string;
  shareLinkBody: string;
  inviteLinkLabel: string;
  shareTitleFallback: string;
  pendingInvitesTitle: string;
  pendingInviteFallback: string;
  waitingForResponse: string;
  noPendingInvites: string;
}> = {
  en: {
    prepareInviteLinkFailed: "Could not prepare invite link.",
    inviteSent: (name) => `Invited ${name}`,
    inviteFailed: "Could not send invite.",
    searchPrompt: "Search for a friend already on Splann-O",
    searching: "Searching...",
    loadUsersFailed: "Couldn't load users",
    noUsersFound: "No users found",
    invite: "Invite",
    label: "Invite",
    title: "Invite Friends",
    pendingInvitesMeta: (count) => `${count} pending invites`,
    openPlanPrompt: "Open a plan chat to invite your friends.",
    loadingInviteFlow: "Loading invite flow...",
    addUserTitle: "Add Splann-O user",
    addUserBody: "Search by name or username and invite them directly.",
    searchPlaceholder: "Search by name or username...",
    shareLinkTitle: "Share invite link",
    shareLinkBody: "Send one link and friends will join this plan directly.",
    inviteLinkLabel: "Invite link",
    shareTitleFallback: "Join this plan on Splann-O",
    pendingInvitesTitle: "Pending invites",
    pendingInviteFallback: "Pending invite",
    waitingForResponse: "Waiting for response",
    noPendingInvites: "No pending invites yet.",
  },
  es: {
    prepareInviteLinkFailed: "No se pudo preparar el enlace de invitación.",
    inviteSent: (name) => `Invitaste a ${name}`,
    inviteFailed: "No se pudo enviar la invitación.",
    searchPrompt: "Busca a un amigo que ya esté en Splann-O",
    searching: "Buscando...",
    loadUsersFailed: "No se pudieron cargar los usuarios",
    noUsersFound: "No se encontraron usuarios",
    invite: "Invitar",
    label: "Invitar",
    title: "Invitar amigos",
    pendingInvitesMeta: (count) => `${count} invitaciones pendientes`,
    openPlanPrompt: "Abrí un plan para invitar a tus amigos.",
    loadingInviteFlow: "Cargando invitaciones...",
    addUserTitle: "Agregar usuario de Splann-O",
    addUserBody: "Buscá por nombre o usuario e invitá directamente.",
    searchPlaceholder: "Buscar por nombre o usuario...",
    shareLinkTitle: "Compartir enlace de invitación",
    shareLinkBody: "Enviá un solo enlace y tus amigos se unirán directo al plan.",
    inviteLinkLabel: "Enlace de invitación",
    shareTitleFallback: "Únete a este plan en Splann-O",
    pendingInvitesTitle: "Invitaciones pendientes",
    pendingInviteFallback: "Invitación pendiente",
    waitingForResponse: "Esperando respuesta",
    noPendingInvites: "Todavía no hay invitaciones pendientes.",
  },
  it: {
    prepareInviteLinkFailed: "Impossibile preparare il link di invito.",
    inviteSent: (name) => `Invito inviato a ${name}`,
    inviteFailed: "Impossibile inviare l'invito.",
    searchPrompt: "Cerca un amico già su Splann-O",
    searching: "Ricerca in corso...",
    loadUsersFailed: "Impossibile caricare gli utenti",
    noUsersFound: "Nessun utente trovato",
    invite: "Invita",
    label: "Invita",
    title: "Invita amici",
    pendingInvitesMeta: (count) => `${count} inviti in attesa`,
    openPlanPrompt: "Apri un piano per invitare i tuoi amici.",
    loadingInviteFlow: "Caricamento inviti...",
    addUserTitle: "Aggiungi utente Splann-O",
    addUserBody: "Cerca per nome o username e invitalo direttamente.",
    searchPlaceholder: "Cerca per nome o username...",
    shareLinkTitle: "Condividi link di invito",
    shareLinkBody: "Invia un solo link e gli amici entreranno direttamente nel piano.",
    inviteLinkLabel: "Link di invito",
    shareTitleFallback: "Unisciti a questo piano su Splann-O",
    pendingInvitesTitle: "Inviti in attesa",
    pendingInviteFallback: "Invito in attesa",
    waitingForResponse: "In attesa di risposta",
    noPendingInvites: "Nessun invito in attesa.",
  },
  nl: {
    prepareInviteLinkFailed: "Uitnodigingslink kon niet worden voorbereid.",
    inviteSent: (name) => `${name} is uitgenodigd`,
    inviteFailed: "Uitnodiging kon niet worden verstuurd.",
    searchPrompt: "Zoek een vriend die al op Splann-O zit",
    searching: "Zoeken...",
    loadUsersFailed: "Gebruikers konden niet worden geladen",
    noUsersFound: "Geen gebruikers gevonden",
    invite: "Uitnodigen",
    label: "Uitnodigen",
    title: "Vrienden uitnodigen",
    pendingInvitesMeta: (count) => `${count} openstaande uitnodigingen`,
    openPlanPrompt: "Open een plan om je vrienden uit te nodigen.",
    loadingInviteFlow: "Uitnodigingen laden...",
    addUserTitle: "Splann-O gebruiker toevoegen",
    addUserBody: "Zoek op naam of gebruikersnaam en nodig direct uit.",
    searchPlaceholder: "Zoek op naam of gebruikersnaam...",
    shareLinkTitle: "Uitnodigingslink delen",
    shareLinkBody: "Stuur één link en vrienden doen direct mee aan dit plan.",
    inviteLinkLabel: "Uitnodigingslink",
    shareTitleFallback: "Doe mee aan dit plan op Splann-O",
    pendingInvitesTitle: "Openstaande uitnodigingen",
    pendingInviteFallback: "Openstaande uitnodiging",
    waitingForResponse: "Wachten op reactie",
    noPendingInvites: "Nog geen openstaande uitnodigingen.",
  },
};

export function InviteFlowPanel() {
  const eventId = useActiveEventId();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { toastError, toastSuccess } = useAppToast();
  const copy = INVITE_PANEL_COPY[language];
  const planQuery = usePlan(eventId);
  const guests = useEventGuests(eventId);
  const ensureInviteToken = useEnsureInviteToken();
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [invitingUserId, setInvitingUserId] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const localInvitedSetRef = useRef<Set<number>>(new Set());
  const plan = planQuery.data;
  const planStatus = getClientPlanStatus(plan?.status);
  const pendingInvites = guests.invitesPending;
  const settlementRoundsQuery = useQuery<SettlementRoundsResponse>({
    queryKey: ["/api/events", eventId, "settlements", "invite-lock"],
    enabled: !!eventId,
    queryFn: async () => {
      if (!eventId) return { activeFinalSettlementRound: null };
      const res = await fetch(`/api/events/${eventId}/settlements`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load settlement lock");
      return res.json() as Promise<SettlementRoundsResponse>;
    },
    staleTime: 15_000,
    refetchInterval: eventId ? 5_000 : false,
  });
  const invitesLocked = planStatus !== "active" || !!settlementRoundsQuery.data?.activeFinalSettlementRound;
  const invitesLockedMessage = planStatus === "settled"
    ? "This plan is settled. Invites are disabled."
    : planStatus === "closed"
      ? "This plan is closed. Invites are disabled."
      : "Settlement already started. The participant list is frozen.";
  const userSearch = useSearchUsers(debouncedSearch);
  const inviteUrl = useMemo(() => buildInviteUrl(plan?.inviteToken), [plan?.inviteToken]);
  const inviteMessage = useMemo(() => generateInviteMessage({
    name: plan?.name,
    locationName: plan?.locationName,
    locationText: plan?.locationText,
    city: plan?.city,
    countryName: plan?.countryName,
    eventType: plan?.eventType,
    date: plan?.date,
  }, inviteUrl), [inviteUrl, plan?.city, plan?.countryName, plan?.date, plan?.eventType, plan?.locationName, plan?.locationText, plan?.name]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!isDropdownOpen) return;
    const onDocumentMouseDown = (event: MouseEvent) => {
      if (!dropdownRef.current) return;
      if (dropdownRef.current.contains(event.target as Node)) return;
      setIsDropdownOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsDropdownOpen(false);
    };
    document.addEventListener("mousedown", onDocumentMouseDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onDocumentMouseDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [isDropdownOpen]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [debouncedSearch, userSearch.data]);

  const ensureTokenAndBuildUrl = async () => {
    if (!eventId || invitesLocked) return null;
    try {
      const next = await ensureInviteToken.mutateAsync(eventId);
      return buildInviteUrl(next.inviteToken);
    } catch (error) {
      toastError(error instanceof Error ? error.message : copy.prepareInviteLinkFailed);
      return null;
    }
  };

  const memberUserIds = useMemo(
    () => new Set(guests.members.map((member) => Number(member.userId)).filter((id) => Number.isFinite(id) && id > 0)),
    [guests.members],
  );
  const pendingInviteUserIds = useMemo(
    () => new Set(pendingInvites.map((invite) => Number(invite.inviteeUserId)).filter((id) => Number.isFinite(id) && id > 0)),
    [pendingInvites],
  );
  const filteredResults = useMemo(() => {
    const rows = (userSearch.data ?? []) as UserSearchRow[];
    return rows.filter((row) => {
      if (!row || !Number.isFinite(Number(row.id))) return false;
      if (Number(row.id) === Number(user?.id)) return false;
      if (memberUserIds.has(row.id)) return false;
      if (pendingInviteUserIds.has(row.id)) return false;
      if (localInvitedSetRef.current.has(row.id)) return false;
      return true;
    });
  }, [memberUserIds, pendingInviteUserIds, user?.id, userSearch.data]);

  const inviteUserDirectly = async (target: UserSearchRow) => {
    if (!eventId || invitesLocked) return;
    const userId = Number(target.id);
    if (!Number.isFinite(userId) || userId <= 0) return;

    const queryKey = ["/api/events", eventId, "invites", "pending"] as const;
    const previous = queryClient.getQueryData<EventInviteView[]>(queryKey) ?? [];
    const tempId = `temp-invite-${userId}-${Date.now()}`;

    const optimisticInvite: EventInviteView = {
      id: tempId,
      status: "pending",
      inviteType: "user",
      inviteeUserId: userId,
      createdAt: new Date().toISOString(),
      invitee: {
        userId,
        name: target.displayName || target.username,
        username: target.username || null,
        avatarUrl: target.avatarUrl ?? null,
      },
    };

    setInvitingUserId(userId);
    localInvitedSetRef.current.add(userId);
    queryClient.setQueryData<EventInviteView[]>(queryKey, [optimisticInvite, ...previous]);

    try {
      await guests.createInvite({ userId });
      toastSuccess(copy.inviteSent(target.displayName || target.username));
      setSearchInput("");
      setDebouncedSearch("");
      setIsDropdownOpen(false);
      await guests.refresh();
    } catch (error) {
      localInvitedSetRef.current.delete(userId);
      queryClient.setQueryData<EventInviteView[]>(queryKey, previous);
      toastError(error instanceof Error ? error.message : copy.inviteFailed);
    } finally {
      setInvitingUserId(null);
    }
  };

  const renderSearchContent = () => {
    if (debouncedSearch.length < 2) {
      return <p className="px-1 py-2 text-xs text-muted-foreground">{copy.searchPrompt}</p>;
    }
    if (userSearch.isLoading) {
      return (
        <div className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {copy.searching}
        </div>
      );
    }
    if (userSearch.isError) {
      return <p className="px-1 py-2 text-xs text-destructive">{copy.loadUsersFailed}</p>;
    }
    if (filteredResults.length === 0) {
      return <p className="px-1 py-2 text-xs text-muted-foreground">{copy.noUsersFound}</p>;
    }

    return filteredResults.slice(0, 8).map((result, index) => {
      const displayName = result.displayName || result.username;
      const isHighlighted = index === highlightedIndex;
      const isInviting = invitingUserId === result.id;
      return (
        <div
          key={`invite-search-result-${result.id}`}
          className="flex items-center justify-between gap-2 rounded-xl px-2 py-1.5"
        >
          <div className="min-w-0 flex items-center gap-2.5">
            <Avatar className="h-8 w-8">
              {result.avatarUrl ? <AvatarImage src={resolveAssetUrl(result.avatarUrl) ?? result.avatarUrl} alt={displayName} /> : null}
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                {(displayName || "?").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
              {result.username ? <p className="truncate text-xs text-muted-foreground">@{result.username}</p> : null}
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-7 rounded-full px-3"
            variant={isHighlighted ? "default" : "outline"}
            disabled={isInviting || invitesLocked}
            onClick={() => void inviteUserDirectly(result)}
          >
            {isInviting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : copy.invite}
          </Button>
        </div>
      );
    });
  };

  return (
    <PanelShell>
      <PanelHeader
        label={copy.label}
        title={copy.title}
        meta={<span className="inline-flex items-center gap-2"><Users className="h-4 w-4" />{copy.pendingInvitesMeta(pendingInvites.length)}</span>}
      />
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {!eventId ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 p-4 text-sm text-muted-foreground">
            {copy.openPlanPrompt}
          </div>
        ) : planQuery.isLoading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card/80 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {copy.loadingInviteFlow}
          </div>
        ) : (
          <>
            {invitesLocked ? (
              <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 p-4 text-sm text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
                {invitesLockedMessage}
              </div>
            ) : null}
            <PanelSection title={copy.addUserTitle} variant="default">
              <p className="mb-3 text-sm text-muted-foreground">
                {copy.addUserBody}
              </p>
              <div ref={dropdownRef} className="relative">
                <Input
                  value={searchInput}
                  onChange={(event) => {
                    setSearchInput(event.target.value);
                    setIsDropdownOpen(true);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  placeholder={copy.searchPlaceholder}
                  className="border-border bg-background"
                  disabled={invitesLocked}
                  onKeyDown={(event) => {
                    if (!isDropdownOpen) return;
                    const maxIndex = Math.max(0, Math.min(filteredResults.length, 8) - 1);
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      setHighlightedIndex((current) => Math.min(current + 1, maxIndex));
                    } else if (event.key === "ArrowUp") {
                      event.preventDefault();
                      setHighlightedIndex((current) => Math.max(current - 1, 0));
                    } else if (event.key === "Enter" && filteredResults.length > 0) {
                      event.preventDefault();
                      const target = filteredResults[Math.min(highlightedIndex, filteredResults.length - 1)];
                      if (target) void inviteUserDirectly(target);
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      setIsDropdownOpen(false);
                    }
                  }}
                />
                {isDropdownOpen ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 max-h-72 overflow-y-auto rounded-2xl border border-border/70 bg-popover p-1.5 shadow-lg">
                    {renderSearchContent()}
                  </div>
                ) : null}
              </div>
            </PanelSection>

            <PanelSection title={copy.shareLinkTitle} variant="default">
              <p className="mb-3 text-sm text-muted-foreground">
                {copy.shareLinkBody}
              </p>
              <InviteLink
                url={inviteUrl}
                onEnsureToken={ensureTokenAndBuildUrl}
                label={copy.inviteLinkLabel}
                shareTitle={plan?.name ?? copy.shareTitleFallback}
                shareMessage={inviteMessage}
                disabled={invitesLocked}
                getShareMessage={(url) => generateInviteMessage({
                  name: plan?.name,
                  locationName: plan?.locationName,
                  locationText: plan?.locationText,
                  city: plan?.city,
                  countryName: plan?.countryName,
                  eventType: plan?.eventType,
                  date: plan?.date,
                }, url)}
              />
            </PanelSection>

            <PanelSection title={copy.pendingInvitesTitle} variant="list">
              <p className="mt-0.5 text-xs text-muted-foreground">
                They haven't joined yet — send them the link directly if needed.
              </p>
              {pendingInvites.length > 0 ? (
                <div className="mt-3 divide-y divide-[hsl(var(--border-subtle))]">
                  {pendingInvites.map((invite) => (
                    <div key={`invite-row-${invite.id}`} className="flex items-center justify-between gap-3 px-1 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {invite.invitee?.name ?? invite.email ?? copy.pendingInviteFallback}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {invite.invitee?.username ? `@${invite.invitee.username}` : copy.waitingForResponse}
                        </p>
                      </div>
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(
                          `Hey! Join my plan on Splann-O: ${inviteUrl}`,
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1.5 text-xs font-medium text-green-700 transition hover:bg-green-100 dark:border-green-500/25 dark:bg-green-500/10 dark:text-green-300"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        WhatsApp
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{copy.noPendingInvites}</p>
              )}
            </PanelSection>
          </>
        )}
      </div>
    </PanelShell>
  );
}

export default InviteFlowPanel;
