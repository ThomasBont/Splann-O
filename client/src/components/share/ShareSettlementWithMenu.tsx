"use client";

import { useRef } from "react";
import { SettleCard } from "./settle-card";
import { ShareMenu } from "./ShareMenu";
import { buildSettlementShareText } from "@/lib/shareImage";
import type { SettleCardData } from "@/utils/shareCard";
import type { ThemeToken } from "@/theme/eventThemes";

const ENABLE_SHARING = import.meta.env.VITE_ENABLE_SHARING !== "false";

export interface ShareSettlementWithMenuProps {
  data: SettleCardData;
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
  className?: string;
}

/** Hidden settle card + icon ShareMenu trigger. For use inside settlement card row. */
export function ShareSettlementWithMenu({
  data,
  theme,
  shareLink,
  labels,
  className,
}: ShareSettlementWithMenuProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const s = data.settlements[0];
  const shareText = s ? buildSettlementShareText(s, data.eventName) : "Settled with Splanno";

  if (!ENABLE_SHARING) return null;

  return (
    <>
      <div
        ref={cardRef}
        className="absolute -left-[9999px] -top-[9999px] w-[400px]"
        aria-hidden
      >
        <SettleCard data={data} theme={theme} exportMode />
      </div>
      <ShareMenu
        targetRef={cardRef}
        scopeLabel="Settlement"
        shareText={shareText}
        filename="splanno-settle-card.png"
        shareLink={shareLink}
        variant="icon"
        labels={labels}
        className={className}
      />
    </>
  );
}
