import type { BoardState, EdgeDir, Rotation, TileDefinition, PlacedTile } from "../model/types";
import { keyOf } from "./coords";
import { oppositeDir, rotateEdges } from "./rotate";
import { TILESET } from "../model/tileset";

type NeighborInfo = { dir: EdgeDir; tile: PlacedTile };

const DIRS: EdgeDir[] = ["N", "E", "S", "W"];

function neighborCoord(x: number, y: number, dir: EdgeDir): { x: number; y: number } {
  switch (dir) {
    case "N": return { x, y: y - 1 };
    case "E": return { x: x + 1, y };
    case "S": return { x, y: y + 1 };
    case "W": return { x: x - 1, y };
  }
}

export function getNeighbors4(board: BoardState, x: number, y: number): NeighborInfo[] {
  const out: NeighborInfo[] = [];
  for (const dir of DIRS) {
    const c = neighborCoord(x, y, dir);
    const n = board[keyOf(c.x, c.y)];
    if (n) out.push({ dir, tile: n });
  }
  return out;
}

export type PlacementResult =
  | { ok: true }
  | { ok: false; reason: string };

export function canPlace(
  board: BoardState,
  tileDef: TileDefinition,
  x: number,
  y: number,
  rotation: Rotation
): PlacementResult {
  const k = keyOf(x, y);
  if (board[k]) return { ok: false, reason: "Cell already occupied" };

  // важливо: хоча б 1 сусід по стороні
  const neighbors = getNeighbors4(board, x, y);
  if (neighbors.length === 0) return { ok: false, reason: "Must have at least one side neighbor" };

  const myEdges = rotateEdges(tileDef.edges, rotation);

  for (const n of neighbors) {
    const neighborDef = TILESET[n.tile.tileId];
    if (!neighborDef) return { ok: false, reason: `Unknown neighbor tileId: ${n.tile.tileId}` };

    const neighborEdges = rotateEdges(neighborDef.edges, n.tile.rotation);

    // моя сторона = n.dir, сусідня сторона = oppositeDir(n.dir)
    const mySide = myEdges[n.dir];
    const nbSide = neighborEdges[oppositeDir(n.dir)];

    if (mySide.terrain !== nbSide.terrain) {
      return { ok: false, reason: `Terrain mismatch on ${n.dir}` };
    }
    if (mySide.road !== nbSide.road) {
      return { ok: false, reason: `Road mismatch on ${n.dir}` };
    }
  }

  return { ok: true };
}

import { neighbors8 } from "./coords";
import type { Coord, } from "../model/types";

/**
 * Returns empty cells around all placed tiles (8-neighborhood).
 * This is for UI visibility (your “3x3 around start”, then expanding).
 */
export function getVisibleEmptyCells(board: BoardState): Coord[] {
  const occupied = new Set(Object.keys(board));
  const out = new Map<string, Coord>();

  for (const t of Object.values(board)) {
    for (const c of neighbors8(t.x, t.y)) {
      const k = keyOf(c.x, c.y);
      if (occupied.has(k)) continue; // already has a tile
      out.set(k, c); // unique
    }
  }

  return Array.from(out.values());
}