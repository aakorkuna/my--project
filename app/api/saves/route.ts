import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

type SaveMode = "solo" | "multi";

type GameStateSnapshot = {
  board: Record<string, unknown>;
  deck: unknown[];
  active: unknown;
  score: number;
  meeplesRemaining: number;
  meeples: unknown[];
  meepleTarget: unknown;
};

type SaveFileV1 = {
  v: 1;
  id: string;
  savedAt: number;
  label?: string;
  state: GameStateSnapshot;
};

const SAVE_BASE_DIR = path.join(process.cwd(), "src", "game", "store", "save", "saves");

function modeFromUrl(req: Request): SaveMode {
  const url = new URL(req.url);
  const m = url.searchParams.get("mode");
  return m === "multi" ? "multi" : "solo";
}

function modeFromBody(body: unknown): SaveMode {
  if (!body || typeof body !== "object") return "solo";
  const anyB = body as { mode?: unknown };
  return anyB.mode === "multi" ? "multi" : "solo";
}

function saveDirFor(mode: SaveMode): string {
  return path.join(SAVE_BASE_DIR, mode);
}

async function ensureDir(mode: SaveMode) {
  await fs.mkdir(saveDirFor(mode), { recursive: true });
}

function safeId(id: string): string {
  // allow only simple ids to prevent path traversal
  return id.replace(/[^a-zA-Z0-9_-]/g, "");
}

function newId(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  const rand = Math.random().toString(36).slice(2, 8);
  return `${yyyy}${mm}${dd}_${hh}${mi}${ss}_${ms}_${rand}`;
}

async function readSaveFile(filePath: string): Promise<SaveFileV1 | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const anyP = parsed as Partial<SaveFileV1>;
    if (anyP.v !== 1) return null;
    if (typeof anyP.id !== "string") return null;
    if (typeof anyP.savedAt !== "number") return null;
    if (!anyP.state || typeof anyP.state !== "object") return null;
    return anyP as SaveFileV1;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  // Default mode is solo to keep existing UX unchanged.
  // Also include legacy (pre-mode) saves as solo.
  const mode = modeFromUrl(req);
  await ensureDir(mode);

  const modeDir = saveDirFor(mode);
  const files = await fs.readdir(modeDir);
  const saves: Array<{ id: string; savedAt: number; label?: string }> = [];

  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    const filePath = path.join(modeDir, f);
    const data = await readSaveFile(filePath);
    if (!data) continue;
    saves.push({ id: data.id, savedAt: data.savedAt, label: data.label });
  }

  if (mode === "solo") {
    // Legacy flat dir: treat as solo saves
    try {
      const legacyFiles = await fs.readdir(SAVE_BASE_DIR);
      for (const f of legacyFiles) {
        if (!f.endsWith(".json")) continue;
        const filePath = path.join(SAVE_BASE_DIR, f);
        const data = await readSaveFile(filePath);
        if (!data) continue;
        // Avoid duplicates if someone moved files manually
        if (saves.some((s) => s.id === data.id)) continue;
        saves.push({ id: data.id, savedAt: data.savedAt, label: data.label });
      }
    } catch {
      // ignore
    }
  }

  saves.sort((a, b) => b.savedAt - a.savedAt);
  return NextResponse.json({ ok: true, saves });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "Invalid JSON" }, { status: 400 });
  }

  const mode = modeFromBody(body);
  await ensureDir(mode);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, reason: "Invalid body" }, { status: 400 });
  }

  const anyB = body as { label?: unknown; state?: unknown };
  const label = typeof anyB.label === "string" ? anyB.label : undefined;
  const state = anyB.state as unknown;

  if (!state || typeof state !== "object") {
    return NextResponse.json({ ok: false, reason: "Missing state" }, { status: 400 });
  }

  const id = safeId(newId());
  const payload: SaveFileV1 = {
    v: 1,
    id,
    savedAt: Date.now(),
    label,
    state: state as GameStateSnapshot,
  };

  const filePath = path.join(saveDirFor(mode), `${id}.json`);
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");

  return NextResponse.json({ ok: true, id });
}
