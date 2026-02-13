import type { Coord } from "../model/types";

export function keyOf(x: number, y: number): string {
  return `${x},${y}`;
}

export function parseKey(key: string): Coord {
  const [xs, ys] = key.split(",");
  return { x: Number(xs), y: Number(ys) };
}

// 4-сусіди (для правил суміжних сторін)
export function neighbors4(x: number, y: number): Coord[] {
  return [
    { x, y: y - 1 }, // N
    { x: x + 1, y }, // E
    { x, y: y + 1 }, // S
    { x: x - 1, y }, // W
  ];
}

// 8-сусіди (для показу “8 пустих клітинок”)
export function neighbors8(x: number, y: number): Coord[] {
  const out: Coord[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      out.push({ x: x + dx, y: y + dy });
    }
  }
  return out;
}
