import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

type SaveFileV1 = {
  v: 1;
  id: string;
  savedAt: number;
  label?: string;
  state: unknown;
};

type SaveMode = "solo" | "multi";

const SAVE_BASE_DIR = path.join(process.cwd(), "src", "game", "store", "save", "saves");

function modeFromUrl(req: Request): SaveMode {
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode");
  return mode === "multi" ? "multi" : "solo";
}

function dirForMode(mode: SaveMode) {
  return path.join(SAVE_BASE_DIR, mode);
}

function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "");
}

async function filePathFor(id: string): Promise<string> {
  await fs.mkdir(SAVE_BASE_DIR, { recursive: true });
  const sid = safeId(id);
  return path.join(SAVE_BASE_DIR, `${sid}.json`);
}

async function filePathForMode(mode: SaveMode, id: string): Promise<string> {
  const dir = dirForMode(mode);
  await fs.mkdir(dir, { recursive: true });
  const sid = safeId(id);
  return path.join(dir, `${sid}.json`);
}

async function exists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
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
    if (!("state" in anyP)) return null;
    return anyP as SaveFileV1;
  } catch {
    return null;
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const mode = modeFromUrl(req);
  let fp = await filePathForMode(mode, id);

  // Backward compatibility: old saves were stored directly under SAVE_BASE_DIR
  if (mode === "solo" && !(await exists(fp))) {
    const legacyFp = await filePathFor(id);
    if (await exists(legacyFp)) fp = legacyFp;
  }

  const data = await readSaveFile(fp);
  if (!data) return NextResponse.json({ ok: false, reason: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, save: data });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const mode = modeFromUrl(req);
  let fp = await filePathForMode(mode, id);

  if (mode === "solo" && !(await exists(fp))) {
    const legacyFp = await filePathFor(id);
    if (await exists(legacyFp)) fp = legacyFp;
  }

  try {
    await fs.unlink(fp);
  } catch {
    // ignore if missing
  }
  return NextResponse.json({ ok: true });
}
