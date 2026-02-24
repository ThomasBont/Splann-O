"use client";

import * as React from "react";
import { useEventTheme } from "./ThemeProvider";

/**
 * Minimal, tasteful signature effect overlay for event header.
 * One effect per theme; respects prefers-reduced-motion.
 */
export function SignatureEffect() {
  const { signature, accent } = useEventTheme();
  const reducedMotion = React.useMemo(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  if (reducedMotion) return null;

  const opacity = Math.min(0.5, signature.intensity);
  const common = "pointer-events-none absolute inset-0 overflow-hidden rounded-[var(--radius-lg)]";

  switch (signature.type) {
    case "heatGlow":
      return (
        <div
          data-signature-effect="heatGlow"
          className={common}
          style={{ opacity }}
          aria-hidden
        >
          <div
            className="absolute inset-0 bg-gradient-to-br from-orange-500/20 via-amber-500/10 to-transparent animate-[shimmer_8s_ease-in-out_infinite]"
            style={{
              animation: "signature-shimmer 8s ease-in-out infinite",
            }}
          />
        </div>
      );
    case "neonHalo":
      return (
        <div
          data-signature-effect="neonHalo"
          className={`${common}`}
          style={{ opacity }}
          aria-hidden
        >
          <div
            className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-purple-500/30 blur-2xl animate-[pulse_3s_ease-in-out_infinite]"
            style={{ animation: "signature-pulse 3s ease-in-out infinite" }}
          />
        </div>
      );
    case "cinematic":
      return (
        <div
          data-signature-effect="cinematic"
          className={`${common}`}
          style={{ opacity: opacity * 0.8 }}
          aria-hidden
        >
          <div
            className="absolute inset-0 bg-gradient-to-t from-black/5 via-transparent to-transparent"
            style={{ mixBlendMode: "multiply" }}
          />
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            }}
          />
        </div>
      );
    case "caustics":
      return (
        <div
          data-signature-effect="caustics"
          className={`${common}`}
          style={{ opacity }}
          aria-hidden
        >
          <div
            className="absolute inset-0 bg-gradient-to-tr from-cyan-500/15 via-transparent to-teal-500/10"
            style={{
              animation: "signature-caustics 12s ease-in-out infinite",
              backgroundSize: "200% 200%",
            }}
          />
        </div>
      );
    case "mapMotion":
      return (
        <div
          data-signature-effect="mapMotion"
          className={`${common}`}
          style={{ opacity }}
          aria-hidden
        >
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: `repeating-linear-gradient(
                45deg,
                transparent,
                transparent 2px,
                hsl(var(--theme-primary) / 0.1) 2px,
                hsl(var(--theme-primary) / 0.1) 4px
              )`,
              animation: "signature-map-motion 20s linear infinite",
            }}
          />
        </div>
      );
    case "strobe":
      return (
        <div
          data-signature-effect="strobe"
          className={`${common}`}
          style={{ opacity: opacity * 0.5 }}
          aria-hidden
        >
          <div
            className="absolute inset-0 bg-gradient-to-r from-fuchsia-500/10 to-transparent animate-[pulse_2s_ease-in-out_infinite]"
            style={{ animation: "signature-pulse 2s ease-in-out infinite" }}
          />
        </div>
      );
    case "pulse":
      return (
        <div
          data-signature-effect="pulse"
          className={`${common}`}
          style={{ opacity }}
          aria-hidden
        >
          <div
            className="absolute right-0 top-0 w-20 h-20 rounded-full blur-xl animate-[pulse_2.5s_ease-in-out_infinite]"
            style={{
              backgroundColor: `hsl(var(--theme-primary) / 0.3)`,
              animation: "signature-pulse 2.5s ease-in-out infinite",
            }}
          />
        </div>
      );
    case "shimmer":
      return (
        <div
          data-signature-effect="shimmer"
          className={`${common}`}
          style={{ opacity }}
          aria-hidden
        >
          <div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
            style={{
              animation: "signature-shimmer 6s ease-in-out infinite",
              transform: "translateX(-100%)",
            }}
          />
        </div>
      );
    case "glow":
    default:
      return (
        <div
          data-signature-effect="glow"
          className={`${common}`}
          style={{ opacity: opacity * 0.6 }}
          aria-hidden
        >
          <div
            className="absolute -right-8 -top-8 w-32 h-32 rounded-full blur-3xl"
            style={{ backgroundColor: `hsl(var(--theme-primary) / 0.2)` }}
          />
        </div>
      );
  }
}
