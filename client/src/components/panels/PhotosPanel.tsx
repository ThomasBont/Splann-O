import { type ChangeEvent, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import { PanelHeader, PanelShell, panelHeaderAddButtonClass, useActiveEventId } from "@/components/panels/panel-primitives";
import { useAuth } from "@/hooks/use-auth";
import { useAppToast } from "@/hooks/use-app-toast";
import { useDeletePlanPhoto, usePlanPhotos, useUploadPlanPhoto } from "@/hooks/use-plan-photos";
import { usePlan } from "@/hooks/use-plan-data";
import { resolveAssetUrl } from "@/lib/asset-url";
import { formatDistanceToNowStrict } from "date-fns";
import { Camera, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { getClientPlanStatus, isPlanSociallyOpen } from "@/lib/plan-lifecycle";

const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export default function PhotosPanel() {
  const eventId = useActiveEventId();
  const { user } = useAuth();
  const { toastError, toastSuccess } = useAppToast();
  const planQuery = usePlan(eventId);
  const photosQuery = usePlanPhotos(eventId);
  const uploadPhoto = useUploadPlanPhoto(eventId);
  const deletePhoto = useDeletePlanPhoto(eventId);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);

  const plan = planQuery.data;
  const photos = useMemo(() => (
    photosQuery.data?.pages.flatMap((page) => page.items) ?? []
  ), [photosQuery.data]);
  const planStatus = getClientPlanStatus(plan?.status);
  const uploadsAllowed = isPlanSociallyOpen(plan?.status, plan?.endDate ?? plan?.date ?? null);
  const isReadOnly = !uploadsAllowed;
  const isPlanOwner = Number(plan?.creatorUserId ?? 0) === Number(user?.id ?? 0);
  const hasMorePhotos = !!photosQuery.hasNextPage;

  const selectedPhoto = useMemo(() => (
    photos.find((photo) => photo.id === selectedPhotoId) ?? null
  ), [photos, selectedPhotoId]);

  const readOnlyCopy = planStatus === "archived"
    ? "This plan is archived and read-only. Photos can still be viewed."
    : "This plan is closed. Photos can still be viewed.";

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      toastError("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toastError("Photo must be 10MB or smaller.");
      return;
    }

    try {
      await uploadPhoto.mutateAsync({ file });
      toastSuccess("Photo added");
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Couldn’t upload photo.");
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!window.confirm("Delete this photo?")) return;
    try {
      await deletePhoto.mutateAsync(photoId);
      if (selectedPhotoId === photoId) setSelectedPhotoId(null);
      toastSuccess("Photo deleted");
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Couldn’t delete photo.");
    }
  };

  return (
    <PanelShell>
      <PanelHeader
        label="Photos"
        title="Photos"
        meta={(
          <span>
            {photos.length === 1 ? "1 shared photo" : `${photos.length} shared photos`}
          </span>
        )}
        actions={!isReadOnly ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_MIME_TYPES.join(",")}
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              type="button"
              className={panelHeaderAddButtonClass()}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadPhoto.isPending}
            >
              {uploadPhoto.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
              Add photos
            </Button>
          </>
        ) : (
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_MIME_TYPES.join(",")}
            className="hidden"
            onChange={handleFileSelect}
          />
        )}
      />
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {isReadOnly ? (
          <div className="mb-4 rounded-[var(--radius-lg)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] px-4 py-3 text-sm text-muted-foreground">
            <p>{readOnlyCopy}</p>
            <p className="mt-1 text-xs text-muted-foreground/80">Uploads are no longer available for this plan.</p>
          </div>
        ) : (
          <p className="mb-4 text-xs text-muted-foreground">JPEG, PNG, or WebP up to 10MB.</p>
        )}

        {photosQuery.isLoading ? (
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading photos...
          </div>
        ) : photosQuery.isError ? (
          <div className="rounded-[var(--radius-lg)] border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {photosQuery.error instanceof Error ? photosQuery.error.message : "Couldn’t load photos."}
          </div>
        ) : photos.length === 0 ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center rounded-[24px] border border-dashed border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] px-6 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Camera className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">No photos yet</h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              {isReadOnly
                ? "There are no shared photos for this plan."
                : "Add the moments that made this plan memorable."}
            </p>
            {!isReadOnly ? (
              <Button
                type="button"
                className="mt-5 rounded-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadPhoto.isPending}
              >
                Add photos
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((photo) => {
                const canDelete = uploadsAllowed && (Number(photo.uploadedByUserId) === Number(user?.id ?? 0) || isPlanOwner);
                const imageUrl = resolveAssetUrl(photo.thumbUrl ?? photo.imageUrl) ?? resolveAssetUrl(photo.imageUrl) ?? "";
                return (
                  <div
                    key={photo.id}
                    className="group relative overflow-hidden rounded-[20px] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] shadow-[var(--shadow-sm)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedPhotoId(photo.id)}
                      className="block w-full text-left"
                    >
                      <AspectRatio ratio={1}>
                        <img
                          src={imageUrl}
                          alt={photo.caption ?? "Plan photo"}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </AspectRatio>
                      <div className="space-y-1 px-3 py-2">
                        <p className="truncate text-xs font-medium text-foreground">
                          {photo.uploader?.displayName || photo.uploader?.username || "Plan member"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {photo.createdAt
                            ? `${formatDistanceToNowStrict(new Date(photo.createdAt), { addSuffix: true })}`
                            : "Just now"}
                        </p>
                      </div>
                    </button>
                    {canDelete ? (
                      <button
                        type="button"
                        className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white opacity-100 shadow transition md:opacity-0 md:group-hover:opacity-100"
                        onClick={() => {
                          void handleDeletePhoto(photo.id);
                        }}
                        aria-label="Delete photo"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {hasMorePhotos ? (
              <div className="mt-5 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  disabled={photosQuery.isFetchingNextPage}
                  onClick={() => {
                    void photosQuery.fetchNextPage();
                  }}
                >
                  {photosQuery.isFetchingNextPage ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading more...
                    </>
                  ) : (
                    "Load more"
                  )}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>

      <Dialog open={!!selectedPhoto} onOpenChange={(open) => { if (!open) setSelectedPhotoId(null); }}>
        <DialogContent className="w-auto max-w-[92vw] border-0 bg-transparent p-0 shadow-none [&>button]:hidden">
          <DialogTitle className="sr-only">Photo preview</DialogTitle>
          {selectedPhoto ? (
            <div className="relative overflow-hidden rounded-[24px] bg-black/92 shadow-2xl">
              <img
                src={resolveAssetUrl(selectedPhoto.imageUrl) ?? ""}
                alt={selectedPhoto.caption ?? "Plan photo"}
                className="max-h-[82vh] max-w-[92vw] object-contain"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-4 pt-10 text-white">
                <p className="text-sm font-semibold">
                  {selectedPhoto.uploader?.displayName || selectedPhoto.uploader?.username || "Plan member"}
                </p>
                <p className="mt-1 text-xs text-white/80">
                  {selectedPhoto.createdAt
                    ? new Date(selectedPhoto.createdAt).toLocaleString()
                    : ""}
                </p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </PanelShell>
  );
}
