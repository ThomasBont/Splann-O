import type { CSSProperties } from "react";
import { inferPlanMainTypeFromEventType, inferPlanSubcategoryFromEventType } from "@shared/lib/plan-types";

type ChatPatternVariant = "travel" | "food" | "birthday" | "party" | "generic";

function svgDataUri(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function buildPatternSvg(variant: ChatPatternVariant): string {
  const stroke = "rgba(15,23,42,0.135)";
  const fill = "rgba(15,23,42,0.065)";
  const muted = "rgba(15,23,42,0.085)";

  const iconGroup = {
    travel: `
      <g transform="translate(26 24)">
        <path d="M0 8 L12 5 L21 0 L23 2 L16 8 L23 14 L21 16 L12 11 L0 8 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.25" stroke-linejoin="round"/>
      </g>
      <g transform="translate(142 36)">
        <rect x="0" y="2" width="18" height="14" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="1.25"/>
        <path d="M5 2 V-1 H13 V2" fill="none" stroke="${stroke}" stroke-width="1.25" stroke-linecap="round"/>
      </g>
      <g transform="translate(90 126)">
        <path d="M10 0 C15 0 18 4 18 8 C18 14 10 20 10 20 C10 20 2 14 2 8 C2 4 5 0 10 0 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.25"/>
        <circle cx="10" cy="8" r="3" fill="none" stroke="${stroke}" stroke-width="1.25"/>
      </g>
      <g transform="translate(186 144)">
        <circle cx="8" cy="8" r="8" fill="none" stroke="${muted}" stroke-width="1.25"/>
        <path d="M8 0 V16 M0 8 H16" stroke="${muted}" stroke-width="1" stroke-linecap="round"/>
      </g>
      <g transform="translate(34 164)">
        <path d="M0 12 C2 4 6 0 12 0 C18 0 22 4 24 12" fill="none" stroke="${muted}" stroke-width="1.15" stroke-linecap="round"/>
        <circle cx="12" cy="12" r="3" fill="${fill}" stroke="${muted}" stroke-width="1"/>
      </g>
    `,
    food: `
      <g transform="translate(24 26)">
        <circle cx="12" cy="12" r="10" fill="none" stroke="${stroke}" stroke-width="1.25"/>
        <circle cx="12" cy="12" r="5" fill="none" stroke="${muted}" stroke-width="1.1"/>
      </g>
      <g transform="translate(148 24)">
        <path d="M2 0 V18 M6 0 V7 M10 0 V7 M14 0 V7 M6 7 V18" fill="none" stroke="${stroke}" stroke-width="1.25" stroke-linecap="round"/>
      </g>
      <g transform="translate(84 126)">
        <path d="M9 0 C15 5 14 10 9 18 C4 11 3 5 9 0 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.25"/>
      </g>
      <g transform="translate(192 142)">
        <path d="M0 4 H18" stroke="${muted}" stroke-width="1.25" stroke-linecap="round"/>
        <path d="M4 0 C7 3 11 3 14 0" fill="none" stroke="${muted}" stroke-width="1.25" stroke-linecap="round"/>
      </g>
      <g transform="translate(34 154)">
        <path d="M0 10 C0 4 4 0 10 0 C16 0 20 4 20 10 C20 16 10 20 10 20 C10 20 0 16 0 10 Z" fill="${fill}" stroke="${muted}" stroke-width="1.1"/>
      </g>
    `,
    birthday: `
      <g transform="translate(26 22)">
        <path d="M2 16 H22 V22 H2 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.25"/>
        <path d="M5 11 H19 V16 H5 Z" fill="none" stroke="${stroke}" stroke-width="1.25"/>
        <path d="M12 0 V8" stroke="${stroke}" stroke-width="1.25" stroke-linecap="round"/>
        <path d="M12 0 C10 3 10 5 12 8 C14 5 14 3 12 0 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.1"/>
      </g>
      <g transform="translate(144 28)">
        <path d="M8 20 C8 20 0 13 0 8 C0 3 3 0 8 0 C13 0 16 3 16 8 C16 13 8 20 8 20 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.25"/>
        <path d="M8 20 V28" stroke="${muted}" stroke-width="1.1" stroke-linecap="round"/>
      </g>
      <g transform="translate(92 130)">
        <path d="M10 0 L12.5 7.5 L20 10 L12.5 12.5 L10 20 L7.5 12.5 L0 10 L7.5 7.5 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.1" stroke-linejoin="round"/>
      </g>
      <g transform="translate(188 146)">
        <path d="M0 6 C4 0 8 0 12 6 C16 12 20 12 24 6" fill="none" stroke="${muted}" stroke-width="1.25" stroke-linecap="round"/>
      </g>
      <g transform="translate(34 152)">
        <path d="M8 20 C8 20 0 13 0 8 C0 3 3 0 8 0 C13 0 16 3 16 8 C16 13 8 20 8 20 Z" fill="${fill}" stroke="${muted}" stroke-width="1.1"/>
      </g>
    `,
    party: `
      <g transform="translate(24 24)">
        <path d="M14 2 V14 C14 18 10 20 7 18 C4 16 5 11 9 11 C10 11 12 12 14 13 V5 L22 3 V13 C22 17 18 19 15 17 C12 15 13 10 17 10 C18 10 20 11 22 12" fill="none" stroke="${stroke}" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
      <g transform="translate(148 28)">
        <path d="M0 6 L6 6 L9 0 L12 6 L18 6 L13 10 L15 16 L9 12 L3 16 L5 10 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.15" stroke-linejoin="round"/>
      </g>
      <g transform="translate(88 126)">
        <path d="M0 4 L18 0 V12 L0 16 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.25" stroke-linejoin="round"/>
        <path d="M4 6 L8 5 M4 10 L8 9" stroke="${muted}" stroke-width="1.1" stroke-linecap="round"/>
      </g>
      <g transform="translate(188 144)">
        <circle cx="8" cy="8" r="7" fill="none" stroke="${muted}" stroke-width="1.15"/>
        <path d="M8 1 V15 M1 8 H15" stroke="${muted}" stroke-width="1" stroke-linecap="round"/>
      </g>
      <g transform="translate(34 156)">
        <path d="M0 4 L16 0 V10 L0 14 Z" fill="${fill}" stroke="${muted}" stroke-width="1.1" stroke-linejoin="round"/>
        <path d="M4 5 L10 4" stroke="${muted}" stroke-width="1" stroke-linecap="round"/>
      </g>
    `,
    generic: `
      <g transform="translate(28 28)">
        <circle cx="6" cy="6" r="3" fill="${fill}" stroke="${muted}" stroke-width="1"/>
        <circle cx="18" cy="12" r="2.5" fill="${fill}" stroke="${muted}" stroke-width="1"/>
      </g>
      <g transform="translate(148 34)">
        <path d="M0 8 C4 2 10 2 14 8 C18 14 24 14 28 8" fill="none" stroke="${stroke}" stroke-width="1.15" stroke-linecap="round"/>
      </g>
      <g transform="translate(92 134)">
        <path d="M0 2 L16 2" stroke="${muted}" stroke-width="1.15" stroke-linecap="round"/>
        <path d="M8 0 L8 12" stroke="${muted}" stroke-width="1.15" stroke-linecap="round"/>
      </g>
      <g transform="translate(194 146)">
        <circle cx="5" cy="5" r="2.5" fill="${fill}" stroke="${muted}" stroke-width="1"/>
      </g>
      <g transform="translate(34 158)">
        <path d="M0 4 C4 0 8 0 12 4" fill="none" stroke="${muted}" stroke-width="1.1" stroke-linecap="round"/>
        <path d="M12 4 C16 8 20 8 24 4" fill="none" stroke="${muted}" stroke-width="1.1" stroke-linecap="round"/>
      </g>
    `,
  }[variant];

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240" fill="none">
      <rect width="240" height="240" fill="transparent"/>
      ${iconGroup}
    </svg>
  `.trim();
}

export function getChatPatternVariant(eventType?: string | null): ChatPatternVariant {
  const subcategory = inferPlanSubcategoryFromEventType(eventType);
  if (subcategory) {
    switch (subcategory) {
      case "backpacking":
      case "city_trip":
      case "workation":
      case "road_trip":
      case "beach_getaway":
      case "ski_trip":
      case "weekend_escape":
      case "festival_trip":
        return "travel";
      case "barbecue":
      case "dinner":
      case "brunch":
        return "food";
      case "birthday":
        return "birthday";
      case "cinema":
      case "game_night":
      case "house_party":
      case "drinks_night":
        return "party";
      default:
        break;
    }
  }

  const mainType = inferPlanMainTypeFromEventType(eventType);
  if (mainType === "trip") return "travel";
  if (mainType === "party") return "party";
  return "generic";
}

export function getChatPatternStyle(eventType?: string | null): CSSProperties {
  const variant = getChatPatternVariant(eventType);
  return {
    backgroundImage: svgDataUri(buildPatternSvg(variant)),
    backgroundRepeat: "repeat",
    backgroundSize: "184px 184px",
    backgroundPosition: "0 0",
  };
}
