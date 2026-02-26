import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { Barbecue } from "@shared/schema";
import { UpgradeRequiredError } from "@/lib/upgrade";

export type ExploreEvent = {
  id: number;
  title: string;
  date: string | null;
  city: string | null;
  countryName: string | null;
  currencyCode: string;
  organizationName: string | null;
  publicDescription: string | null;
  publicSlug: string;
  publicMode: "marketing" | "joinable";
  publicListingStatus?: "inactive" | "active" | "expired";
  publicListingExpiresAt?: string | null;
  themeCategory?: "party" | "networking" | "meetup" | "workshop" | "conference" | "training" | "sports" | "other";
};

export type PublicEventDetail = ExploreEvent & {
  locationName: string | null;
  bannerImageUrl: string | null;
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
      placeId?: string | null;
      visibility?: "private" | "public";
      visibilityOrigin?: "private" | "public";
      publicMode?: "marketing" | "joinable";
      publicListingStatus?: "inactive" | "active" | "expired";
      publicListingExpiresAt?: string | null;
      organizationName?: string | null;
      publicDescription?: string | null;
      bannerImageUrl?: string | null;
    }) => {
      const res = await fetch(api.barbecues.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 402 && (body as { code?: string }).code === "UPGRADE_REQUIRED") {
        throw new UpgradeRequiredError(body);
      }
      if (!res.ok) {
        throw new Error((body as { message?: string }).message || "Failed to create barbecue");
      }
      return body as Barbecue;
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
      placeId?: string | null;
      currency?: string;
      currencySource?: "auto" | "manual";
      visibility?: "private" | "public";
      visibilityOrigin?: "private" | "public";
      publicMode?: "marketing" | "joinable";
      publicListingStatus?: "inactive" | "active" | "expired";
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
      if (rest.countryCode !== undefined) body.countryCode = rest.countryCode;
      if (rest.countryName !== undefined) body.countryName = rest.countryName;
      if (rest.placeId !== undefined) body.placeId = rest.placeId;
      if (rest.currency !== undefined) body.currency = rest.currency;
      if (rest.currencySource !== undefined) body.currencySource = rest.currencySource;
      if (rest.visibility !== undefined) body.visibility = rest.visibility;
      if (rest.visibilityOrigin !== undefined) body.visibilityOrigin = rest.visibilityOrigin;
      if (rest.publicMode !== undefined) body.publicMode = rest.publicMode;
      if (rest.publicListingStatus !== undefined) body.publicListingStatus = rest.publicListingStatus;
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

export function useExploreEvents() {
  return useQuery({
    queryKey: ["/api/explore/events"],
    queryFn: async () => {
      const res = await fetch("/api/explore/events", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch explore events");
      return res.json() as Promise<ExploreEvent[]>;
    },
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
