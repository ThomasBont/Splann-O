import type { ReactNode } from "react";
import type { Barbecue } from "@shared/schema";
import type { EventHeaderProps } from "@/components/event/EventHeader";
import { EventHeader } from "@/components/event/EventHeader";
import type { PrivateTemplateDef } from "@/lib/private-event-templates";
import { EventBanner } from "@/components/events/EventBanner";
import { VIBE_THEME, type PrivateEventVibeId } from "@/lib/event-types";
import { useLanguage } from "@/hooks/use-language";
import type { EventBannerPresetId } from "@shared/lib/plan-hero-banner";

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
  const templateData = (event.templateData && typeof event.templateData === "object")
    ? (event.templateData as Record<string, unknown>)
    : {};
  const { t } = useLanguage();
  const vibe = (typeof templateData.privateEventVibeId === "string" ? templateData.privateEventVibeId : event.eventVibe) as PrivateEventVibeId | undefined;
  const vibeTheme = vibe ? VIBE_THEME[vibe] : null;
  const vibeHelperCopy = vibe ? (t.privateWizard.vibeHelperCopy[vibe] ?? vibeTheme?.helperCopy) : null;

  return (
    <div className="space-y-3">
      <EventBanner
        event={event}
        editable={canEditBanner}
        variant="private"
        templateFallbackClassName={vibeTheme?.gradientClass ?? template.bannerClassName}
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
          {vibeTheme ? (
            <p className="text-[11px] text-muted-foreground hidden sm:block">{vibeHelperCopy}</p>
          ) : null}
        </div>
      </div>

      <EventHeader {...headerProps} />
    </div>
  );
}

export default PrivateEventHero;
