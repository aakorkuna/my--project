import type { EdgeDir, Rotation, TileEdges } from "../model/types";

const ORDER: EdgeDir[] = ["N", "E", "S", "W"];

function steps(rotation: Rotation): number {
  switch (rotation) {
    case 0: return 0;
    case 90: return 1;
    case 180: return 2;
    case 270: return 3;
  }
}

export function rotateEdges(edges: TileEdges, rotation: Rotation): TileEdges {
  const s = steps(rotation);
  if (s === 0) return edges;

  const out: Partial<TileEdges> = {};
  for (let i = 0; i < 4; i++) {
    const from = ORDER[i];
    const to = ORDER[(i + s) % 4];
    out[to] = edges[from];
  }
  return out as TileEdges;
}

export function rotateDir(dir: EdgeDir, rotation: Rotation): EdgeDir {
  const s = steps(rotation);
  if (s === 0) return dir;
  const i = ORDER.indexOf(dir);
  return ORDER[(i + s) % 4];
}

export function oppositeDir(dir: EdgeDir): EdgeDir {
  switch (dir) {
    case "N": return "S";
    case "E": return "W";
    case "S": return "N";
    case "W": return "E";
  }
}
