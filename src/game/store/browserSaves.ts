type SaveMode = "solo" | "multi";
type Save = { v: 1; id: string; savedAt: number; label?: string; state: unknown };
const PREFIX = "carcassonne.saves.v2.";

// One key per save prevents separate tabs from overwriting each other's lists.
// Inject storage in tests; production storage belongs exclusively to this browser/origin.
export function createBrowserSaves(getStorage: () => Storage) {
  function key(mode: SaveMode, id: string) { return `${PREFIX}${mode}.${id}`; }
  function read(raw: string | null): Save | null {
    if (!raw) return null;
    try {
      const value = JSON.parse(raw) as Partial<Save> | null;
      if (!value || value.v !== 1 || typeof value.id !== "string" || typeof value.savedAt !== "number" || !value.state || typeof value.state !== "object") return null;
      return value as Save;
    } catch { return null; }
  }
  return {
    save(mode: SaveMode, state: unknown, label?: string) {
      // randomUUID is unavailable on some plain HTTP LAN origins.
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      const id = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
      const save: Save = { v: 1, id, savedAt: Date.now(), label, state };
      getStorage().setItem(key(mode, id), JSON.stringify(save));
      return id;
    },
    list(mode: SaveMode) {
      const storage = getStorage();
      const saves: Array<{ id: string; savedAt: number; label?: string }> = [];
      for (let i = 0; i < storage.length; i++) {
        const name = storage.key(i);
        if (!name?.startsWith(`${PREFIX}${mode}.`)) continue;
        const save = read(storage.getItem(name));
        if (save && name === key(mode, save.id)) saves.push({ id: save.id, savedAt: save.savedAt, label: save.label });
      }
      return saves.sort((a, b) => b.savedAt - a.savedAt);
    },
    load(mode: SaveMode, id: string) { return read(getStorage().getItem(key(mode, id))); },
    delete(mode: SaveMode, id: string) { getStorage().removeItem(key(mode, id)); },
  };
}

export const browserSaves = createBrowserSaves(() => {
  if (typeof window === "undefined") throw new Error("Збереження доступні лише у браузері.");
  return window.localStorage;
});
