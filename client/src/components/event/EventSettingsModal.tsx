import { useEffect, useMemo, useState } from "react";
import type { Barbecue } from "@shared/schema";
import { isPublicEvent } from "@shared/event-visibility";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  PRIVATE_TEMPLATE_ORDER,
  getPrivateTemplateById,
  inferPrivateTemplateIdFromEvent,
  type PrivateTemplateId,
} from "@/lib/private-event-templates";

type UpdatePayload = {
  name?: string;
  date?: string;
  locationName?: string | null;
  city?: string | null;
  countryName?: string | null;
  currency?: string;
  publicMode?: "marketing" | "joinable";
  publicTemplate?: "classic" | "keynote" | "workshop" | "nightlife" | "meetup";
  publicListingStatus?: "inactive" | "active" | "expired" | "paused";
  visibility?: "private" | "public";
  organizationName?: string | null;
  publicDescription?: string | null;
  bannerImageUrl?: string | null;
  allowOptInExpenses?: boolean;
  templateData?: unknown;
};

export function EventSettingsModal({
  open,
  onOpenChange,
  event,
  isCreator,
  onUpdate,
  updating,
  onDelete,
  onCopyInviteLink,
  onOpenPublicPage,
  onActivateListing,
  onDeactivateListing,
  publicListingActive,
  visibilityLocked,
  allowOptInExpenses,
  onSettleUp,
  settleUpPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: Barbecue | null;
  isCreator: boolean;
  onUpdate: (updates: UpdatePayload) => void;
  updating?: boolean;
  onDelete?: () => void;
  onCopyInviteLink?: () => void;
  onOpenPublicPage?: () => void;
  onActivateListing?: () => void;
  onDeactivateListing?: () => void;
  publicListingActive?: boolean;
  visibilityLocked?: boolean;
  allowOptInExpenses?: boolean;
  onSettleUp?: () => void;
  settleUpPending?: boolean;
}) {
  const isPublic = isPublicEvent(event);
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("");
  const [dateValue, setDateValue] = useState("");
  const [locationValue, setLocationValue] = useState("");
  const [currencyValue, setCurrencyValue] = useState("EUR");
  const [bio, setBio] = useState("");
  const [orgName, setOrgName] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [privateTemplateId, setPrivateTemplateId] = useState<PrivateTemplateId>("generic");
  const [muteNotifications, setMuteNotifications] = useState(false);
  const [publicInboxEnabled, setPublicInboxEnabled] = useState(true);

  useEffect(() => {
    if (!event || !open) return;
    setTitle(event.name ?? "");
    const templateData = (event.templateData && typeof event.templateData === "object" ? event.templateData : {}) as Record<string, unknown>;
    setEmoji(typeof templateData.emoji === "string" ? templateData.emoji : "");
    setDateValue(event.date ? new Date(event.date).toISOString().slice(0, 16) : "");
    setLocationValue(event.locationName ?? "");
    setCurrencyValue(event.currency ?? "EUR");
    setBio(event.publicDescription ?? "");
    setOrgName(event.organizationName ?? "");
    setBannerUrl(event.bannerImageUrl ?? "");
    setPrivateTemplateId(inferPrivateTemplateIdFromEvent(event));
    setMuteNotifications(Boolean(templateData.muteNotifications));
    setPublicInboxEnabled(templateData.publicInboxEnabled !== false);
  }, [event, open]);

  const templateDataDraft = useMemo(() => {
    const base = (event?.templateData && typeof event.templateData === "object" ? event.templateData : {}) as Record<string, unknown>;
    return {
      ...base,
      ...(emoji ? { emoji } : {}),
      privateTemplateId,
      muteNotifications,
      publicInboxEnabled,
    };
  }, [event?.templateData, emoji, privateTemplateId, muteNotifications, publicInboxEnabled]);

  if (!event) return null;

  const saveBasics = () => {
    onUpdate({
      locationName: locationValue.trim() || null,
      currency: currencyValue.trim() || event.currency,
      templateData: templateDataDraft,
    });
  };

  const savePublicFields = () => {
    onUpdate({
      organizationName: orgName.trim() || null,
      publicDescription: bio.trim() || null,
      bannerImageUrl: bannerUrl.trim() || null,
      templateData: templateDataDraft,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl h-[80vh] max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-border/60">
          <DialogTitle>Event settings</DialogTitle>
          <DialogDescription>
            {isPublic ? "Professional event controls for branding, listing, and attendee experience." : "Manage your private event basics and sharing controls."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          <section className="rounded-xl border border-border/60 bg-card p-4 space-y-4">
            <h3 className="text-sm font-semibold">Basics</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="evt-settings-title">Title</Label>
                <Input id="evt-settings-title" value={title} onChange={(e) => setTitle(e.target.value)} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="evt-settings-emoji">Icon / emoji</Label>
                <Input id="evt-settings-emoji" value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="🎉" maxLength={4} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="evt-settings-currency">Currency</Label>
                <Input id="evt-settings-currency" value={currencyValue} onChange={(e) => setCurrencyValue(e.target.value.toUpperCase())} maxLength={3} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="evt-settings-date">Date</Label>
                <Input id="evt-settings-date" type="datetime-local" value={dateValue} onChange={(e) => setDateValue(e.target.value)} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="evt-settings-location">Location</Label>
                <Input id="evt-settings-location" value={locationValue} onChange={(e) => setLocationValue(e.target.value)} placeholder="Amsterdam, Netherlands" />
              </div>
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={saveBasics} disabled={updating}>Save basics</Button>
            </div>
            <p className="text-xs text-muted-foreground">Title and date editing stay in the main edit flow for now. This modal updates supported settings without changing event behavior.</p>
          </section>

          <section className="rounded-xl border border-border/60 bg-card p-4 space-y-4">
            <h3 className="text-sm font-semibold">People</h3>
            <div className="flex flex-wrap gap-2">
              {onCopyInviteLink && (
                <Button size="sm" variant="outline" onClick={onCopyInviteLink}>Copy invite link</Button>
              )}
              <Button size="sm" variant="outline" disabled>Remove member (from People tab)</Button>
              <Button size="sm" variant="outline" disabled>Transfer ownership (coming soon)</Button>
            </div>
          </section>

          <section className="rounded-xl border border-border/60 bg-card p-4 space-y-4">
            <h3 className="text-sm font-semibold">Customization</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Event color theme</Label>
                <Input value={String(((event.templateData as Record<string, unknown> | null)?.colorTheme as string) ?? "")} placeholder="Warm / Neutral / Ocean…" disabled />
                <p className="text-xs text-muted-foreground">Theme preview remains available in the event UI. Full presets can be expanded later.</p>
              </div>
              {isPublic && (
                <div className="space-y-2">
                  <Label>Event accent color</Label>
                  <Input value={String(((event.templateData as Record<string, unknown> | null)?.accentColor as string) ?? "")} placeholder="Coming soon" disabled />
                </div>
              )}
            </div>
          </section>

          {isPublic ? (
            <>
              <section className="rounded-xl border border-border/60 bg-card p-4 space-y-4">
                <h3 className="text-sm font-semibold">Branding</h3>
                <div className="space-y-2">
                  <Label htmlFor="evt-settings-org">Organizer display name</Label>
                  <Input id="evt-settings-org" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Your studio / brand" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="evt-settings-desc">Public description</Label>
                  <Textarea id="evt-settings-desc" value={bio} onChange={(e) => setBio(e.target.value)} rows={4} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="evt-settings-banner">Banner URL</Label>
                  <Input id="evt-settings-banner" value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)} placeholder="https://…" />
                </div>
                <div className="flex justify-end">
                  <Button size="sm" onClick={savePublicFields} disabled={updating}>Save branding</Button>
                </div>
              </section>

              <section className="rounded-xl border border-border/60 bg-card p-4 space-y-4">
                <h3 className="text-sm font-semibold">Visibility</h3>
                {visibilityLocked && (
                  <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-md px-2 py-1.5">
                    This event was created as Private and cannot be converted to Public later.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant={event.visibility !== "public" ? "default" : "outline"} onClick={() => onUpdate({ visibility: "private" })} disabled={updating}>
                    Draft / Unlisted
                  </Button>
                  <Button
                    size="sm"
                    variant={event.visibility === "public" ? "default" : "outline"}
                    onClick={() => onUpdate({ visibility: "public" })}
                    disabled={updating || !publicListingActive || !!visibilityLocked}
                  >
                    Listed / Published
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Publishing makes your event visible on Explore.</p>
              </section>

              <section className="rounded-xl border border-border/60 bg-card p-4 space-y-4">
                <h3 className="text-sm font-semibold">Attendance</h3>
                <div className="grid gap-2 md:grid-cols-3">
                  <Button size="sm" variant={event.publicMode === "marketing" ? "default" : "outline"} onClick={() => onUpdate({ publicMode: "marketing" })} disabled={updating}>
                    Invite only
                  </Button>
                  <Button size="sm" variant={event.publicMode === "joinable" ? "default" : "outline"} onClick={() => onUpdate({ publicMode: "joinable" })} disabled={updating}>
                    Request to join
                  </Button>
                  <Button size="sm" variant="outline" disabled>Open join (soon)</Button>
                </div>
              </section>

              <section className="rounded-xl border border-border/60 bg-card p-4 space-y-4">
                <h3 className="text-sm font-semibold">Organizer</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Organizer display name</Label>
                    <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Co-hosts</Label>
                    <Input disabled placeholder="Optional placeholder" />
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-border/60 bg-card p-4 space-y-4">
                <h3 className="text-sm font-semibold">Community</h3>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 p-3">
                  <div>
                    <p className="text-sm font-medium">Enable public inbox / DMs</p>
                    <p className="text-xs text-muted-foreground">Allows attendees to message the organizer from the public event page.</p>
                  </div>
                  <Switch checked={publicInboxEnabled} onCheckedChange={setPublicInboxEnabled} />
                </div>
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => onUpdate({ templateData: templateDataDraft })} disabled={updating}>Save community settings</Button>
                </div>
              </section>

              <section className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
                <h3 className="text-sm font-semibold">Listing controls</h3>
                <div className={`rounded-lg p-3 border ${publicListingActive ? "border-emerald-500/30 bg-emerald-500/10" : "border-amber-500/30 bg-amber-500/10"}`}>
                  <p className="text-sm font-medium">{publicListingActive ? "Listing active" : (event.publicListingStatus === "paused" ? "Listing paused" : "Listing inactive")}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {publicListingActive
                      ? `Active until ${event.publicListingExpiresAt ? new Date(event.publicListingExpiresAt).toLocaleDateString() : "—"}`
                      : "Activate a listing before publishing to Explore."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!publicListingActive && onActivateListing && (
                      <Button size="sm" onClick={onActivateListing}>Activate listing</Button>
                    )}
                    {publicListingActive && onDeactivateListing && (
                      <Button size="sm" variant="outline" onClick={onDeactivateListing}>Unpublish / deactivate</Button>
                    )}
                    {onOpenPublicPage && (
                      <Button size="sm" variant="outline" onClick={onOpenPublicPage} disabled={!event.publicSlug}>Preview public page</Button>
                    )}
                  </div>
                </div>
              </section>
            </>
          ) : (
            <>
              <section className="rounded-xl border border-border/60 bg-card p-4 space-y-4">
                <h3 className="text-sm font-semibold">Behavior</h3>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 p-3">
                  <div>
                    <p className="text-sm font-medium">Allow opt-in expenses</p>
                    <p className="text-xs text-muted-foreground">Participants can opt in to specific expenses.</p>
                  </div>
                  <Switch
                    checked={!!allowOptInExpenses}
                    onCheckedChange={(checked) => onUpdate({ allowOptInExpenses: checked })}
                    disabled={updating}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 p-3">
                  <div>
                    <p className="text-sm font-medium">Settle up</p>
                    <p className="text-xs text-muted-foreground">Create and share a settlement plan for this event.</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onSettleUp}
                    disabled={!onSettleUp || settleUpPending}
                  >
                    {settleUpPending ? "Preparing…" : "Settle up"}
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 p-3">
                  <div>
                    <p className="text-sm font-medium">Mute notifications</p>
                    <p className="text-xs text-muted-foreground">Hide activity notifications for this event on this device.</p>
                  </div>
                  <Switch checked={muteNotifications} onCheckedChange={setMuteNotifications} />
                </div>
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => onUpdate({ templateData: templateDataDraft })} disabled={updating}>Save behavior</Button>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 p-3">
                  <div>
                    <p className="text-sm font-medium">Archive event</p>
                    <p className="text-xs text-muted-foreground">Archiving is planned for a future update.</p>
                  </div>
                  <Button size="sm" variant="outline" disabled>Archive</Button>
                </div>
              </section>
              <section className="rounded-xl border border-border/60 bg-card p-4 space-y-4">
                <h3 className="text-sm font-semibold">Private look & feel</h3>
                <div className="space-y-2">
                  <Label>Template</Label>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {PRIVATE_TEMPLATE_ORDER.map((id) => {
                      const template = getPrivateTemplateById(id);
                      return (
                        <button
                          key={`settings-private-template-${id}`}
                          type="button"
                          onClick={() => setPrivateTemplateId(id)}
                          className={`rounded-lg border p-2.5 text-left transition-colors ${
                            privateTemplateId === id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/20"
                          }`}
                        >
                          <p className="text-sm font-semibold flex items-center gap-1.5">
                            <span aria-hidden>{template.emoji}</span>
                            {template.label}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-1">{template.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="evt-settings-private-banner">Banner image URL</Label>
                  <Input
                    id="evt-settings-private-banner"
                    value={bannerUrl}
                    onChange={(e) => setBannerUrl(e.target.value)}
                    placeholder="https://…"
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      onUpdate({
                        bannerImageUrl: bannerUrl.trim() || null,
                        templateData: templateDataDraft,
                      })
                    }
                    disabled={updating}
                  >
                    Save appearance
                  </Button>
                </div>
              </section>
            </>
          )}

          <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-destructive">Danger zone</h3>
            {isPublic && publicListingActive && onDeactivateListing && (
              <Button size="sm" variant="outline" onClick={onDeactivateListing}>Unpublish event</Button>
            )}
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Delete event</p>
                <p className="text-xs text-muted-foreground">This permanently removes the event and its data.</p>
              </div>
              <Button size="sm" variant="destructive" onClick={onDelete} disabled={!isCreator}>Delete event</Button>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default EventSettingsModal;
