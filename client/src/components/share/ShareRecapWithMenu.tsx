"use client";

import { useRef } from "react";
import { EventRecapCard } from "./event-recap-card";
import { usePlan } from "@/hooks/use-plan";
import { ShareMenu } from "./ShareMenu";
import { buildSummaryShareText } from "@/lib/shareImage";
import type { RecapCardData } from "@/utils/shareCard";
import type { ThemeToken } from "@/theme/eventThemes";

const ENABLE_SHARING = import.meta.env.VITE_ENABLE_SHARING !== "false";

export interface ShareRecapWithMenuProps {
  data: RecapCardData;
  theme?: ThemeToken;
  shareLink?: string | null;
  labels: {
    share: string;
    shareWhatsApp: string;
    shareMore: string;
    downloadPng: string;
    copyImage: string;
    copyImageUnsupported: string;
    copyShareLink: string;
    copied: string;
    downloaded: string;
    shared: string;
    error: string;
  };
  shareSummaryLabel?: string;
}

/** Hidden recap card + single Share button that opens ShareMenu. */
export function ShareRecapWithMenu({
  data,
  theme,
  shareLink,
  labels,
  shareSummaryLabel = "Share summary",
}: ShareRecapWithMenuProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { data: planInfo } = usePlan();
  const showWatermark = planInfo?.features.watermarkExports ?? true;

  if (!ENABLE_SHARING) return null;

  return (
    <>
      <div
        ref={cardRef}
        className="absolute -left-[9999px] -top-[9999px] w-[400px]"
        aria-hidden
      >
        <EventRecapCard data={data} theme={theme} exportMode showWatermark={showWatermark} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{shareSummaryLabel}</span>
        <ShareMenu
          targetRef={cardRef}
          scopeLabel="Summary"
          shareText={buildSummaryShareText(data)}
          filename="splanno-recap-card.png"
          shareLink={shareLink}
          variant="primary"
          labels={labels}
        />
      </div>
    </>
  );
}
