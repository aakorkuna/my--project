"use client";

import React from "react";
import Link from "next/link";

import { getSocket } from "../../src/net/socket";
import { useGameStore } from "../../src/game/store/useGameStore";
import { BoardScene } from "../../src/scene/components/BoardScene";
import { Hud } from "../../src/ui/Hud";
import { WinnerBanner } from "../../src/ui/WinnerBanner";

type CreateRoomAck =
  | {
      ok: true;
      roomCode: string;
      playerIndex: number;
      playerCount: number;
      isHost: boolean;
      started: boolean;
      roster?: RoomRoster | null;
      state?: unknown;
    }
  | { ok: false; reason: string };

type JoinRoomAck =
  | {
      ok: true;
      roomCode: string;
      playerIndex: number;
      playerCount: number;
      isHost: boolean;
      started: boolean;
      roster?: RoomRoster;
      state?: unknown;
    }
  | { ok: false; reason: string };

type LobbyItem = { roomCode: string; playerCount: number; connected: number; openSeats: number };
type RoomRoster = { roomCode: string; playerCount: number; connected: number; indices: number[]; started: boolean };

type ForwardedAction = { type: "rotate" } | { type: "place"; x: number; y: number } | { type: "skipMeeple" } | { type: "placeMeeple"; x: number; y: number; feature: unknown };

function snapshotFromStore() {
  const s = useGameStore.getState();
  return {
    board: s.board,
    deck: s.deck,
    active: s.active,
    score: s.score,
    playerCount: s.playerCount,
    currentPlayer: s.currentPlayer,
    scores: s.scores,
    meeplesRemaining: s.meeplesRemaining,
    meeplesRemainingByPlayer: s.meeplesRemainingByPlayer,
    meeples: s.meeples,
    meepleTarget: s.meepleTarget,
  };
}

export default function OnlinePage() {
  const initGameWithPlayers = useGameStore((s) => s.initGameWithPlayers);
  const rotateActiveLocal = useGameStore((s) => s.rotateActive);
  const tryPlaceLocal = useGameStore((s) => s.tryPlace);
  const placeMeepleLocal = useGameStore((s) => s.placeMeeple);
  const cancelMeepleTargetLocal = useGameStore((s) => s.cancelMeepleTarget);
  const endGameEarlyLocal = useGameStore((s) => s.endGameEarly);
  const applyRemoteState = useGameStore((s) => s.applyRemoteState);

  const score = useGameStore((s) => s.score);
  const meeplesRemaining = useGameStore((s) => s.meeplesRemaining);
  const playerCount = useGameStore((s) => s.playerCount);
  const currentPlayer = useGameStore((s) => s.currentPlayer);
  const scores = useGameStore((s) => s.scores);
  const meeplesRemainingByPlayer = useGameStore((s) => s.meeplesRemainingByPlayer);
  const meepleTarget = useGameStore((s) => s.meepleTarget);
  const deckLen = useGameStore((s) => s.deck.length);
  const active = useGameStore((s) => s.active);

  const [msg, setMsg] = React.useState<string>("—");
  const [isErr, setIsErr] = React.useState(false);

  const [roomCode, setRoomCode] = React.useState<string | null>(null);
  const [playerIndex, setPlayerIndex] = React.useState<number | null>(null);
  const [roomPlayerCount, setRoomPlayerCount] = React.useState<number | null>(null);
  const [isHost, setIsHost] = React.useState(false);
  const [started, setStarted] = React.useState(false);

  const isGameOver = started && deckLen === 0 && !active && !meepleTarget;
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

  const [createPlayersModalOpen, setCreatePlayersModalOpen] = React.useState(false);
  const [createPlayersCount, setCreatePlayersCount] = React.useState("2");
  const [createErr, setCreateErr] = React.useState<string | null>(null);

  const [joinCode, setJoinCode] = React.useState("");
  const [joinErr, setJoinErr] = React.useState<string | null>(null);

  const [lobbies, setLobbies] = React.useState<LobbyItem[]>([]);
  const [roster, setRoster] = React.useState<RoomRoster | null>(null);

  const socketRef = React.useRef<ReturnType<typeof getSocket> | null>(null);

  React.useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    socket.emit("lobbies:list", {}, (ack: { ok: boolean; lobbies?: LobbyItem[] }) => {
      if (ack?.ok && Array.isArray(ack.lobbies)) setLobbies(ack.lobbies);
    });

    const onState = (payload: { state: unknown }) => {
      if (!payload || typeof payload !== "object") return;
      const st = (payload as { state?: unknown }).state;
      if (!st || typeof st !== "object") return;
      applyRemoteState(st as any);
    };

    const onStarted = () => {
      setStarted(true);
      setIsErr(false);
      setMsg("Кімната запущена.");
    };

    const onClosed = (payload: { reason?: string }) => {
      setIsErr(true);
      setMsg(`Кімнату закрито: ${payload?.reason ?? "невідомо"}`);
      setRoomCode(null);
      setPlayerIndex(null);
      setRoomPlayerCount(null);
      setIsHost(false);
      setStarted(false);
    };

    const onLobbies = (payload: { lobbies?: LobbyItem[] }) => {
      const list = payload?.lobbies;
      if (Array.isArray(list)) setLobbies(list);
    };

    const onForwardedAction = (payload: { fromPlayerIndex: number; action: ForwardedAction }) => {
      if (!isHost) return;
      const a = payload?.action;
      const from = payload?.fromPlayerIndex;
      const s = useGameStore.getState();
      if (typeof from !== "number" || from !== s.currentPlayer) return;

      if (!a || typeof a !== "object" || typeof a.type !== "string") return;

      if (a.type === "rotate") {
        rotateActiveLocal();
      } else if (a.type === "place") {
        tryPlaceLocal(a.x, a.y);
      } else if (a.type === "skipMeeple") {
        cancelMeepleTargetLocal();
      } else if (a.type === "placeMeeple") {
        placeMeepleLocal(a.x, a.y, a.feature as any);
      }

      socket.emit("room:state", { roomCode: roomCode, state: snapshotFromStore() });
    };

    const onRoster = (payload: RoomRoster) => {
      if (!payload || typeof payload !== "object") return;
      // Server emits roster only to sockets in the room, so we can accept it without filtering.
      setRoster(payload);
    };

    socket.on("room:state", onState);
    socket.on("room:started", onStarted);
    socket.on("room:closed", onClosed);
    socket.on("room:action", onForwardedAction);
    socket.on("lobbies:update", onLobbies);
    socket.on("room:roster", onRoster);

    return () => {
      socket.off("room:state", onState);
      socket.off("room:started", onStarted);
      socket.off("room:closed", onClosed);
      socket.off("room:action", onForwardedAction);
      socket.off("lobbies:update", onLobbies);
      socket.off("room:roster", onRoster);
    };
  }, [applyRemoteState, cancelMeepleTargetLocal, isHost, placeMeepleLocal, roomCode, rotateActiveLocal, tryPlaceLocal]);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (!roomCode || !started) return;

      if (e.code === "KeyR") {
        if (!isMyTurn()) {
          setIsErr(true);
          setMsg("Зараз не твій хід.");
          return;
        }
        sendAction({ type: "rotate" });
        setIsErr(false);
        setMsg("Повернув активний тайл (+90°). (R)");
        return;
      }

      if (e.code === "Escape") {
        if (!meepleTarget) return;
        if (!isMyTurn()) {
          setIsErr(true);
          setMsg("Зараз не твій хід.");
          return;
        }
        sendAction({ type: "skipMeeple" });
        setIsErr(false);
        setMsg("Дяпчика пропущено. (Esc)");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [meepleTarget, roomCode, started, playerIndex, currentPlayer]);

  function requireRoom(): { socket: ReturnType<typeof getSocket>; code: string; idx: number; isHost: boolean } | null {
    const socket = socketRef.current;
    if (!socket) return null;
    if (!roomCode || playerIndex === null) return null;
    return { socket, code: roomCode, idx: playerIndex, isHost };
  }

  function isMyTurn() {
    if (playerIndex === null) return false;
    return currentPlayer === playerIndex;
  }

  function sendAction(action: ForwardedAction) {
    const r = requireRoom();
    if (!r) return;
    if (r.isHost) {
      // Host applies locally immediately
      if (action.type === "rotate") rotateActiveLocal();
      if (action.type === "place") tryPlaceLocal(action.x, action.y);
      if (action.type === "skipMeeple") cancelMeepleTargetLocal();
      if (action.type === "placeMeeple") placeMeepleLocal(action.x, action.y, action.feature as any);

      r.socket.emit("room:state", { roomCode: r.code, state: snapshotFromStore() });
      return;
    }

    r.socket.emit("room:action", { roomCode: r.code, action }, (ack: { ok: boolean; reason?: string }) => {
      if (!ack?.ok) {
        setIsErr(true);
        setMsg(`Не вдалося відправити дію: ${ack?.reason ?? "невідомо"}`);
      }
    });
  }

  async function createRoom(playerCount: number) {
    const socket = socketRef.current ?? getSocket();
    socketRef.current = socket;

    setJoinErr(null);
    setCreateErr(null);

    socket.emit("room:create", { playerCount }, (ack: CreateRoomAck) => {
      if (!ack || !ack.ok) {
        setCreateErr((ack as any)?.reason ?? "Не вдалося створити кімнату");
        return;
      }

      setRoomCode(ack.roomCode);
      setPlayerIndex(ack.playerIndex);
      setRoomPlayerCount(ack.playerCount);
      setIsHost(true);
      setStarted(false);
      setRoster(ack.roster ?? null);

      setIsErr(false);
      setMsg(`Кімната створена: ${ack.roomCode}`);
    });
  }

  async function joinRoom(code: string) {
    const socket = socketRef.current ?? getSocket();
    socketRef.current = socket;

    setJoinErr(null);
    setCreateErr(null);

    socket.emit("room:join", { roomCode: code }, (ack: JoinRoomAck) => {
      if (!ack || !ack.ok) {
        setJoinErr((ack as any)?.reason ?? "Не вдалося підключитись");
        return;
      }

      setRoomCode(ack.roomCode);
      setPlayerIndex(ack.playerIndex);
      setRoomPlayerCount(ack.playerCount);
      setIsHost(false);
      setStarted(Boolean(ack.started));
      setRoster(ack.roster ?? null);

      if (ack.started && ack.state && typeof ack.state === "object") {
        applyRemoteState(ack.state as any);
      }

      setIsErr(false);
      setMsg(`Підключився до кімнати: ${ack.roomCode}`);
    });
  }

  function startGame() {
    const r = requireRoom();
    if (!r || !r.isHost) return;
    const pc = roomPlayerCount ?? 2;

    initGameWithPlayers(pc);
    const { socket } = r;

    socket.emit("room:start", { roomCode: r.code }, (ack: { ok: boolean; reason?: string }) => {
      if (!ack?.ok) {
        setIsErr(true);
        setMsg(`Не вдалося запустити кімнату: ${ack?.reason ?? "невідомо"}`);
        return;
      }

      setStarted(true);
      socket.emit("room:state", { roomCode: r.code, state: snapshotFromStore() });

      setIsErr(false);
      setMsg("Гру запущено.");
    });
  }

  return (
    <main className="h-screen flex flex-col p-3 overflow-hidden">
      <WinnerBanner visible={isGameOver} winners={winners} score={winnerScore} />

      {started && (
        <Hud
          score={score}
          meeplesRemaining={meeplesRemaining}
          playerCount={playerCount}
          currentPlayer={currentPlayer}
          scores={scores}
          meeplesRemainingByPlayer={meeplesRemainingByPlayer}
        />
      )}

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

              {roomCode ? (
                <div className="bg-background/70 backdrop-blur px-6 py-4 text-sm font-semibold border-b border-r border-foreground/20">
                  Room: <span className="tabular-nums">{roomCode}</span> • You: {playerIndex !== null ? playerIndex + 1 : "?"}
                </div>
              ) : (
                <div className="bg-background/70 backdrop-blur px-6 py-4 text-sm font-semibold border-b border-r border-foreground/20">
                  Online (LAN)
                </div>
              )}

              {roomCode && isHost && !started && (
                <button
                  type="button"
                  onClick={startGame}
                  className="bg-background/70 backdrop-blur px-6 py-4 text-sm font-semibold border-b border-r border-foreground/20"
                >
                  Start
                </button>
              )}

              {roomCode && started && (
                <button
                  type="button"
                  onClick={() => {
                    if (!isMyTurn()) {
                      setIsErr(true);
                      setMsg("Зараз не твій хід.");
                      return;
                    }
                    sendAction({ type: "rotate" });
                    setIsErr(false);
                    setMsg("Повернув активний тайл (+90°). (R)");
                  }}
                  className="bg-background/70 backdrop-blur px-6 py-4 text-sm font-semibold border-b border-r border-foreground/20"
                >
                  Rotate
                </button>
              )}

              {roomCode && started && playerCount > 1 && meepleTarget && (
                <button
                  type="button"
                  onClick={() => {
                    if (!isMyTurn()) {
                      setIsErr(true);
                      setMsg("Зараз не твій хід.");
                      return;
                    }
                    sendAction({ type: "skipMeeple" });
                    setIsErr(false);
                    setMsg("Дяпчика пропущено. Наступний гравець.");
                  }}
                  className="bg-background/70 backdrop-blur px-6 py-4 text-sm font-semibold border-b border-r border-foreground/20"
                >
                  Next
                </button>
              )}

              {roomCode && started && isHost && (
                <button
                  type="button"
                  onClick={() => {
                    const r = requireRoom();
                    if (!r || !r.isHost) return;

                    endGameEarlyLocal();
                    r.socket.emit("room:state", { roomCode: r.code, state: snapshotFromStore() });

                    setIsErr(false);
                    setMsg("Гру завершено.");
                  }}
                  className="bg-background/70 backdrop-blur px-6 py-4 text-sm font-semibold border-b border-r border-foreground/20"
                >
                  End Game
                </button>
              )}
            </div>
          </div>

          {!roomCode ? (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="pointer-events-auto w-full max-w-md rounded-3xl border border-foreground/20 bg-background/70 backdrop-blur px-6 py-6">
                <div className="text-lg font-semibold">Online (LAN)</div>
                <div className="text-sm opacity-80 mt-1">Створи кімнату або підключись по коду</div>

                <div className="mt-4 grid gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCreatePlayersModalOpen(true);
                      setCreateErr(null);
                      setCreatePlayersCount("2");
                    }}
                    className="text-center rounded-2xl border border-foreground/20 bg-background/60 px-4 py-3 text-base font-semibold"
                  >
                    Create room
                  </button>

                  {createErr && <div className="text-sm text-red-400">{createErr}</div>}

                  <div className="rounded-2xl border border-foreground/15 bg-background/50 px-4 py-4">
                    <div className="text-sm font-semibold">Join room</div>
                    <div className="mt-2 grid gap-2">
                      <input
                        value={joinCode}
                        onChange={(e) => {
                          setJoinErr(null);
                          setJoinCode(e.target.value);
                        }}
                        placeholder="ABCDE"
                        className="w-full rounded-2xl border border-foreground/20 bg-background/60 px-4 py-3 text-base font-medium outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => joinRoom(joinCode)}
                        className="text-center rounded-2xl border border-foreground/20 bg-background/60 px-4 py-3 text-base font-semibold"
                      >
                        Join
                      </button>
                      {joinErr && <div className="text-sm text-red-400">{joinErr}</div>}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-foreground/15 bg-background/50 px-4 py-4">
                    <div className="text-sm font-semibold">Open lobbies</div>
                    <div className="text-xs opacity-80 mt-1">Клікни щоб долучитись</div>

                    {lobbies.length === 0 ? (
                      <div className="mt-3 text-sm opacity-80">Зараз немає відкритих кімнат.</div>
                    ) : (
                      <div className="mt-3 grid gap-2">
                        {lobbies.map((l) => (
                          <button
                            key={l.roomCode}
                            type="button"
                            onClick={() => joinRoom(l.roomCode)}
                            className="text-left rounded-2xl border border-foreground/20 bg-background/60 px-4 py-3"
                          >
                            <div className="text-base font-semibold tabular-nums">{l.roomCode}</div>
                            <div className="text-xs opacity-80">
                              {l.connected}/{l.playerCount} • вільно: {l.openSeats}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : !started ? (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="pointer-events-auto w-full max-w-md rounded-3xl border border-foreground/20 bg-background/70 backdrop-blur px-6 py-6">
                <div className="text-lg font-semibold">Room {roomCode}</div>
                <div className="text-sm opacity-80 mt-1">
                  {isHost ? "Чекай гравців, потім натисни Start." : "Очікуй, поки хост натисне Start."}
                </div>
                <div className="mt-3 text-sm opacity-80">Players: {roomPlayerCount ?? "?"}</div>

                <div className="mt-4 rounded-2xl border border-foreground/15 bg-background/50 px-4 py-4">
                  <div className="text-sm font-semibold">
                    Гравці ({(roster?.connected ?? (playerIndex === null ? 0 : 1))}/{roomPlayerCount ?? "?"})
                  </div>

                  <div className="mt-3 grid gap-2">
                    {Array.from({ length: roomPlayerCount ?? 0 }).map((_, idx) => {
                      const occupied = Boolean(roster?.indices?.includes(idx) || idx === playerIndex || (isHost && idx === 0));
                      const isYou = playerIndex === idx;
                      const isH = idx === 0;

                      return (
                        <div
                          key={`slot-${idx}`}
                          className={
                            occupied
                              ? "rounded-2xl border border-foreground/20 bg-background/60 px-4 py-3"
                              : "rounded-2xl border border-foreground/10 bg-background/40 px-4 py-3 opacity-80"
                          }
                        >
                          <div className="text-sm font-semibold">
                            {occupied ? `Гравець ${idx + 1}` : "Очікування гравця…"}
                            {isYou && occupied ? " (ти)" : ""}
                          </div>
                          {occupied && isH && <div className="text-xs opacity-80">Хост</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <BoardScene
              onMessage={(m, err) => {
                setMsg(m);
                setIsErr(Boolean(err));
              }}
              api={{
                tryPlace: (x, y) => {
                  if (!isMyTurn()) return { ok: false, reason: "Not your turn" };
                  sendAction({ type: "place", x, y });
                  return { ok: true };
                },
                placeMeeple: (x, y, feature) => {
                  if (!isMyTurn()) return { ok: false, reason: "Not your turn" };
                  sendAction({ type: "placeMeeple", x, y, feature });
                  return { ok: true };
                },
              }}
            />
          )}
        </div>
      </div>

      <div className="fixed left-3 bottom-3 z-10 pointer-events-none">
        <div className="rounded-2xl border border-foreground/20 bg-background/70 backdrop-blur px-4 py-2 text-sm">
          <span className={isErr ? "text-red-400" : "opacity-90"}>{msg}</span>
        </div>
      </div>

      {createPlayersModalOpen && (
        <div className="fixed inset-0 z-20 flex items-center justify-center p-3">
          <div className="absolute inset-0 bg-foreground/30" />

          <div className="relative w-full max-w-md rounded-3xl border border-foreground/20 bg-background/80 backdrop-blur px-6 py-6 pointer-events-auto">
            <div className="text-lg font-semibold">Нова онлайн кімната</div>
            <div className="text-sm opacity-80 mt-1">Введіть кількість гравців від 1 до 5</div>

            <form
              className="mt-4 grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                const n = Number(createPlayersCount);
                if (!Number.isFinite(n) || n < 1 || n > 5) {
                  setCreateErr("Кількість гравців має бути від 1 до 5");
                  return;
                }
                setCreatePlayersModalOpen(false);
                setCreateErr(null);
                createRoom(Math.floor(n));
              }}
            >
              <input
                autoFocus
                inputMode="numeric"
                value={createPlayersCount}
                onChange={(e) => {
                  setCreateErr(null);
                  setCreatePlayersCount(e.target.value);
                }}
                placeholder="2"
                className="w-full rounded-2xl border border-foreground/20 bg-background/60 px-4 py-3 text-base font-medium outline-none"
              />

              {createErr && <div className="text-sm text-red-400">{createErr}</div>}

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setCreatePlayersModalOpen(false);
                    setCreateErr(null);
                  }}
                  className="text-center rounded-2xl border border-foreground/20 bg-background/60 px-4 py-3 text-base font-semibold"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="text-center rounded-2xl border border-foreground/20 bg-background/60 px-4 py-3 text-base font-semibold"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
