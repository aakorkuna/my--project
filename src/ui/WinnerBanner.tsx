"use client";

import React from "react";
import Link from "next/link";

const PLAYER_COLORS = [
  "#ffffff", // white
  "#ef4444", // red
  "#22c55e", // green
  "#2b6cff", // blue
  "#eab308", // yellow
] as const;

const PLAYER_COLOR_NAMES = ["WHITE", "RED", "GREEN", "BLUE", "YELLOW"] as const;

function clampPlayerIndex(i: number): number {
  if (!Number.isFinite(i)) return 0;
  return Math.max(0, Math.min(PLAYER_COLORS.length - 1, Math.floor(i)));
}

export function WinnerBanner(props: { visible: boolean; winners: number[]; score: number }) {
  if (!props.visible) return null;

  const [done, setDone] = React.useState(false);

  const winners = Array.isArray(props.winners) && props.winners.length > 0 ? props.winners : [0];
  const winner0 = clampPlayerIndex(winners[0] ?? 0);
  const winner1 = clampPlayerIndex(winners[1] ?? 0);
  const isDraw = winners.length > 1;

  const color0 = PLAYER_COLORS[winner0] ?? "#ffffff";
  const color1 = PLAYER_COLORS[winner1] ?? "#ffffff";

  const colorName0 = PLAYER_COLOR_NAMES[winner0] ?? "WHITE";

  // Key forces CSS animation to restart when winner changes.
  const key = `winner-${winners.join("-")}-${props.score}`;

  React.useEffect(() => {
    if (!props.visible) {
      setDone(false);
      return;
    }
    setDone(false);
  }, [props.visible, key]);

  return (
    <div className="fixed inset-0 z-30 pointer-events-none">
      <div className="absolute left-0 right-0 top-[40%] overflow-hidden">
        <div
          key={key}
          className="winner-slide whitespace-nowrap px-6 text-[clamp(96px,14vw,280px)] font-black font-sans tracking-[0.03em] leading-none uppercase"
          style={
            isDraw && winners.length === 2
              ? {
                  backgroundImage: `linear-gradient(90deg, ${color0}, ${color1})`,
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                  filter: "brightness(0.65) saturate(0.95)",
                }
              : isDraw
                ? { color: "#ffffff", filter: "brightness(0.65) saturate(0.95)" }
                : { color: color0, filter: "brightness(0.65) saturate(0.95)" }
          }
          onAnimationEnd={() => setDone(true)}
        >
          {isDraw ? "DRAW" : `WINNER PLAYER ${winner0 + 1} ${colorName0} ${props.score}`}
        </div>
      </div>

      {done && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto">
            <Link
              href="/"
              className="text-center rounded-2xl border border-foreground/20 bg-background/70 backdrop-blur px-10 py-5 text-xl font-bold"
            >
              Back
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
