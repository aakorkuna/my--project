"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useGameStore } from "../../src/game/store/useGameStore";
import { BoardScene } from "../../src/scene/components/BoardScene";
import { Hud } from "../../src/ui/Hud";
import { WinnerBanner } from "../../src/ui/WinnerBanner";

export default function SoloPageClient() {
  const searchParams = useSearchParams();

  const initGame = useGameStore((s) => s.initGame);
  const initGameWithPlayers = useGameStore((s) => s.initGameWithPlayers);
  const loadGame = useGameStore((s) => s.loadGame);
  const loadGameFile = useGameStore((s) => s.loadGameFile);
  const saveGame = useGameStore((s) => s.saveGame);
  const saveGameFile = useGameStore((s) => s.saveGameFile);
  const rotateActive = useGameStore((s) => s.rotateActive);
  const endGameEarly = useGameStore((s) => s.endGameEarly);
  const active = useGameStore((s) => s.active);
  const deckLen = useGameStore((s) => s.deck.length);
  const meepleTarget = useGameStore((s) => s.meepleTarget);
  const cancelMeepleTarget = useGameStore((s) => s.cancelMeepleTarget);

  const score = useGameStore((s) => s.score);
  const meeplesRemaining = useGameStore((s) => s.meeplesRemaining);
  const playerCount = useGameStore((s) => s.playerCount);
  const currentPlayer = useGameStore((s) => s.currentPlayer);
  const scores = useGameStore((s) => s.scores);
  const meeplesRemainingByPlayer = useGameStore((s) => s.meeplesRemainingByPlayer);

  const isGameOver = deckLen === 0 && !active && !meepleTarget;
  const winners = React.useMemo(() => {
    const list = Array.isArray(scores) ? scores : [score ?? 0];
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < list.length; i++) {
      const v = typeof list[i] === "number" ? (list[i] as number) : 0;
      if (v > bestScore) bestScore = v;
    }
    const w: number[] = [];
    for (let i = 0; i < list.length; i++) {
      const v = typeof list[i] === "number" ? (list[i] as number) : 0;
      if (v === bestScore) w.push(i);
    }
    return w.length > 0 ? w : [0];
  }, [scores, score]);
  const winnerScore = React.useMemo(() => {
    const list = Array.isArray(scores) ? scores : [score ?? 0];
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < list.length; i++) {
      const v = typeof list[i] === "number" ? (list[i] as number) : 0;
      if (v > bestScore) bestScore = v;
    }
    return Number.isFinite(bestScore) ? bestScore : 0;
  }, [scores, score]);

  const [msg, setMsg] = React.useState<string>("—");
  const [isErr, setIsErr] = React.useState(false);

  const [saveModalOpen, setSaveModalOpen] = React.useState(false);
  const [saveName, setSaveName] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    const fileSaveId = searchParams.get("fileSave");
    if (fileSaveId) {
      const fileSaveModeParam = searchParams.get("fileSaveMode");
      const fileSaveMode = fileSaveModeParam === "multi" ? "multi" : "solo";
      (async () => {
        const res = await loadGameFile(fileSaveId, fileSaveMode);
        setIsErr(!res.ok);
        setMsg(res.ok ? "Сейв завантажено." : `Не вдалося завантажити сейв: ${res.reason}`);
      })();
      return;
    }

    const wantLoad = searchParams.get("load") === "1";
    if (wantLoad) {
      const res = loadGame();
      setIsErr(!res.ok);
      setMsg(res.ok ? "Сейв завантажено." : `Не вдалося завантажити сейв: ${res.reason}`);
      return;
    }

    const playersParam = searchParams.get("players");
    if (playersParam) {
      const n = Number(playersParam);
      const pc = Number.isFinite(n) ? Math.max(1, Math.min(5, Math.floor(n))) : 1;
      initGameWithPlayers(pc);
      setIsErr(false);
      setMsg(
        pc > 1
          ? `Мультиплеєр офлайн: ${pc} гравців. Став тайл, потім постав дяпчика або Next/Esc щоб пропустити.`
          : "Гра запущена. Став тайл, потім можеш поставити дяпчика або Esc щоб пропустити."
      );
      return;
    }

    initGame();
    setIsErr(false);
    setMsg("Гра запущена. Став тайл, потім можеш поставити дяпчика або Esc щоб пропустити.");
  }, [initGame, initGameWithPlayers, loadGame, loadGameFile, searchParams]);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      if (e.code === "KeyR") {
        if (!active) return;
        rotateActive();
        setIsErr(false);
        setMsg("Повернув активний тайл (+90°). (R)");
        return;
      }

      if (e.code === "Escape") {
        if (!meepleTarget) return;
        cancelMeepleTarget();
        setIsErr(false);
        setMsg("Дяпчика пропущено. (Esc)");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, rotateActive, meepleTarget, cancelMeepleTarget]);

  async function doSave(label: string) {
    const trimmed = label.trim();
    if (!trimmed) {
      setIsErr(true);
      setMsg("Назва сейва порожня.");
      return;
    }

    setSaving(true);
    const localRes = saveGame();
    const fileRes = await saveGameFile(trimmed);
    setSaving(false);

    if (localRes.ok && fileRes.ok) {
      setIsErr(false);
      setMsg("Збережено.");
      setSaveModalOpen(false);
      setSaveName("");
      return;
    }

    if (!localRes.ok) {
      setIsErr(true);
      setMsg(`Не вдалося зберегти: ${localRes.reason}`);
      return;
    }

    setIsErr(true);
    setMsg(`Локально збережено, але файл-сейв не записався: ${fileRes.reason}`);
  }

  return (
    <main className="h-screen flex flex-col p-3 overflow-hidden">
      <WinnerBanner visible={isGameOver} winners={winners} score={winnerScore} />

      <Hud
        score={score}
        meeplesRemaining={meeplesRemaining}
        playerCount={playerCount}
        currentPlayer={currentPlayer}
        scores={scores}
        meeplesRemainingByPlayer={meeplesRemainingByPlayer}
      />

      <div className="flex-1 min-h-0 h-full">
        <div className="h-full w-full rounded-2xl border border-foreground/20 overflow-hidden relative">
          <div className="absolute top-0 left-0 z-10">
            <div className="pointer-events-auto flex">
              <Link
                href="/"
                className="carc-btn bg-background/70 backdrop-blur px-6 py-4 text-sm font-semibold rounded-tl-2xl border-b border-r border-foreground/20"
              >
                Back
              </Link>

              <button
                type="button"
                onClick={() => {
                  setSaveName("");
                  setSaveModalOpen(true);
                }}
                className="bg-background/70 backdrop-blur px-6 py-4 text-sm font-semibold border-b border-r border-foreground/20"
              >
                Save
              </button>

              <button
                type="button"
                onClick={() => {
                  endGameEarly();
                  setIsErr(false);
                  setMsg("Гру завершено.");
                }}
                className="bg-background/70 backdrop-blur px-6 py-4 text-sm font-semibold border-b border-r border-foreground/20"
              >
                End Game
              </button>

              {playerCount > 1 && meepleTarget && (
                <button
                  type="button"
                  onClick={() => {
                    cancelMeepleTarget();
                    setIsErr(false);
                    setMsg("Дяпчика пропущено. Наступний гравець.");
                  }}
                  className="bg-background/70 backdrop-blur px-6 py-4 text-sm font-semibold border-b border-r border-foreground/20"
                >
                  Next
                </button>
              )}
            </div>
          </div>

          <BoardScene
            onMessage={(m, err) => {
              setMsg(m);
              setIsErr(Boolean(err));
            }}
          />
        </div>
      </div>

      <div className="fixed left-3 bottom-3 z-10 pointer-events-none">
        <div className="rounded-2xl border border-foreground/20 bg-background/70 backdrop-blur px-4 py-2 text-sm">
          <span className={isErr ? "text-red-400" : "opacity-90"}>{msg}</span>
        </div>
      </div>

      {saveModalOpen && (
        <div className="fixed inset-0 z-20 flex items-center justify-center p-3">
          <div className="absolute inset-0 bg-foreground/30" />

          <div className="relative w-full max-w-md rounded-3xl border border-foreground/20 bg-background/80 backdrop-blur px-6 py-6 pointer-events-auto">
            <div className="text-lg font-semibold">Зберегти гру</div>
            <div className="text-sm opacity-80 mt-1">Введи назву сейва</div>

            <form
              className="mt-4 grid gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                if (saving) return;
                await doSave(saveName);
              }}
            >
              <input
                autoFocus
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Наприклад: Хід 12"
                className="w-full rounded-2xl border border-foreground/20 bg-background/60 px-4 py-3 text-base font-medium outline-none"
              />

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setSaveModalOpen(false);
                    setSaveName("");
                  }}
                  className="text-center rounded-2xl border border-foreground/20 bg-background/60 px-4 py-3 text-base font-semibold"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className={
                    saving
                      ? "rounded-2xl border border-foreground/15 bg-background/40 px-4 py-3 text-base font-semibold opacity-50 cursor-not-allowed"
                      : "text-center rounded-2xl border border-foreground/20 bg-background/60 px-4 py-3 text-base font-semibold"
                  }
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
