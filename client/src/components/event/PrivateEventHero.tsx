import type { ReactNode } from "react";
import type { Barbecue } from "@shared/schema";
import type { EventHeaderProps } from "@/components/event/EventHeader";
import { EventHeader } from "@/components/event/EventHeader";
import type { PrivateTemplateDef } from "@/lib/private-event-templates";
import { EventBanner } from "@/components/events/EventBanner";
import type { EventBannerPresetId } from "@/lib/event-banner";

export function PrivateEventHero({
  event,
  template,
  participantNames,
  participantCount,
  headerProps,
  canEditBanner = false,
  onUploadBanner,
  onSelectBannerPreset,
  onResetBanner,
}: {
  event: Barbecue;
  template: PrivateTemplateDef;
  participantNames: string[];
  participantCount: number;
  headerProps: EventHeaderProps;
  canEditBanner?: boolean;
  onUploadBanner?: (dataUrl: string) => Promise<void>;
  onSelectBannerPreset?: (presetId: EventBannerPresetId) => Promise<void>;
  onResetBanner?: () => Promise<void>;
}) {
  return (
    <div className="space-y-3">
      <EventBanner
        event={event}
        editable={canEditBanner}
        variant="private"
        templateFallbackClassName={template.bannerClassName}
        templateLabel={template.label}
        templateEmoji={template.emoji}
        onUpload={onUploadBanner}
        onSelectPreset={onSelectBannerPreset}
        onReset={onResetBanner}
      />

      <div className="rounded-2xl border border-border/60 bg-card/90 px-4 py-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex -space-x-2">
              {participantNames.slice(0, 4).map((name) => (
                <div
                  key={`hero-avatar-${name}`}
                  className="grid h-8 w-8 place-items-center rounded-full border border-background bg-primary/10 text-[11px] font-semibold text-primary"
                  title={name}
                >
                  {name.slice(0, 1).toUpperCase()}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {participantCount} {participantCount === 1 ? "person" : "people"} in this circle
            </p>
          </div>
        </div>
      </div>

      <EventHeader {...headerProps} />
    </div>
  );
}

export default PrivateEventHero;
