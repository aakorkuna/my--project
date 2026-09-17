import { browserSaves } from "./browserSaves";
import { create } from "zustand";
import type { Coord, EdgeDir, GameState, MeepleFeature, Rotation, TileDefinition, TileId } from "../model/types";
import { START_TILE_ID, TILESET, buildInitialDeck } from "../model/tileset";
import { keyOf } from "../logic/coords";
import { canPlace } from "../logic/placement";
import { oppositeDir, rotateEdges } from "../logic/rotate";

type GameActions = {
  initGame: () => void;
  initGameWithPlayers: (playerCount: number) => void;
  drawTile: () => void;
  rotateActive: () => void;
  tryPlace: (x: number, y: number) => { ok: boolean; reason?: string };

  endGameEarly: () => void;

  saveGame: () => { ok: boolean; reason?: string };
  loadGame: () => { ok: boolean; reason?: string };
  hasSave: () => boolean;

  saveGameFile: (label?: string, mode?: SaveMode) => Promise<{ ok: boolean; reason?: string; id?: string }>;
  listGameFiles: (
    mode?: SaveMode,
  ) => Promise<{ ok: boolean; reason?: string; saves?: Array<{ id: string; savedAt: number; label?: string }> }>;
  loadGameFile: (id: string, mode?: SaveMode) => Promise<{ ok: boolean; reason?: string }>;
  deleteGameFile: (id: string, mode?: SaveMode) => Promise<{ ok: boolean; reason?: string }>;

  applyRemoteState: (state: Partial<GameState>) => void;

  cancelMeepleTarget: () => void;
  placeMeeple: (x: number, y: number, feature: MeepleFeature) => { ok: boolean; reason?: string };
};

type Store = GameState & GameActions;

const SAVE_KEY = "carcassonne.save.v1";

type SaveMode = "solo" | "multi";

// Carcassonne base game has 72 landscape tiles total (including the placed start tile).
const MAX_TILES_ON_BOARD = 72;

type SavePayloadV1 = {
  v: 1;
  savedAt: number;
  state: Pick<
    GameState,
    | "board"
    | "deck"
    | "active"
    | "score"
    | "playerCount"
    | "currentPlayer"
    | "scores"
    | "meeplesRemaining"
    | "meeplesRemainingByPlayer"
    | "meeples"
    | "meepleTarget"
  >;
};

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isSavePayloadV1(x: unknown): x is SavePayloadV1 {
  if (!x || typeof x !== "object") return false;
  const anyX = x as { v?: unknown; savedAt?: unknown; state?: unknown };
  if (anyX.v !== 1) return false;
  if (typeof anyX.savedAt !== "number") return false;
  if (!anyX.state || typeof anyX.state !== "object") return false;
  return true;
}

function randIndex(max: number): number {
  return Math.floor(Math.random() * max);
}

function clampInt(x: number, min: number, max: number): number {
  const n = Math.floor(x);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function makeArray<T>(len: number, value: T): T[] {
  return Array.from({ length: Math.max(0, len) }, () => value);
}

function normalizeMeeples(meeples: Store["meeples"]): Store["meeples"] {
  return (meeples ?? []).map((m) => ({ ...m, player: typeof m.player === "number" ? m.player : 0 }));
}

function isMultiplayerState(s: Pick<GameState, "playerCount">): boolean {
  return (s.playerCount ?? 1) > 1;
}

function syncDerivedFields(partial: Partial<Store>, base: Store): Partial<Store> {
  const playerCount = Math.max(1, partial.playerCount ?? base.playerCount ?? 1);
  const currentPlayer = clampInt(partial.currentPlayer ?? base.currentPlayer ?? 0, 0, playerCount - 1);

  const scores =
    partial.scores && partial.scores.length === playerCount
      ? partial.scores
      : base.scores && base.scores.length === playerCount
        ? base.scores
        : makeArray(playerCount, 0);

  const meeplesRemainingByPlayer =
    partial.meeplesRemainingByPlayer && partial.meeplesRemainingByPlayer.length === playerCount
      ? partial.meeplesRemainingByPlayer
      : base.meeplesRemainingByPlayer && base.meeplesRemainingByPlayer.length === playerCount
        ? base.meeplesRemainingByPlayer
        : makeArray(playerCount, 8);

  return {
    ...partial,
    playerCount,
    currentPlayer,
    scores,
    meeplesRemainingByPlayer,
    score: scores[currentPlayer] ?? 0,
    meeplesRemaining: meeplesRemainingByPlayer[currentPlayer] ?? 0,
  };
}

const DIRS: EdgeDir[] = ["N", "E", "S", "W"];

function parseNodeKey(k: string): { x: number; y: number; gi: number } | null {
  const parts = k.split(",");
  if (parts.length !== 3) return null;
  const x = Number(parts[0]);
  const y = Number(parts[1]);
  const gi = Number(parts[2]);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(gi)) return null;
  return { x, y, gi };
}

function neighborCoord(x: number, y: number, dir: EdgeDir): Coord {
  switch (dir) {
    case "N":
      return { x, y: y - 1 };
    case "E":
      return { x: x + 1, y };
    case "S":
      return { x, y: y + 1 };
    case "W":
      return { x: x - 1, y };
  }
}

type RoadNode = { x: number; y: number; gi: number };

function roadNodeKey(n: RoadNode): string {
  return `${n.x},${n.y},${n.gi}`;
}

function getRoadDirs(edges: ReturnType<typeof rotateEdges>): EdgeDir[] {
  return DIRS.filter((d) => edges[d].road);
}

function rotateGroups(groups: EdgeDir[][], rotation: Rotation): EdgeDir[][] {
  return groups.map((g) => g.map((d) => {
    // inline rotateDir to avoid extra imports
    switch (rotation) {
      case 0:
        return d;
      case 90:
        return (d === "N" ? "E" : d === "E" ? "S" : d === "S" ? "W" : "N");
      case 180:
        return (d === "N" ? "S" : d === "E" ? "W" : d === "S" ? "N" : "E");
      case 270:
        return (d === "N" ? "W" : d === "E" ? "N" : d === "S" ? "E" : "S");
    }
  }));
}

function getRoadGroups(def: TileDefinition, rotation: Rotation, edges: ReturnType<typeof rotateEdges>): EdgeDir[][] {
  const roadDirs = getRoadDirs(edges);
  if (roadDirs.length === 0) return [];

  if (!def.roadGroups || def.roadGroups.length === 0) {
    return [roadDirs];
  }

  const rotated = rotateGroups(def.roadGroups, rotation);
  // Filter out any dirs that aren't actual roads after rotation (defensive)
  const filtered = rotated.map((g) => g.filter((d) => edges[d].road)).filter((g) => g.length > 0);
  return filtered.length > 0 ? filtered : [roadDirs];
}

function findGroupIndex(groups: EdgeDir[][], dir: EdgeDir): number {
  for (let gi = 0; gi < groups.length; gi++) {
    if (groups[gi].includes(dir)) return gi;
  }
  return -1;
}

function getRoadComponent(board: Store["board"], start: { x: number; y: number; dir: EdgeDir }): Set<string> {
  const startTile = board[keyOf(start.x, start.y)];
  if (!startTile) return new Set();
  const startDef = TILESET[startTile.tileId];
  if (!startDef) return new Set();

  const startEdges = rotateEdges(startDef.edges, startTile.rotation);
  if (!startEdges[start.dir].road) return new Set();

  const startGroups = getRoadGroups(startDef, startTile.rotation, startEdges);
  const startGi = findGroupIndex(startGroups, start.dir);
  if (startGi < 0) return new Set();

  const visited = new Set<string>();
  const queue: RoadNode[] = [{ x: start.x, y: start.y, gi: startGi }];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const ck = roadNodeKey(cur);
    if (visited.has(ck)) continue;

    const t = board[keyOf(cur.x, cur.y)];
    if (!t) continue;
    const def = TILESET[t.tileId];
    if (!def) continue;
    const edges = rotateEdges(def.edges, t.rotation);
    const groups = getRoadGroups(def, t.rotation, edges);
    const group = groups[cur.gi];
    if (!group) continue;

    visited.add(ck);

    for (const dir of group) {
      const n = neighborCoord(cur.x, cur.y, dir);
      const nk = keyOf(n.x, n.y);
      const nt = board[nk];
      if (!nt) continue;
      const ndef = TILESET[nt.tileId];
      if (!ndef) continue;
      const nedges = rotateEdges(ndef.edges, nt.rotation);
      const od = oppositeDir(dir);
      if (!nedges[od].road) continue;
      const ngroups = getRoadGroups(ndef, nt.rotation, nedges);
      const ngi = findGroupIndex(ngroups, od);
      if (ngi < 0) continue;
      const next: RoadNode = { x: n.x, y: n.y, gi: ngi };
      const nk2 = roadNodeKey(next);
      if (!visited.has(nk2)) queue.push(next);
    }
  }

  return visited;
}

function meepleRoadNodeKey(board: Store["board"], x: number, y: number, dir: EdgeDir): string | null {
  const t = board[keyOf(x, y)];
  if (!t) return null;
  const def = TILESET[t.tileId];
  if (!def) return null;
  const edges = rotateEdges(def.edges, t.rotation);
  if (!edges[dir].road) return null;
  const groups = getRoadGroups(def, t.rotation, edges);
  const gi = findGroupIndex(groups, dir);
  if (gi < 0) return null;
  return roadNodeKey({ x, y, gi });
}

type CityNode = { x: number; y: number; gi: number };

function cityNodeKey(n: CityNode): string {
  return `${n.x},${n.y},${n.gi}`;
}

function getCityDirs(edges: ReturnType<typeof rotateEdges>): EdgeDir[] {
  return DIRS.filter((d) => edges[d].terrain === "city");
}

function getCityGroups(def: TileDefinition, rotation: Rotation, edges: ReturnType<typeof rotateEdges>): EdgeDir[][] {
  const cityDirs = getCityDirs(edges);
  if (cityDirs.length === 0) return [];

  if (!def.cityGroups || def.cityGroups.length === 0) {
    return [cityDirs];
  }

  const rotated = rotateGroups(def.cityGroups, rotation);
  const filtered = rotated.map((g) => g.filter((d) => edges[d].terrain === "city")).filter((g) => g.length > 0);
  return filtered.length > 0 ? filtered : [cityDirs];
}

function getCityComponent(board: Store["board"], start: { x: number; y: number; dir: EdgeDir }): Set<string> {
  const startTile = board[keyOf(start.x, start.y)];
  if (!startTile) return new Set();
  const startDef = TILESET[startTile.tileId];
  if (!startDef) return new Set();

  const startEdges = rotateEdges(startDef.edges, startTile.rotation);
  if (startEdges[start.dir].terrain !== "city") return new Set();

  const startGroups = getCityGroups(startDef, startTile.rotation, startEdges);
  const startGi = findGroupIndex(startGroups, start.dir);
  if (startGi < 0) return new Set();

  const visited = new Set<string>();
  const queue: CityNode[] = [{ x: start.x, y: start.y, gi: startGi }];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const ck = cityNodeKey(cur);
    if (visited.has(ck)) continue;

    const t = board[keyOf(cur.x, cur.y)];
    if (!t) continue;
    const def = TILESET[t.tileId];
    if (!def) continue;
    const edges = rotateEdges(def.edges, t.rotation);
    const groups = getCityGroups(def, t.rotation, edges);
    const group = groups[cur.gi];
    if (!group) continue;

    visited.add(ck);

    for (const dir of group) {
      const n = neighborCoord(cur.x, cur.y, dir);
      const nk = keyOf(n.x, n.y);
      const nt = board[nk];
      if (!nt) continue;
      const ndef = TILESET[nt.tileId];
      if (!ndef) continue;
      const nedges = rotateEdges(ndef.edges, nt.rotation);
      const od = oppositeDir(dir);
      if (nedges[od].terrain !== "city") continue;
      const ngroups = getCityGroups(ndef, nt.rotation, nedges);
      const ngi = findGroupIndex(ngroups, od);
      if (ngi < 0) continue;
      const next: CityNode = { x: n.x, y: n.y, gi: ngi };
      const nk2 = cityNodeKey(next);
      if (!visited.has(nk2)) queue.push(next);
    }
  }

  return visited;
}

function meepleCityNodeKey(board: Store["board"], x: number, y: number, dir: EdgeDir): string | null {
  const t = board[keyOf(x, y)];
  if (!t) return null;
  const def = TILESET[t.tileId];
  if (!def) return null;
  const edges = rotateEdges(def.edges, t.rotation);
  if (edges[dir].terrain !== "city") return null;
  const groups = getCityGroups(def, t.rotation, edges);
  const gi = findGroupIndex(groups, dir);
  if (gi < 0) return null;
  return cityNodeKey({ x, y, gi });
}

function componentIdFromSet(nodes: Set<string>): string {
  // Canonical stable id so we can dedupe components touched by multiple dirs.
  // Using the smallest key is enough because keys are unique per component.
  let best: string | null = null;
  for (const k of nodes) {
    if (best === null || k < best) best = k;
  }
  return best ?? "";
}

function isRoadComponentComplete(board: Store["board"], comp: Set<string>): boolean {
  for (const nk of comp) {
    const n = parseNodeKey(nk);
    if (!n) return false;
    const t = board[keyOf(n.x, n.y)];
    if (!t) return false;
    const def = TILESET[t.tileId];
    if (!def) return false;
    const edges = rotateEdges(def.edges, t.rotation);
    const groups = getRoadGroups(def, t.rotation, edges);
    const group = groups[n.gi];
    if (!group) return false;

    for (const dir of group) {
      const nb = neighborCoord(n.x, n.y, dir);
      const nt = board[keyOf(nb.x, nb.y)];
      if (!nt) return false;
      const ndef = TILESET[nt.tileId];
      if (!ndef) return false;
      const nedges = rotateEdges(ndef.edges, nt.rotation);
      const od = oppositeDir(dir);
      if (!nedges[od].road) return false;
    }
  }
  return true;
}

function isCityComponentComplete(board: Store["board"], comp: Set<string>): boolean {
  for (const nk of comp) {
    const n = parseNodeKey(nk);
    if (!n) return false;
    const t = board[keyOf(n.x, n.y)];
    if (!t) return false;
    const def = TILESET[t.tileId];
    if (!def) return false;
    const edges = rotateEdges(def.edges, t.rotation);
    const groups = getCityGroups(def, t.rotation, edges);
    const group = groups[n.gi];
    if (!group) return false;

    for (const dir of group) {
      const nb = neighborCoord(n.x, n.y, dir);
      const nt = board[keyOf(nb.x, nb.y)];
      if (!nt) return false;
      const ndef = TILESET[nt.tileId];
      if (!ndef) return false;
      const nedges = rotateEdges(ndef.edges, nt.rotation);
      const od = oppositeDir(dir);
      if (nedges[od].terrain !== "city") return false;
    }
  }
  return true;
}

function isMonasteryComplete(board: Store["board"], x: number, y: number): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const t = board[keyOf(x + dx, y + dy)];
      if (!t) return false;
    }
  }
  return true;
}

function finalizeTurnScoring(
  state: Pick<Store, "board" | "meeples" | "meeplesRemaining" | "meeplesRemainingByPlayer" | "playerCount">,
  x: number,
  y: number
) {
  const { board } = state;
  const meeples = normalizeMeeples(state.meeples);
  const playerCount = Math.max(1, state.playerCount ?? 1);

  const scoreDeltaByPlayer = makeArray(playerCount, 0);
  const returnedByPlayer = makeArray(playerCount, 0);

  const returnedMeepleIdx = new Set<number>();

  function awardPointsForMeeples(meepleIndices: number[], points: number) {
    if (meepleIndices.length === 0 || points === 0) return;
    const counts = makeArray(playerCount, 0);
    for (const idx of meepleIndices) {
      const p = meeples[idx]?.player ?? 0;
      const pi = clampInt(p, 0, playerCount - 1);
      counts[pi] += 1;
    }
    let max = 0;
    for (const c of counts) max = Math.max(max, c);
    if (max <= 0) return;
    for (let pi = 0; pi < counts.length; pi++) {
      if (counts[pi] === max) scoreDeltaByPlayer[pi] += points;
    }
  }

  // Roads + Cities: only components touched by the last placed tile.
  const tile = board[keyOf(x, y)];
  if (tile) {
    const def = TILESET[tile.tileId];
    if (def) {
      const edges = rotateEdges(def.edges, tile.rotation);

      // Roads
      const roadCompsById = new Map<string, Set<string>>();
      for (const dir of getRoadDirs(edges)) {
        const comp = getRoadComponent(board, { x, y, dir });
        if (comp.size === 0) continue;
        const id = componentIdFromSet(comp);
        if (!id) continue;
        if (!roadCompsById.has(id)) roadCompsById.set(id, comp);
      }

      for (const comp of roadCompsById.values()) {
        if (!isRoadComponentComplete(board, comp)) continue;

        const meepleIndicesOnComp: number[] = [];
        for (let i = 0; i < meeples.length; i++) {
          const m = meeples[i];
          if (m.feature.kind !== "road") continue;
          const mk = meepleRoadNodeKey(board, m.x, m.y, m.feature.dir);
          if (mk && comp.has(mk)) meepleIndicesOnComp.push(i);
        }

        if (meepleIndicesOnComp.length === 0) continue;
        awardPointsForMeeples(meepleIndicesOnComp, comp.size); // 1 point per tile segment in the completed road
        for (const idx of meepleIndicesOnComp) returnedMeepleIdx.add(idx);
      }

      // Cities
      const cityCompsById = new Map<string, Set<string>>();
      for (const dir of getCityDirs(edges)) {
        const comp = getCityComponent(board, { x, y, dir });
        if (comp.size === 0) continue;
        const id = componentIdFromSet(comp);
        if (!id) continue;
        if (!cityCompsById.has(id)) cityCompsById.set(id, comp);
      }

      for (const comp of cityCompsById.values()) {
        if (!isCityComponentComplete(board, comp)) continue;

        const meepleIndicesOnComp: number[] = [];
        for (let i = 0; i < meeples.length; i++) {
          const m = meeples[i];
          if (m.feature.kind !== "city") continue;
          const mk = meepleCityNodeKey(board, m.x, m.y, m.feature.dir);
          if (mk && comp.has(mk)) meepleIndicesOnComp.push(i);
        }

        if (meepleIndicesOnComp.length === 0) continue;

        let shields = 0;
        for (const nk of comp) {
          const n = parseNodeKey(nk);
          if (!n) continue;
          const t2 = board[keyOf(n.x, n.y)];
          if (!t2) continue;
          if (TILESET[t2.tileId]?.hasShield) shields++;
        }

        awardPointsForMeeples(meepleIndicesOnComp, comp.size * 2 + shields * 2);
        for (const idx of meepleIndicesOnComp) returnedMeepleIdx.add(idx);
      }
    }
  }

  // Monasteries: any church meeple in the 3x3 around the last placed tile may complete now.
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = x + dx;
      const cy = y + dy;
      const tileHere = board[keyOf(cx, cy)];
      if (!tileHere) continue;

      for (let i = 0; i < meeples.length; i++) {
        const m = meeples[i];
        if (m.feature.kind !== "church") continue;
        if (m.x !== cx || m.y !== cy) continue;
        if (!isMonasteryComplete(board, cx, cy)) continue;

        awardPointsForMeeples([i], 9); // 1 per monastery tile + 8 surrounding
        returnedMeepleIdx.add(i);
      }
    }
  }

  for (const idx of returnedMeepleIdx) {
    const p = meeples[idx]?.player ?? 0;
    const pi = clampInt(p, 0, playerCount - 1);
    returnedByPlayer[pi] += 1;
  }

  const returnedTotal = returnedMeepleIdx.size;
  const scoreTotal = scoreDeltaByPlayer.reduce((a, b) => a + b, 0);
  if (returnedTotal === 0 && scoreTotal === 0) {
    return {
      scoreDeltaByPlayer,
      nextMeeples: meeples,
      nextMeeplesRemainingByPlayer:
        state.meeplesRemainingByPlayer && state.meeplesRemainingByPlayer.length === playerCount
          ? state.meeplesRemainingByPlayer
          : makeArray(playerCount, state.meeplesRemaining ?? 8),
    };
  }

  const nextMeeples = meeples.filter((_, idx) => !returnedMeepleIdx.has(idx));

  const nextMeeplesRemainingByPlayer =
    state.meeplesRemainingByPlayer && state.meeplesRemainingByPlayer.length === playerCount
      ? state.meeplesRemainingByPlayer.slice()
      : makeArray(playerCount, state.meeplesRemaining ?? 8);
  for (let pi = 0; pi < playerCount; pi++) {
    nextMeeplesRemainingByPlayer[pi] = (nextMeeplesRemainingByPlayer[pi] ?? 0) + (returnedByPlayer[pi] ?? 0);
  }

  return {
    scoreDeltaByPlayer,
    nextMeeples,
    nextMeeplesRemainingByPlayer,
  };
}

export const useGameStore = create<Store>((set, get) => ({
  board: {},
  deck: [],
  active: null,
  score: 0,
  playerCount: 1,
  currentPlayer: 0,
  scores: [0],
  meeplesRemaining: 8,
  meeplesRemainingByPlayer: [8],
  meeples: [],
  meepleTarget: null,

  saveGameFile: async (label?: string, mode?: SaveMode) => {
    try {
      const s = get();
      const resolvedMode: SaveMode = mode ?? ((s.playerCount ?? 1) > 1 ? "multi" : "solo");
      const id = browserSaves.save(resolvedMode, {
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
      }, label);
      return { ok: true, id };
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : "Failed to save" };
    }
  },

  listGameFiles: async (mode?: SaveMode) => {
    try {
      const s = get();
      const resolvedMode: SaveMode = mode ?? ((s.playerCount ?? 1) > 1 ? "multi" : "solo");
      return { ok: true, saves: browserSaves.list(resolvedMode) };
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : "Failed to list" };
    }
  },

  loadGameFile: async (id: string, mode?: SaveMode) => {
    try {
      const s = get();
      const resolvedMode: SaveMode = mode ?? ((s.playerCount ?? 1) > 1 ? "multi" : "solo");
      const state = browserSaves.load(resolvedMode, id)?.state as
        | Partial<
            Pick<
              GameState,
              | "board"
              | "deck"
              | "active"
              | "score"
              | "playerCount"
              | "currentPlayer"
              | "scores"
              | "meeplesRemaining"
              | "meeplesRemainingByPlayer"
              | "meeples"
              | "meepleTarget"
            >
          >
        | undefined;
      if (!state) return { ok: false, reason: "Invalid save state" };

      const base = get();
      const playerCount = clampInt((state.playerCount as number) ?? base.playerCount ?? 1, 1, 5);
      const currentPlayer = clampInt((state.currentPlayer as number) ?? 0, 0, playerCount - 1);

      const scoresRaw = Array.isArray(state.scores) ? (state.scores as unknown[]) : null;
      const scores =
        scoresRaw && scoresRaw.length === playerCount
          ? scoresRaw.map((n) => (typeof n === "number" ? n : 0))
          : makeArray(playerCount, typeof state.score === "number" ? (state.score as number) : 0);

      const remRaw = Array.isArray(state.meeplesRemainingByPlayer) ? (state.meeplesRemainingByPlayer as unknown[]) : null;
      const meeplesRemainingByPlayer =
        remRaw && remRaw.length === playerCount
          ? remRaw.map((n) => (typeof n === "number" ? n : 0))
          : makeArray(playerCount, typeof state.meeplesRemaining === "number" ? (state.meeplesRemaining as number) : 8);

      const next: Partial<Store> = {
        board: (state.board as Store["board"]) ?? {},
        deck: (state.deck as Store["deck"]) ?? [],
        active: (state.active as Store["active"]) ?? null,
        playerCount,
        currentPlayer,
        scores,
        meeplesRemainingByPlayer,
        meeples: normalizeMeeples(((state.meeples as Store["meeples"]) ?? []) as Store["meeples"]),
        meepleTarget: (state.meepleTarget as Store["meepleTarget"]) ?? null,
      };

      set(syncDerivedFields(next, base));

      return { ok: true };
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : "Failed to load" };
    }
  },

  deleteGameFile: async (id: string, mode?: SaveMode) => {
    try {
      const s = get();
      const resolvedMode: SaveMode = mode ?? ((s.playerCount ?? 1) > 1 ? "multi" : "solo");
      browserSaves.delete(resolvedMode, id);
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : "Failed to delete" };
    }
  },

  applyRemoteState: (state: Partial<GameState>) => {
    const base = get();
    const next: Partial<Store> = {
      board: "board" in state ? ((state.board as Store["board"]) ?? {}) : base.board,
      deck: "deck" in state ? ((state.deck as Store["deck"]) ?? []) : base.deck,
      active: "active" in state ? ((state.active as Store["active"]) ?? null) : base.active,
      playerCount: typeof state.playerCount === "number" ? state.playerCount : base.playerCount,
      currentPlayer: typeof state.currentPlayer === "number" ? state.currentPlayer : base.currentPlayer,
      scores: Array.isArray(state.scores) ? (state.scores as Store["scores"]) : base.scores,
      meeplesRemainingByPlayer: Array.isArray(state.meeplesRemainingByPlayer)
        ? (state.meeplesRemainingByPlayer as Store["meeplesRemainingByPlayer"])
        : base.meeplesRemainingByPlayer,
      meeples: "meeples" in state ? normalizeMeeples(((state.meeples as Store["meeples"]) ?? []) as Store["meeples"]) : base.meeples,
      meepleTarget: "meepleTarget" in state ? ((state.meepleTarget as Store["meepleTarget"]) ?? null) : base.meepleTarget,
    };

    set(syncDerivedFields(next, base));
  },

  hasSave: () => {
    if (!canUseLocalStorage()) return false;
    return window.localStorage.getItem(SAVE_KEY) !== null;
  },

  saveGame: () => {
    if (!canUseLocalStorage()) return { ok: false, reason: "localStorage is not available" };
    try {
      const s = get();
      const payload: SavePayloadV1 = {
        v: 1,
        savedAt: Date.now(),
        state: {
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
        },
      };
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : "Failed to save" };
    }
  },

  loadGame: () => {
    if (!canUseLocalStorage()) return { ok: false, reason: "localStorage is not available" };
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return { ok: false, reason: "No save found" };
      const parsed = JSON.parse(raw) as unknown;
      if (!isSavePayloadV1(parsed)) return { ok: false, reason: "Invalid save format" };

      const loaded = parsed.state;
      // Minimal sanity checks (defensive)
      if (!loaded || typeof loaded !== "object") return { ok: false, reason: "Invalid save state" };

      const base = get();
      const playerCount = clampInt((loaded.playerCount as number) ?? base.playerCount ?? 1, 1, 5);
      const currentPlayer = clampInt((loaded.currentPlayer as number) ?? 0, 0, playerCount - 1);

      const scoresRaw = Array.isArray(loaded.scores) ? (loaded.scores as unknown[]) : null;
      const scores =
        scoresRaw && scoresRaw.length === playerCount
          ? scoresRaw.map((n) => (typeof n === "number" ? n : 0))
          : makeArray(playerCount, typeof loaded.score === "number" ? (loaded.score as number) : 0);

      const remRaw = Array.isArray(loaded.meeplesRemainingByPlayer) ? (loaded.meeplesRemainingByPlayer as unknown[]) : null;
      const meeplesRemainingByPlayer =
        remRaw && remRaw.length === playerCount
          ? remRaw.map((n) => (typeof n === "number" ? n : 0))
          : makeArray(playerCount, typeof loaded.meeplesRemaining === "number" ? (loaded.meeplesRemaining as number) : 8);

      const next: Partial<Store> = {
        board: loaded.board ?? {},
        deck: loaded.deck ?? [],
        active: loaded.active ?? null,
        playerCount,
        currentPlayer,
        scores,
        meeplesRemainingByPlayer,
        meeples: normalizeMeeples(((loaded.meeples ?? []) as Store["meeples"]) as Store["meeples"]),
        meepleTarget: loaded.meepleTarget ?? null,
      };

      set(syncDerivedFields(next, base));

      return { ok: true };
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : "Failed to load" };
    }
  },

  initGame: () => {
    const base = get();
    // стартовий тайл в (0,0)
    const deck = buildInitialDeck();

    // Consume one copy of the start tile from the deck, so total counts match TILESET weights.
    const startIdx = deck.indexOf(START_TILE_ID);
    if (startIdx >= 0) deck.splice(startIdx, 1);

    const board = {
      [keyOf(0, 0)]: { tileId: START_TILE_ID, x: 0, y: 0, rotation: 0 as Rotation },
    };

    const next: Partial<Store> = {
      board,
      deck,
      active: null,
      playerCount: 1,
      currentPlayer: 0,
      scores: [0],
      meeplesRemainingByPlayer: [8],
      meeples: [],
      meepleTarget: null,
    };

    set(syncDerivedFields(next, base));

    get().drawTile();
  },

  initGameWithPlayers: (playerCount: number) => {
    const base = get();
    const pc = clampInt(playerCount, 1, 5);

    const deck = buildInitialDeck();
    const startIdx = deck.indexOf(START_TILE_ID);
    if (startIdx >= 0) deck.splice(startIdx, 1);

    const board = {
      [keyOf(0, 0)]: { tileId: START_TILE_ID, x: 0, y: 0, rotation: 0 as Rotation },
    };

    const next: Partial<Store> = {
      board,
      deck,
      active: null,
      playerCount: pc,
      currentPlayer: 0,
      scores: makeArray(pc, 0),
      meeplesRemainingByPlayer: makeArray(pc, 8),
      meeples: [],
      meepleTarget: null,
    };

    set(syncDerivedFields(next, base));
    get().drawTile();
  },

  drawTile: () => {
    const { board } = get();
    // Hard stop once the last tile is placed.
    if (Object.keys(board ?? {}).length >= MAX_TILES_ON_BOARD) {
      set({ active: null, deck: [] });
      return;
    }

    const { deck } = get();
    if (deck.length === 0) {
      set({ active: null });
      return;
    }

    const idx = randIndex(deck.length);
    const tileId = deck[idx] as TileId;

    const nextDeck = deck.slice();
    nextDeck.splice(idx, 1);

    set({
      deck: nextDeck,
      active: { tileId, rotation: 0 },
    });
  },

  rotateActive: () => {
    const { active } = get();
    if (!active) return;
    const nextRot: Rotation = ((active.rotation + 90) % 360) as Rotation;
    set({ active: { ...active, rotation: nextRot } });
  },

  endGameEarly: () => {
    const cur0 = get();
    const { meepleTarget } = cur0;

    if (meepleTarget) {
      const fin = finalizeTurnScoring(cur0, meepleTarget.x, meepleTarget.y);
      const nextScores = (cur0.scores ?? [cur0.score ?? 0]).slice();
      for (let pi = 0; pi < nextScores.length && pi < fin.scoreDeltaByPlayer.length; pi++) {
        nextScores[pi] = (nextScores[pi] ?? 0) + (fin.scoreDeltaByPlayer[pi] ?? 0);
      }

      set(
        syncDerivedFields(
          {
            scores: nextScores,
            meeples: fin.nextMeeples,
            meeplesRemainingByPlayer: fin.nextMeeplesRemainingByPlayer,
            meepleTarget: null,
            active: null,
            deck: [],
          },
          cur0
        )
      );
      return;
    }

    set(
      syncDerivedFields(
        {
          meepleTarget: null,
          active: null,
          deck: [],
        },
        cur0
      )
    );
  },

  tryPlace: (x: number, y: number) => {
    const cur0 = get();
    const { board, active, meepleTarget } = cur0;
    if (!active) return { ok: false, reason: "No active tile" };

    const isMulti = isMultiplayerState(cur0);
    const pc = Math.max(1, cur0.playerCount ?? 1);
    const curPlayer = clampInt(cur0.currentPlayer ?? 0, 0, pc - 1);
    const curMeeplesRemaining = (cur0.meeplesRemainingByPlayer?.[curPlayer] ?? cur0.meeplesRemaining ?? 0) as number;

    // In multiplayer: you must resolve the meeple decision before placing another tile.
    if (isMulti && meepleTarget) {
      return { ok: false, reason: "Finish meeple decision first (place meeple or Next/Esc)." };
    }

    // Solo convenience: if you didn't decide yet, auto-finalize before placing next tile.
    if (!isMulti && meepleTarget) {
      const cur = get();
      const fin = finalizeTurnScoring(cur, meepleTarget.x, meepleTarget.y);
      const nextScores = (cur.scores ?? [cur.score ?? 0]).slice();
      for (let pi = 0; pi < nextScores.length && pi < fin.scoreDeltaByPlayer.length; pi++) {
        nextScores[pi] = (nextScores[pi] ?? 0) + (fin.scoreDeltaByPlayer[pi] ?? 0);
      }
      set(
        syncDerivedFields(
          {
            scores: nextScores,
            meeples: fin.nextMeeples,
            meeplesRemainingByPlayer: fin.nextMeeplesRemainingByPlayer,
            meepleTarget: null,
          },
          cur
        )
      );
    }

    const def = TILESET[active.tileId];
    if (!def) return { ok: false, reason: `Unknown tileId: ${active.tileId}` };

    const res = canPlace(board, def, x, y, active.rotation);
    if (!res.ok) return { ok: false, reason: res.reason };

    const k = keyOf(x, y);
    const nextBoard = {
      ...board,
      [k]: { tileId: active.tileId, x, y, rotation: active.rotation },
    };

    // Place tile first.
    set({
      board: nextBoard,
      active: null,
    });

    // If current player has meeples, allow immediate placement; otherwise the turn ends immediately.
    if (curMeeplesRemaining > 0) {
      set({ meepleTarget: { x, y } as Coord });
      if (!isMulti) {
        // Solo: draw next tile immediately.
        get().drawTile();
      }
      return { ok: true };
    }

    // No meeples for this player => end turn right away.
    const cur = get();
    const fin = finalizeTurnScoring(cur, x, y);
    const nextScores = (cur.scores ?? [cur.score ?? 0]).slice();
    for (let pi = 0; pi < nextScores.length && pi < fin.scoreDeltaByPlayer.length; pi++) {
      nextScores[pi] = (nextScores[pi] ?? 0) + (fin.scoreDeltaByPlayer[pi] ?? 0);
    }

    const nextPartial: Partial<Store> = {
      scores: nextScores,
      meeples: fin.nextMeeples,
      meeplesRemainingByPlayer: fin.nextMeeplesRemainingByPlayer,
      meepleTarget: null,
    };
    if (isMulti) nextPartial.currentPlayer = (curPlayer + 1) % pc;

    set(syncDerivedFields(nextPartial, cur));
    get().drawTile();

    return { ok: true };
  },

  cancelMeepleTarget: () => {
    const { meepleTarget } = get();
    if (!meepleTarget) return;
    const cur = get();
    const fin = finalizeTurnScoring(cur, meepleTarget.x, meepleTarget.y);

    const nextScores = (cur.scores ?? [cur.score ?? 0]).slice();
    for (let pi = 0; pi < nextScores.length && pi < fin.scoreDeltaByPlayer.length; pi++) {
      nextScores[pi] = (nextScores[pi] ?? 0) + (fin.scoreDeltaByPlayer[pi] ?? 0);
    }

    const isMulti = isMultiplayerState(cur);
    const pc = Math.max(1, cur.playerCount ?? 1);
    const curPlayer = clampInt(cur.currentPlayer ?? 0, 0, pc - 1);

    const nextPartial: Partial<Store> = {
      scores: nextScores,
      meeples: fin.nextMeeples,
      meeplesRemainingByPlayer: fin.nextMeeplesRemainingByPlayer,
      meepleTarget: null,
    };
    if (isMulti) nextPartial.currentPlayer = (curPlayer + 1) % pc;

    set(syncDerivedFields(nextPartial, cur));
    if (isMulti) get().drawTile();
  },

  placeMeeple: (x: number, y: number, feature: MeepleFeature) => {
    const { board, meeples, meepleTarget } = get();

    const cur0 = get();
    const isMulti = isMultiplayerState(cur0);
    const pc = Math.max(1, cur0.playerCount ?? 1);
    const curPlayer = clampInt(cur0.currentPlayer ?? 0, 0, pc - 1);

    const remainingByPlayer =
      cur0.meeplesRemainingByPlayer && cur0.meeplesRemainingByPlayer.length === pc
        ? cur0.meeplesRemainingByPlayer.slice()
        : makeArray(pc, cur0.meeplesRemaining ?? 8);

    const curMeeplesRemaining = (remainingByPlayer[curPlayer] ?? 0) as number;
    if (curMeeplesRemaining <= 0) return { ok: false, reason: "No meeples remaining" };
    if (!meepleTarget || meepleTarget.x !== x || meepleTarget.y !== y)
      return { ok: false, reason: "Meeple can only be placed on the last placed tile" };

    // Rule: only one meeple per connected road.
    if (feature.kind === "road") {
      const comp = getRoadComponent(board, { x, y, dir: feature.dir });
      const occupied = meeples.some((m) => {
        if (m.feature.kind !== "road") return false;
        const mk = meepleRoadNodeKey(board, m.x, m.y, m.feature.dir);
        return mk ? comp.has(mk) : false;
      });
      if (occupied) return { ok: false, reason: "This road already has a meeple" };
    }

    // Rule: only one meeple per connected city.
    if (feature.kind === "city") {
      const comp = getCityComponent(board, { x, y, dir: feature.dir });
      const occupied = meeples.some((m) => {
        if (m.feature.kind !== "city") return false;
        const mk = meepleCityNodeKey(board, m.x, m.y, m.feature.dir);
        return mk ? comp.has(mk) : false;
      });
      if (occupied) return { ok: false, reason: "This city already has a meeple" };
    }

    const alreadyThere = meeples.some((m) => {
      if (m.x !== x || m.y !== y) return false;
      if (m.feature.kind !== feature.kind) return false;
      if (feature.kind === "church") return true;
      if (m.feature.kind === "church") return false;
      return m.feature.dir === feature.dir;
    });

    if (alreadyThere) return { ok: false, reason: "A meeple is already placed there" };

    // Place meeple, then finalize scoring for the turn.
    remainingByPlayer[curPlayer] = (remainingByPlayer[curPlayer] ?? 0) - 1;
    const placedMeeples = [...meeples, { x, y, feature, player: curPlayer }];

    const afterPlaceState = {
      board: cur0.board,
      meeples: placedMeeples,
      meeplesRemaining: remainingByPlayer[curPlayer] ?? 0,
      meeplesRemainingByPlayer: remainingByPlayer,
      playerCount: pc,
    } satisfies Pick<Store, "board" | "meeples" | "meeplesRemaining" | "meeplesRemainingByPlayer" | "playerCount">;

    const fin = finalizeTurnScoring(afterPlaceState, x, y);

    const cur = get();
    const nextScores = (cur.scores ?? [cur.score ?? 0]).slice();
    for (let pi = 0; pi < nextScores.length && pi < fin.scoreDeltaByPlayer.length; pi++) {
      nextScores[pi] = (nextScores[pi] ?? 0) + (fin.scoreDeltaByPlayer[pi] ?? 0);
    }

    const nextPartial: Partial<Store> = {
      scores: nextScores,
      meeples: fin.nextMeeples,
      meeplesRemainingByPlayer: fin.nextMeeplesRemainingByPlayer,
      meepleTarget: null,
    };
    if (isMulti) nextPartial.currentPlayer = (curPlayer + 1) % pc;

    set(syncDerivedFields(nextPartial, cur));
    if (isMulti) get().drawTile();

    return { ok: true };
  },
}));
