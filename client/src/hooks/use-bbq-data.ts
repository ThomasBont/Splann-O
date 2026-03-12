import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { Barbecue } from "@shared/schema";
import { normalizeCountryCode } from "@shared/lib/country-code";
import { UpgradeRequiredError, type UpgradeRequiredPayload } from "@/lib/upgrade";
import { resolveAssetUrl } from "@/lib/asset-url";
import { PLAN_STALE_TIME_MS } from "@/lib/query-stale";

export type BarbecueListItem = Barbecue & {
  participantCount: number;
  expenseTotal: number;
  lastActivityAt: string | null;
  unreadCount: number;
  myBalance: number | null;
  settlementStarted: boolean;
  timelineLocked: boolean;
  participantPreview: Array<{ id: number; name: string }>;
};

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

export async function fetchBarbecues() {
  const res = await fetch(api.barbecues.list.path, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch barbecues");
  return res.json() as Promise<BarbecueListItem[]>;
}

export async function fetchPlan(planId: number) {
  const all = await fetchBarbecues();
  return all.find((plan) => Number(plan.id) === planId) ?? null;
}

export function useBarbecues() {
  return useQuery({
    queryKey: ['/api/barbecues'],
    queryFn: fetchBarbecues,
  });
}

export function usePlanById(planId: number | null, enabled = true) {
  const queryClient = useQueryClient();
  return useQuery<BarbecueListItem | null>({
    queryKey: ["plan", planId],
    enabled: !!planId && enabled,
    staleTime: PLAN_STALE_TIME_MS,
    queryFn: async () => {
      if (!planId) return null;
      const cached = queryClient.getQueryData<BarbecueListItem[]>(['/api/barbecues']);
      if (Array.isArray(cached)) {
        const plan = cached.find((item) => Number(item.id) === planId) ?? null;
        if (plan) return plan;
      }
      const all = await queryClient.fetchQuery({
        queryKey: ['/api/barbecues'],
        queryFn: fetchBarbecues,
      });
      return all.find((item) => Number(item.id) === planId) ?? null;
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
      date?: string;
      startDate?: string;
      endDate?: string;
      currency?: string;
      planCurrency?: string;
      localCurrency?: string | null;
      creatorUserId?: number;
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
      localDate?: string | null;
      localTime?: string | null;
      timezoneId?: string | null;
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
      status?: "draft" | "active" | "closed" | "settled" | "archived";
      organizationName?: string | null;
      publicDescription?: string | null;
      bannerImageUrl?: string | null;
    }) => {
      const requestBody: Record<string, unknown> = { ...data };
      const normalizedCountryCode = normalizeCountryCode(data.countryCode);
      if (normalizedCountryCode) requestBody.countryCode = normalizedCountryCode;
      else delete requestBody.countryCode;
      if (typeof data.planCurrency === "string" && data.planCurrency.trim()) {
        requestBody.planCurrency = data.planCurrency.trim().toUpperCase();
      }
      if (typeof data.currency === "string" && data.currency.trim()) {
        requestBody.currency = data.currency.trim().toUpperCase();
      }
      if (data.localCurrency === null) {
        requestBody.localCurrency = null;
      } else if (typeof data.localCurrency === "string") {
        const normalizedLocal = data.localCurrency.trim().toUpperCase();
        requestBody.localCurrency = normalizedLocal || null;
      }
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
      name?: string;
      date?: string;
      startDate?: string;
      endDate?: string;
      allowOptInExpenses?: boolean;
      templateData?: unknown;
      status?: "draft" | "active" | "closed" | "settled" | "archived";
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
      localCurrency?: string | null;
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
      bannerAssetId?: string | null;
    }) => {
      const { id, ...rest } = updates;
      const url = buildUrl(api.barbecues.update.path, { id });
      const body: Record<string, unknown> = {};
      if (rest.name !== undefined) body.name = rest.name;
      if (rest.date !== undefined) body.date = rest.date;
      if (rest.startDate !== undefined) body.startDate = rest.startDate;
      if (rest.endDate !== undefined) body.endDate = rest.endDate;
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
      if (rest.localCurrency !== undefined) body.localCurrency = rest.localCurrency ? rest.localCurrency.trim().toUpperCase() : null;
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
      if (rest.bannerAssetId !== undefined) {
        body.bannerAssetId = rest.bannerAssetId;
        if (rest.bannerAssetId) body.bannerImageUrl = null;
      }
      if (rest.bannerImageUrl !== undefined) {
        if (rest.bannerImageUrl === null) {
          body.bannerImageUrl = null;
        } else {
          const raw = String(rest.bannerImageUrl).trim();
          if (raw.length > 0 && !raw.startsWith("blob:")) {
            const candidate = resolveAssetUrl(raw);
            if (!candidate) throw new Error("bannerImageUrl is invalid");
            // Preserve relative upload paths in persistence to avoid host-coupling across environments.
            body.bannerImageUrl = raw.startsWith("/") ? raw : candidate;
          }
        }
      }
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

export function useCheckoutSettlementTransfer() {
  return useMutation({
    mutationFn: async (input: { eventId: number; transferId: string; expenseId?: number }) => {
      const res = await fetch("/api/payments/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          planId: input.eventId,
          transferId: input.transferId,
          ...(typeof input.expenseId === "number" ? { expenseId: input.expenseId } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const error = new Error((body as { message?: string }).message || "Unable to start payment") as Error & { code?: string };
        error.code = (body as { code?: string }).code;
        throw error;
      }
      return body as { checkoutUrl: string; sessionId?: string };
    },
  });
}

export function useConfirmCheckoutSession() {
  return useMutation({
    mutationFn: async (input: { sessionId: string }) => {
      const res = await fetch("/api/payments/confirm-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const error = new Error((body as { message?: string }).message || "Unable to confirm payment") as Error & { code?: string };
        error.code = (body as { code?: string }).code;
        throw error;
      }
      return body as { reconciled: boolean; eventId: number | null; paymentStatus: string | null };
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

export type PlanInviteNotification = {
  id: string;
  eventId: number;
  eventName: string;
  inviterName: string | null;
  email: string | null;
  status: "pending" | "accepted" | "declined" | "revoked" | "expired" | string;
  createdAt: string | null;
};

export type AppNotificationsPayload = {
  friendRequests: Array<{
    friendshipId: number;
    userId: number;
    username: string;
    displayName: string | null;
    status: string;
  }>;
  planInvites: PlanInviteNotification[];
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

export function usePendingPlanInvites(enabled = true) {
  return useQuery({
    queryKey: ["/api/plans/invites/pending"],
    queryFn: async () => {
      const res = await fetch("/api/plans/invites/pending", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch pending invites");
      return res.json() as Promise<PlanInviteNotification[]>;
    },
    enabled,
  });
}

export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json() as Promise<AppNotificationsPayload>;
    },
    enabled,
    refetchInterval: 15000,
  });
}

export function useAcceptFriendRequestNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (friendshipId: number) => {
      const res = await fetch(`/api/friends/requests/${friendshipId}/accept`, {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { message?: string }).message || "Failed to accept friend request");
      return body as { ok: true };
    },
    onSuccess: (_result, friendshipId) => {
      queryClient.setQueryData<AppNotificationsPayload>(["/api/notifications"], (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          friendRequests: prev.friendRequests.filter((request) => request.friendshipId !== friendshipId),
        };
      });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/sent"] });
    },
  });
}

export function useDeclineFriendRequestNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (friendshipId: number) => {
      const res = await fetch(`/api/friends/requests/${friendshipId}/decline`, {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { message?: string }).message || "Failed to decline friend request");
      return body as { ok: true };
    },
    onSuccess: (_result, friendshipId) => {
      queryClient.setQueryData<AppNotificationsPayload>(["/api/notifications"], (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          friendRequests: prev.friendRequests.filter((request) => request.friendshipId !== friendshipId),
        };
      });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/sent"] });
    },
  });
}

export function useAcceptPlanInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (inviteId: string) => {
      const res = await fetch(`/api/plans/invites/${inviteId}/accept`, {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { message?: string }).message || "Failed to accept invite");
      return body as { eventId: number };
    },
    onSuccess: (_result, inviteId) => {
      queryClient.setQueryData<AppNotificationsPayload>(["/api/notifications"], (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          planInvites: prev.planInvites.filter((invite) => invite.id !== inviteId),
        };
      });
      queryClient.invalidateQueries({ queryKey: ["/api/plans/invites/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/barbecues"] });
      queryClient.invalidateQueries({ queryKey: ["/api/memberships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });
}

export function useDeclinePlanInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (inviteId: string) => {
      const res = await fetch(`/api/plans/invites/${inviteId}/decline`, {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { message?: string }).message || "Failed to decline invite");
      return body as { inviteId: string };
    },
    onSuccess: (_result, inviteId) => {
      queryClient.setQueryData<AppNotificationsPayload>(["/api/notifications"], (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          planInvites: prev.planInvites.filter((invite) => invite.id !== inviteId),
        };
      });
      queryClient.invalidateQueries({ queryKey: ["/api/plans/invites/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/barbecues"] });
      queryClient.invalidateQueries({ queryKey: ["/api/memberships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
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
      const res = await fetch(url, { method: "DELETE", credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { message?: string }).message || "Failed to delete plan");
      return body as { ok: true; deletedPlanId: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/barbecues'] });
      queryClient.invalidateQueries({ queryKey: ["/api/memberships"] });
    },
  });
}

export function useLeaveBarbecue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.barbecues.leave.path, { id });
      const res = await fetch(url, { method: "POST", credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { message?: string }).message || "Failed to leave plan");
      return body as { ok: true; left: true; planDeleted?: boolean; newCreatorId?: number | null };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/barbecues'] });
      queryClient.invalidateQueries({ queryKey: ["/api/memberships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });
}
