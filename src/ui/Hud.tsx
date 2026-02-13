"use client";

import React from "react";
import { MeepleIndicator } from "./MeepleIndicator";

const PLAYER_COLORS = [
  "#ffffff", // white
  "#ef4444", // red
  "#22c55e", // green
  "#2b6cff", // blue (existing)
  "#eab308", // yellow
] as const;

function colorForPlayer(playerIndex: number): string {
  return PLAYER_COLORS[Math.max(0, Math.min(PLAYER_COLORS.length - 1, playerIndex))] ?? "#2b6cff";
}

export function Hud(props: {
  // Solo fields
  score?: number;
  meeplesRemaining?: number;

  // Multiplayer fields
  playerCount?: number;
  currentPlayer?: number;
  scores?: number[];
  meeplesRemainingByPlayer?: number[];
}) {
  const playerCount = Math.max(1, props.playerCount ?? 1);
  const currentPlayer = Math.max(0, props.currentPlayer ?? 0);
  const isMulti = playerCount > 1;

  const scores =
    props.scores && props.scores.length === playerCount
      ? props.scores
      : Array.from({ length: playerCount }, (_, i) => (i === 0 ? props.score ?? 0 : 0));

  const meeplesRemainingByPlayer =
    props.meeplesRemainingByPlayer && props.meeplesRemainingByPlayer.length === playerCount
      ? props.meeplesRemainingByPlayer
      : Array.from({ length: playerCount }, (_, i) => (i === 0 ? props.meeplesRemaining ?? 0 : 0));

  const playerLabel = (pi: number) => `Гравець ${pi + 1}/${playerCount}`;

  return (
    <div className="fixed top-3 right-3 z-10 pointer-events-none">
      {!isMulti ? (
        <div className="flex flex-col gap-3 items-end">
          <div className="rounded-2xl border border-foreground/20 bg-background/70 backdrop-blur px-4 py-3 w-[200px]">
            <div className="text-xs opacity-75">Score</div>
            <div className="text-3xl font-bold leading-none tabular-nums">{props.score ?? 0}</div>
          </div>

          <div className="rounded-2xl border border-foreground/20 bg-background/70 backdrop-blur px-4 py-3">
            <div className="text-xs opacity-75">Дяпчики</div>
            <MeepleIndicator count={props.meeplesRemaining ?? 0} color={colorForPlayer(0)} className="mt-1" />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 items-end">
          {Array.from({ length: playerCount }).map((_, pi) => {
            const isActive = pi === currentPlayer;
            const c = colorForPlayer(pi);
            return (
              <div key={`p-${pi}`} className="flex flex-row gap-3 items-start">
                <div className="rounded-2xl border border-foreground/20 bg-background/70 backdrop-blur px-4 py-3 w-[200px]">
                  <div className="text-xs opacity-75">{`Score • ${playerLabel(pi)}`}</div>
                  <div className="text-3xl font-bold leading-none tabular-nums">{scores[pi] ?? 0}</div>
                </div>

                <div
                  className={
                    isActive
                      ? "rounded-2xl border bg-background/70 backdrop-blur px-4 py-3"
                      : "rounded-2xl border border-foreground/20 bg-background/70 backdrop-blur px-4 py-3"
                  }
                  style={isActive ? { borderColor: c } : undefined}
                >
                  <div className={isActive ? "text-xs" : "text-xs opacity-75"}>Дяпчики</div>
                  <MeepleIndicator count={meeplesRemainingByPlayer[pi] ?? 0} color={c} className="mt-1" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
