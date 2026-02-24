"use client";

import { useEffect, useState } from "react";

const PARTICLES = 40;
const COLORS = ["#fbbf24", "#f59e0b", "#22c55e", "#3b82f6", "#ec4899", "#a855f7"];
const EMOJIS = ["✨", "🎉", "❤️", "💚", "💙"];

export function ConfettiCelebration({ onComplete }: { onComplete?: () => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, 2500);
    return () => clearTimeout(t);
  }, [onComplete]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {Array.from({ length: PARTICLES }).map((_, i) => (
        <div
          key={i}
          className="absolute animate-demo-confetti"
          style={{
            left: `${Math.random() * 100}%`,
            top: -20,
            animationDelay: `${Math.random() * 0.5}s`,
            animationDuration: `${2 + Math.random() * 1}s`,
          }}
        >
          <span
            className="text-xl opacity-90"
            style={{
              color: COLORS[i % COLORS.length],
              transform: `rotate(${Math.random() * 360}deg)`,
            }}
          >
            {EMOJIS[i % EMOJIS.length]}
          </span>
        </div>
      ))}
    </div>
  );
}
