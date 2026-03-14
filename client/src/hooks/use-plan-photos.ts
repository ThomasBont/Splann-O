import { InfiniteData, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { EventPhotoWithUploader } from "@shared/schema";
import { PLAN_GC_TIME_MS, PLAN_STALE_TIME_MS } from "@/lib/query-stale";

export function planPhotosQueryKey(planId: number | null) {
  return ["photos", planId] as const;
}

export type PlanPhotosPage = {
  items: EventPhotoWithUploader[];
  nextCursor: string | null;
};

const PHOTO_PAGE_SIZE = 24;

export async function fetchPlanPhotos(planId: number, cursor?: string | null, limit = PHOTO_PAGE_SIZE) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  const url = `${buildUrl(api.photos.list.path, { planId })}?${params.toString()}`;
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({} as { message?: string }));
    throw new Error(body.message || "Failed to load photos");
  }
  return res.json() as Promise<PlanPhotosPage>;
}

export function usePlanPhotos(planId: number | null) {
  return useInfiniteQuery<PlanPhotosPage>({
    queryKey: planPhotosQueryKey(planId),
    enabled: !!planId,
    queryFn: async ({ pageParam }) => {
      if (!planId) return { items: [], nextCursor: null };
      return fetchPlanPhotos(planId, typeof pageParam === "string" ? pageParam : null);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: PLAN_STALE_TIME_MS,
    gcTime: PLAN_GC_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

export function useUploadPlanPhoto(planId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, caption }: { file: File; caption?: string | null }) => {
      if (!planId) throw new Error("No plan selected");
      const params = new URLSearchParams({
        filename: file.name || "photo",
      });
      if (caption?.trim()) params.set("caption", caption.trim());
      const url = `${buildUrl(api.photos.upload.path, { planId })}?${params.toString()}`;
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      });
      const body = await res.json().catch(() => ({} as { message?: string }));
      if (!res.ok) throw new Error(body.message || "Failed to upload photo");
      return body as EventPhotoWithUploader;
    },
    onSuccess: (createdPhoto) => {
      queryClient.setQueryData<InfiniteData<PlanPhotosPage>>(planPhotosQueryKey(planId), (current) => {
        if (!current) {
          return {
            pages: [{ items: [createdPhoto], nextCursor: null }],
            pageParams: [null],
          };
        }
        if (current.pages.length === 0) {
          return {
            ...current,
            pages: [{ items: [createdPhoto], nextCursor: null }],
          };
        }
        return {
          ...current,
          pages: current.pages.map((page, index) => {
            if (index !== 0) return page;
            return {
              ...page,
              items: [createdPhoto, ...page.items.filter((photo) => photo.id !== createdPhoto.id)],
            };
          }),
        };
      });
    },
  });
}

export function useDeletePlanPhoto(planId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (photoId: string) => {
      if (!planId) throw new Error("No plan selected");
      const url = buildUrl(api.photos.delete.path, { planId, photoId });
      const res = await fetch(url, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { message?: string }));
        throw new Error(body.message || "Failed to delete photo");
      }
      return photoId;
    },
    onSuccess: (deletedPhotoId) => {
      queryClient.setQueryData<InfiniteData<PlanPhotosPage>>(planPhotosQueryKey(planId), (current) => {
        if (!current) return current;
        return {
          ...current,
          pages: current.pages.map((page) => ({
            ...page,
            items: page.items.filter((photo) => photo.id !== deletedPhotoId),
          })),
        };
      });
    },
  });
}
