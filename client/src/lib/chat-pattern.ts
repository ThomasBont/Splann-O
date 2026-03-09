import type { CSSProperties } from "react";

export function getChatPatternStyle(_input?: { eventType?: string | null; templateData?: unknown }): CSSProperties {
  return {
    backgroundImage: "none",
    backgroundColor: "white",
  };
}
