import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { Barbecue } from "@shared/schema";
import { normalizeCountryCode } from "@shared/lib/country-code";
import { UpgradeRequiredError, type UpgradeRequiredPayload } from "@/lib/upgrade";

export type ExploreEvent = {
  id: number;
  title: string;
  subtitle?: string | null;
  date: string | null;
  city: string | null;
  countryName: string | null;
  latitude?: number | null;
  longitude?: number | null;
  currencyCode: string;
  organizationName: string | null;
  publicDescription: string | null;
  publicSlug: string;
  publicMode: "marketing" | "joinable";
  publicTemplate?: "classic" | "keynote" | "workshop" | "nightlife" | "meetup";
  publicListingStatus?: "inactive" | "active" | "expired" | "paused";
  publicListFromAt?: string | null;
  publicListUntilAt?: string | null;
  publicListingExpiresAt?: string | null;
  themeCategory?: "party" | "networking" | "meetup" | "workshop" | "conference" | "training" | "sports" | "other";
};

export type PublicEventDetail = ExploreEvent & {
  locationName: string | null;
  bannerImageUrl: string | null;
  organizer: {
    handle: string | null;
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    profileImageUrl: string | null;
    publicEventsHosted: number;
    verifiedHost: boolean;
  } | null;
  rsvpTiers: Array<{
    id: string;
    name: string;
    description: string | null;
    priceLabel: string | null;
    capacity: number | null;
    isFree: boolean;
  }>;
};

export type PublicInboxEligibility = {
  eventId: number;
  canMessageOrganizer: boolean;
  isOrganizer: boolean;
  isApproved: boolean;
  hasJoinRequest: boolean;
  requestStatus: string | null;
  reason: "request_to_join_first" | "invite_only" | null;
};

export type PublicConversationMessage = {
  id: string;
  conversationId: string;
  senderUserId: number;
  body: string;
  createdAt: string | null;
  readAt: string | null;
  sender: {
    id: number;
    username: string;
    publicHandle?: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    profileImageUrl: string | null;
  } | null;
};

export type PublicConversation = {
  id: string;
  barbecueId: number;
  organizerUserId: number;
  participantUserId: number | null;
  participantEmail: string | null;
  participantLabel: string | null;
  status: "pending" | "active" | "archived" | "blocked";
  lastMessageAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  event?: { id: number; title: string; bannerImageUrl: string | null; publicSlug: string | null; date: string | null } | null;
  organizer?: { id: number; username: string; handle: string; displayName: string | null; avatarUrl: string | null; profileImageUrl: string | null } | null;
  participant?: { id: number; username: string; handle: string; displayName: string | null; avatarUrl: string | null; profileImageUrl: string | null } | null;
  lastMessage?: { body: string; createdAt: string | null } | null;
};

export type PublicProfileEvent = {
  id: number;
  title: string;
  date: string | null;
  locationName: string | null;
  city: string | null;
  countryName: string | null;
  publicSlug: string;
  publicMode: "marketing" | "joinable";
  attendeeCount: number;
  bannerImageUrl: string | null;
  themeCategory: "party" | "networking" | "meetup" | "workshop" | "conference" | "training" | "sports" | "other";
};

export type PublicProfilePayload = {
  profile: {
    id: number;
    username: string;
    handle: string;
    displayName: string | null;
    profileImageUrl: string | null;
    avatarUrl: string | null;
    bio: string | null;
    createdAt: string | null;
  };
  viewerIsOwner: boolean;
  stats: {
    publicEventsHosted: number;
    totalAttendees: number;
    ratioLabel: "Mostly private" | "Balanced" | "Mostly public" | null;
  };
  events: PublicProfileEvent[];
};

export function useBarbecues() {
  return useQuery({
    queryKey: ['/api/barbecues'],
    queryFn: async () => {
      const res = await fetch(api.barbecues.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch barbecues");
      return res.json() as Promise<Barbecue[]>;
    },
  });
}

export function usePublicBarbecues() {
  return useQuery({
    queryKey: ['/api/barbecues/public'],
    queryFn: async () => {
      const res = await fetch(api.barbecues.listPublic.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch public events");
      return res.json() as Promise<Barbecue[]>;
    },
  });
}

export function useCreateBarbecue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      date: string;
      currency?: string;
      creatorId?: string;
      isPublic?: boolean;
      allowOptInExpenses?: boolean;
      area?: string;
      eventType?: string;
      templateData?: unknown;
      locationName?: string | null;
      city?: string | null;
      countryCode?: string | null;
      countryName?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      placeId?: string | null;
      locationText?: string | null;
      locationMeta?: unknown;
      visibility?: "private" | "public";
      visibilityOrigin?: "private" | "public";
      eventVibe?: string;
      publicMode?: "marketing" | "joinable";
      publicTemplate?: "classic" | "keynote" | "workshop" | "nightlife" | "meetup";
      publicListingStatus?: "inactive" | "active" | "expired" | "paused";
      publicListFromAt?: string | null;
      publicListUntilAt?: string | null;
      publicListingExpiresAt?: string | null;
      status?: "draft" | "active" | "settling" | "settled";
      organizationName?: string | null;
      publicDescription?: string | null;
      bannerImageUrl?: string | null;
    }) => {
      const requestBody: Record<string, unknown> = { ...data };
      const normalizedCountryCode = normalizeCountryCode(data.countryCode);
      if (normalizedCountryCode) requestBody.countryCode = normalizedCountryCode;
      else delete requestBody.countryCode;
      if (data.locationMeta && typeof data.locationMeta === "object") {
        const meta = { ...(data.locationMeta as Record<string, unknown>) };
        const normalizedMetaCountryCode = normalizeCountryCode(meta.countryCode);
        if (normalizedMetaCountryCode) meta.countryCode = normalizedMetaCountryCode;
        else delete meta.countryCode;
        requestBody.locationMeta = meta;
      }

      const res = await fetch(api.barbecues.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(requestBody),
      });
      const responseBody = await res.json().catch(() => ({}));
      if (res.status === 402 && (responseBody as { code?: string }).code === "UPGRADE_REQUIRED") {
        throw new UpgradeRequiredError(responseBody as UpgradeRequiredPayload);
      }
      if (!res.ok) {
        throw new Error((responseBody as { message?: string }).message || "Failed to create barbecue");
      }
      return responseBody as Barbecue;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/barbecues'] });
    },
  });
}

export function useUpdateBarbecue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updates: {
      id: number;
      allowOptInExpenses?: boolean;
      templateData?: unknown;
      status?: "draft" | "active" | "settling" | "settled";
      locationName?: string | null;
      city?: string | null;
      countryCode?: string | null;
      countryName?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      placeId?: string | null;
      locationText?: string | null;
      locationMeta?: unknown;
      currency?: string;
      currencySource?: "auto" | "manual";
      eventType?: string;
      eventVibe?: string;
      visibility?: "private" | "public";
      visibilityOrigin?: "private" | "public";
      publicMode?: "marketing" | "joinable";
      publicTemplate?: "classic" | "keynote" | "workshop" | "nightlife" | "meetup";
      publicListingStatus?: "inactive" | "active" | "expired" | "paused";
      publicListFromAt?: string | null;
      publicListUntilAt?: string | null;
      publicListingExpiresAt?: string | null;
      organizationName?: string | null;
      publicDescription?: string | null;
      bannerImageUrl?: string | null;
    }) => {
      const { id, ...rest } = updates;
      const url = buildUrl(api.barbecues.update.path, { id });
      const body: Record<string, unknown> = {};
      if (rest.allowOptInExpenses !== undefined) body.allowOptInExpenses = rest.allowOptInExpenses;
      if (rest.templateData !== undefined) body.templateData = rest.templateData;
      if (rest.status !== undefined) body.status = rest.status;
      if (rest.locationName !== undefined) body.locationName = rest.locationName;
      if (rest.city !== undefined) body.city = rest.city;
      if (rest.countryCode !== undefined) {
        const normalizedCountryCode = normalizeCountryCode(rest.countryCode);
        body.countryCode = normalizedCountryCode ?? null;
      }
      if (rest.countryName !== undefined) body.countryName = rest.countryName;
      if (rest.latitude !== undefined) body.latitude = rest.latitude;
      if (rest.longitude !== undefined) body.longitude = rest.longitude;
      if (rest.placeId !== undefined) body.placeId = rest.placeId;
      if (rest.locationText !== undefined) body.locationText = rest.locationText;
      if (rest.locationMeta !== undefined) {
        if (rest.locationMeta && typeof rest.locationMeta === "object") {
          const meta = { ...(rest.locationMeta as Record<string, unknown>) };
          const normalizedMetaCountryCode = normalizeCountryCode(meta.countryCode);
          if (normalizedMetaCountryCode) meta.countryCode = normalizedMetaCountryCode;
          else delete meta.countryCode;
          body.locationMeta = meta;
        } else {
          body.locationMeta = rest.locationMeta;
        }
      }
      if (rest.currency !== undefined) body.currency = rest.currency;
      if (rest.currencySource !== undefined) body.currencySource = rest.currencySource;
      if (rest.eventType !== undefined) body.eventType = rest.eventType;
      if (rest.eventVibe !== undefined) body.eventVibe = rest.eventVibe;
      if (rest.visibility !== undefined) body.visibility = rest.visibility;
      if (rest.visibilityOrigin !== undefined) body.visibilityOrigin = rest.visibilityOrigin;
      if (rest.publicMode !== undefined) body.publicMode = rest.publicMode;
      if (rest.publicTemplate !== undefined) body.publicTemplate = rest.publicTemplate;
      if (rest.publicListingStatus !== undefined) body.publicListingStatus = rest.publicListingStatus;
      if (rest.publicListFromAt !== undefined) body.publicListFromAt = rest.publicListFromAt;
      if (rest.publicListUntilAt !== undefined) body.publicListUntilAt = rest.publicListUntilAt;
      if (rest.publicListingExpiresAt !== undefined) body.publicListingExpiresAt = rest.publicListingExpiresAt;
      if (rest.organizationName !== undefined) body.organizationName = rest.organizationName;
      if (rest.publicDescription !== undefined) body.publicDescription = rest.publicDescription;
      if (rest.bannerImageUrl !== undefined) body.bannerImageUrl = rest.bannerImageUrl;
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((payload as { message?: string }).message || "Failed to update barbecue");
      return payload as Barbecue;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/barbecues'] });
    },
  });
}

export function useUploadEventBanner(bbqId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dataUrl: string) => {
      if (!bbqId) throw new Error("No event selected");
      const res = await fetch(`/api/barbecues/${bbqId}/banner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ dataUrl }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((payload as { message?: string }).message || "Failed to upload banner");
      return payload as { bbqId: number; bannerImageUrl: string | null };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/barbecues"] });
    },
  });
}

export function useDeleteEventBanner(bbqId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!bbqId) throw new Error("No event selected");
      const res = await fetch(`/api/barbecues/${bbqId}/banner`, {
        method: "DELETE",
        credentials: "include",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((payload as { message?: string }).message || "Failed to remove banner");
      return payload as { bbqId: number; bannerImageUrl: null };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/barbecues"] });
    },
  });
}

export function useExploreEvents(enabled = true) {
  return useQuery({
    queryKey: ["/api/explore/events"],
    queryFn: async () => {
      const res = await fetch("/api/explore/events", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch explore events");
      return res.json() as Promise<ExploreEvent[]>;
    },
    enabled,
  });
}

export function usePublicEvent(slug: string | null) {
  return useQuery({
    queryKey: ["/api/public/events", slug],
    enabled: !!slug,
    queryFn: async () => {
      const res = await fetch(`/api/public/events/${encodeURIComponent(slug!)}`, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 410) throw new Error("gone");
        if (res.status === 404) throw new Error("not_found");
        if (res.status === 429) throw new Error("rate_limited");
        throw new Error("fetch_failed");
      }
      return res.json() as Promise<PublicEventDetail>;
    },
  });
}

export function usePublicEventMessagingEligibility(eventId: number | null, enabled = true) {
  return useQuery({
    queryKey: ["/api/public-events", eventId, "messaging-eligibility"],
    enabled: !!eventId && enabled,
    retry: false,
    queryFn: async () => {
      const res = await fetch(`/api/public-events/${eventId}/messaging-eligibility`, { credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { message?: string }).message || "eligibility_failed");
      return body as PublicInboxEligibility;
    },
  });
}

export function useCreatePublicConversation(eventId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!eventId) throw new Error("Missing event");
      const res = await fetch(`/api/public-events/${eventId}/conversations`, { method: "POST", credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { message?: string }).message || "Failed to open conversation");
      return body as PublicConversation;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/conversations"] });
      qc.invalidateQueries({ queryKey: ["/api/public-events", eventId, "messaging-eligibility"] });
    },
  });
}

export function useConversations(eventId?: number | null) {
  return useQuery({
    queryKey: ["/api/conversations", eventId ?? null],
    queryFn: async () => {
      const url = eventId ? `/api/conversations?eventId=${eventId}` : "/api/conversations";
      const res = await fetch(url, { credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { message?: string }).message || "Failed to load conversations");
      const raw = body as { conversations?: unknown; groupedByEvent?: unknown };
      return {
        conversations: Array.isArray(raw.conversations) ? (raw.conversations as PublicConversation[]) : [],
        groupedByEvent: raw.groupedByEvent && typeof raw.groupedByEvent === "object"
          ? (raw.groupedByEvent as Record<string, PublicConversation[]>)
          : {},
      };
    },
  });
}

export function useConversation(conversationId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["/api/conversations", conversationId],
    enabled: !!conversationId && enabled,
    queryFn: async () => {
      const res = await fetch(`/api/conversations/${encodeURIComponent(conversationId!)}`, { credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { message?: string }).message || "Failed to load conversation");
      return body as { conversation: PublicConversation; messages: PublicConversationMessage[] };
    },
  });
}

export function useSendConversationMessage(conversationId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (bodyText: string) => {
      if (!conversationId) throw new Error("Missing conversation");
      const res = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: bodyText }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { message?: string }).message || "Failed to send message");
      return body as PublicConversationMessage;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/conversations", conversationId] });
      qc.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
  });
}

export function useUpdateConversationStatus(conversationId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (status: "pending" | "active" | "archived" | "blocked") => {
      if (!conversationId) throw new Error("Missing conversation");
      const res = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { message?: string }).message || "Failed to update conversation");
      return body as PublicConversation;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/conversations", conversationId] });
      qc.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
  });
}

export type PublicEventRsvpSummary = {
  tiers: Array<{
    id: string;
    name: string;
    description: string | null;
    priceLabel: string | null;
    capacity: number | null;
    isFree: boolean;
    counts: { requested: number; approved: number; declined: number; going: number };
    soldOut: boolean;
  }>;
  myRsvp: { id: number; tierId: string | null; status: "requested" | "approved" | "declined" | "going" } | null;
};

export function usePublicEventRsvpSummary(slug: string | null) {
  return useQuery({
    queryKey: ["/api/public/events", slug, "rsvps"],
    enabled: !!slug,
    queryFn: async () => {
      const res = await fetch(`/api/public/events/${encodeURIComponent(slug!)}/rsvps`, { credentials: "include" });
      if (!res.ok) throw new Error("fetch_failed");
      return res.json() as Promise<PublicEventRsvpSummary>;
    },
  });
}

export function useSubmitPublicEventRsvp(slug: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { tierId?: string | null; status?: "requested" | "going" }) => {
      if (!slug) throw new Error("Missing event slug");
      const res = await fetch(`/api/public/events/${encodeURIComponent(slug)}/rsvps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { message?: string }).message || "Failed to RSVP");
      return body;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/public/events", slug, "rsvps"] });
    },
  });
}

export function usePublicEventRsvpRequests(eventId: number | null, enabled = true) {
  return useQuery({
    queryKey: ["/api/events", eventId, "rsvp-requests"],
    enabled: !!eventId && enabled,
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/rsvp-requests`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load RSVP requests");
      return res.json() as Promise<Array<{ id: number; tierId: string | null; userId: number | null; name: string | null; status: string; createdAt: string | null }>>;
    },
  });
}

export function useUpdatePublicEventRsvpRequest(eventId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { rsvpId: number; status: "approved" | "declined" | "going" | "requested" }) => {
      if (!eventId) throw new Error("Missing event");
      const res = await fetch(`/api/events/${eventId}/rsvp-requests/${input.rsvpId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: input.status }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { message?: string }).message || "Failed to update request");
      return body;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/events", eventId, "rsvp-requests"] });
    },
  });
}

export function usePublicProfile(username: string | null) {
  return useQuery({
    queryKey: ["/api/public-profile", username],
    enabled: !!username,
    queryFn: async () => {
      const res = await fetch(`/api/public-profile/${encodeURIComponent(username!)}`, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 404) throw new Error("not_found");
        throw new Error("fetch_failed");
      }
      return res.json() as Promise<PublicProfilePayload>;
    },
    staleTime: 60_000,
  });
}

export function useActivateListing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/events/${id}/activate-listing`, { method: "POST", credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { message?: string }).message || "Failed to activate listing");
      return body as Partial<Barbecue>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/barbecues"] });
      queryClient.invalidateQueries({ queryKey: ["/api/explore/events"] });
    },
  });
}

export function useDeactivateListing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/events/${id}/deactivate-listing`, { method: "POST", credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { message?: string }).message || "Failed to deactivate listing");
      return body as Barbecue;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/barbecues"] });
      queryClient.invalidateQueries({ queryKey: ["/api/explore/events"] });
    },
  });
}

export function useCheckoutPublicListing() {
  return useMutation({
    mutationFn: async (input: number | { id: number; publicMode?: "marketing" | "joinable" }) => {
      const id = typeof input === "number" ? input : input.id;
      const publicMode = typeof input === "number" ? undefined : input.publicMode;
      const res = await fetch(`/api/events/${id}/checkout-public-listing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(publicMode ? { publicMode } : {}),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { message?: string }).message || "Failed to start checkout");
      return body as { url: string };
    },
  });
}

export type EventNotification = {
  id: number;
  barbecueId: number;
  type: string;
  payload: { creatorName?: string; amountOwed?: number; eventName?: string; currency?: string } | null;
  createdAt: string | null;
  readAt: string | null;
};

export function useEventNotifications(enabled = true) {
  return useQuery({
    queryKey: ["/api/notifications/events"],
    queryFn: async () => {
      const res = await fetch("/api/notifications/events", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json() as Promise<EventNotification[]>;
    },
    enabled,
  });
}

export function useMarkEventNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/notifications/events/${id}/read`, { method: "PATCH", credentials: "include" });
      if (!res.ok) throw new Error("Failed to mark read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/events"] });
    },
  });
}

export function useSettleUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/barbecues/${id}/settle-up`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to settle up");
      return res.json() as Promise<Barbecue>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/barbecues'] });
    },
  });
}

export function useEnsureInviteToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/barbecues/${id}/ensure-invite-token`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to ensure invite token");
      return (await res.json()) as Barbecue;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/barbecues'] });
    },
  });
}

export function useDeleteBarbecue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.barbecues.delete.path, { id });
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete barbecue");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/barbecues'] });
    },
  });
}
