"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Cinzel_Decorative } from "next/font/google";
import { useGameStore } from "../src/game/store/useGameStore";

const carcTitle = Cinzel_Decorative({
  subsets: ["latin"],
  weight: ["700"],
});

export default function Page() {
  const router = useRouter();
  const [soloMenuOpen, setSoloMenuOpen] = React.useState(false);
  const listGameFiles = useGameStore((s) => s.listGameFiles);
  const deleteGameFile = useGameStore((s) => s.deleteGameFile);

  const [rulesMenuOpen, setRulesMenuOpen] = React.useState(false);
  const [rulesStep, setRulesStep] = React.useState<"choose" | "site">("choose");
  const [rulesLang, setRulesLang] = React.useState<"uk" | "en">("uk");

  const [savesOpen, setSavesOpen] = React.useState(false);
  const [saves, setSaves] = React.useState<Array<{ id: string; savedAt: number; label?: string }>>([]);
  const [savesLoading, setSavesLoading] = React.useState(false);
  const [savesErr, setSavesErr] = React.useState<string | null>(null);
  const [hoveredSaveId, setHoveredSaveId] = React.useState<string | null>(null);

  const [multiMenuOpen, setMultiMenuOpen] = React.useState(false);
  const [multiStep, setMultiStep] = React.useState<"choose" | "offline">("choose");

  const [multiSavesOpen, setMultiSavesOpen] = React.useState(false);
  const [multiSaves, setMultiSaves] = React.useState<Array<{ id: string; savedAt: number; label?: string }>>([]);
  const [multiSavesLoading, setMultiSavesLoading] = React.useState(false);
  const [multiSavesErr, setMultiSavesErr] = React.useState<string | null>(null);
  const [multiHoveredSaveId, setMultiHoveredSaveId] = React.useState<string | null>(null);

  const [playersModalOpen, setPlayersModalOpen] = React.useState(false);
  const [playersCount, setPlayersCount] = React.useState("2");
  const [playersErr, setPlayersErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!soloMenuOpen) {
      setSavesOpen(false);
      setSavesErr(null);
      setSaves([]);
    }
  }, [soloMenuOpen]);

  React.useEffect(() => {
    if (!rulesMenuOpen) {
      setRulesStep("choose");
      setRulesLang("uk");
    }
  }, [rulesMenuOpen]);

  React.useEffect(() => {
    if (!multiMenuOpen) {
      setMultiStep("choose");
      setPlayersModalOpen(false);
      setPlayersErr(null);
      setMultiSavesOpen(false);
      setMultiSavesErr(null);
      setMultiSaves([]);
      setMultiHoveredSaveId(null);
    }
  }, [multiMenuOpen]);

  React.useEffect(() => {
    if (multiStep !== "offline") {
      setMultiSavesOpen(false);
      setMultiSavesErr(null);
      setMultiSaves([]);
      setMultiHoveredSaveId(null);
    }
  }, [multiStep]);

  async function refreshSaves() {
    setSavesLoading(true);
    setSavesErr(null);
    const res = await listGameFiles("solo");
    if (!res.ok) {
      setSavesErr(res.reason ?? "Не вдалося отримати сейви");
      setSaves([]);
      setSavesLoading(false);
      return;
    }
    setSaves(res.saves ?? []);
    setSavesLoading(false);
  }

  async function refreshMultiSaves() {
    setMultiSavesLoading(true);
    setMultiSavesErr(null);
    const res = await listGameFiles("multi");
    if (!res.ok) {
      setMultiSavesErr(res.reason ?? "Не вдалося отримати сейви");
      setMultiSaves([]);
      setMultiSavesLoading(false);
      return;
    }
    setMultiSaves(res.saves ?? []);
    setMultiSavesLoading(false);
  }

  return (
    <main className="scroll-home scroll-wrap">
      <div className="scroll-scene" aria-hidden="true">
        <img className="scroll-scene__img" src="/teory.jpg" alt="" />
      </div>

      <div className="carc-bg-title" aria-hidden="true">
        <div className={`${carcTitle.className} carc-engraved`}>
          <span className="carc-c">C</span>
          <span className="carc-rest">ARCASSONNE</span>
        </div>
      </div>

      <div className="w-full max-w-xl relative">
        <section className="scroll-panel" aria-label="Main Menu">
          <span className="scroll-rod scroll-rod--top" aria-hidden="true"></span>
          <span className="scroll-rod scroll-rod--bottom" aria-hidden="true"></span>

          <div className="scroll-panel-head">
            <div className={`scroll-panel-title ${carcTitle.className}`}>MAIN MENU</div>
          </div>

          {!soloMenuOpen && !multiMenuOpen && !rulesMenuOpen ? (
            <div className="scroll-grid">
              <Link
                href="/tiles"
                className="scroll-btn"
              >
                Test (Tiles List)
              </Link>

              <button
                type="button"
                onClick={() => setSoloMenuOpen(true)}
                className="scroll-btn scroll-btn--primary"
              >
                Try Solo
              </button>

              <button
                type="button"
                onClick={() => {
                  setMultiStep("choose");
                  setMultiMenuOpen(true);
                }}
                className="scroll-btn scroll-btn--gem"
              >
                Multiplayer
              </button>

              <button
                type="button"
                onClick={() => setRulesMenuOpen(true)}
                className="scroll-btn"
              >
                Rules
              </button>
            </div>
          ) : rulesMenuOpen ? (
            rulesStep === "choose" ? (
              <div className="scroll-grid">
                <button
                  type="button"
                  onClick={() => setRulesMenuOpen(false)}
                  className="scroll-btn"
                >
                  Back
                </button>

                <button
                  type="button"
                  onClick={() => setRulesStep("site")}
                  className="scroll-btn"
                >
                  Site Rules
                </button>

                <a
                  href="https://desktopgames.com.ua/games/6455/%D0%9A%D0%B0%D1%80%D0%BA%D0%B0%D1%81%D0%BE%D0%BD_%D0%BF%D1%80%D0%B0%D0%B2%D0%B8%D0%BB%D0%B0.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="scroll-btn"
                >
                  Game Rules (PDF)
                </a>
              </div>
            ) : (
              <div className="scroll-grid">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setRulesStep("choose")}
                    className="scroll-btn flex-1"
                  >
                    Back
                  </button>

                  <button
                    type="button"
                    onClick={() => setRulesLang((l) => (l === "uk" ? "en" : "uk"))}
                    className="scroll-btn"
                    aria-label="Toggle language"
                    title="Toggle language"
                  >
                    {rulesLang === "uk" ? "EN" : "UA"}
                  </button>
                </div>

                <div className="scroll-card">
                  <div className="text-lg font-semibold">{rulesLang === "uk" ? "Правила сайту" : "Site rules"}</div>
                  <div className="text-sm opacity-80 mt-1">
                    {rulesLang === "uk"
                      ? "Коротка інструкція, як користуватись сайтом та керувати грою."
                      : "A quick guide on how to use the site and control the game."}
                  </div>

                  <div className="mt-4 max-h-[55vh] overflow-auto pr-1 text-sm leading-relaxed">
                    {rulesLang === "uk" ? (
                      <div className="grid gap-4">
                        <div>
                          <div className="font-semibold">Навігація</div>
                          <div className="opacity-90">
                            - Головне меню: Solo / Multiplayer / Rules.
                            <br />
                            - Кнопка Back повертає назад.
                          </div>
                        </div>

                        <div>
                          <div className="font-semibold">Керування тайлами</div>
                          <div className="opacity-90">
                            - Повернути активний тайл: клавіша <span className="font-semibold">R</span> або кнопка Rotate.
                            <br />
                            - Поставити тайл: клікни по підсвіченій порожній клітинці.
                          </div>
                        </div>

                        <div>
                          <div className="font-semibold">Дяпчики (meeples)</div>
                          <div className="opacity-90">
                            - Після постановки тайла гра може запропонувати поставити дяпчика на цей тайл.
                            <br />
                            - Щоб пропустити дяпчика: <span className="font-semibold">Esc</span> або кнопка Next (в мультиплеєрі).
                          </div>
                        </div>

                        <div>
                          <div className="font-semibold">Режими гри</div>
                          <div className="opacity-90">
                            - Solo: граєш сам.
                            <br />
                            - Multiplayer Offline: кілька гравців на одному комп’ютері, ходи по черзі.
                            <br />
                            - Multiplayer Online (LAN): один комп’ютер запускає сервер, інші заходять по посиланню в браузері.
                          </div>
                        </div>

                        <div>
                          <div className="font-semibold">Online (LAN) кімнати</div>
                          <div className="opacity-90">
                            - Create room: створити кімнату та отримати код.
                            <br />
                            - Join room: приєднатись по коду або зі списку Open lobbies.
                            <br />
                            - Start: запускає гру (тільки хост).
                          </div>
                        </div>

                        <div>
                          <div className="font-semibold">Сейви</div>
                          <div className="opacity-90">
                            - Solo та Multiplayer мають окремі списки сейвів.
                            <br />
                            - У списку сейвів можна завантажити або видалити сейв.
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-4">
                        <div>
                          <div className="font-semibold">Navigation</div>
                          <div className="opacity-90">
                            - Main menu: Solo / Multiplayer / Rules.
                            <br />
                            - Back returns to the previous screen.
                          </div>
                        </div>

                        <div>
                          <div className="font-semibold">Tile controls</div>
                          <div className="opacity-90">
                            - Rotate the active tile: press <span className="font-semibold">R</span> or use the Rotate button.
                            <br />
                            - Place a tile: click a highlighted empty cell.
                          </div>
                        </div>

                        <div>
                          <div className="font-semibold">Meeples</div>
                          <div className="opacity-90">
                            - After placing a tile, the game may allow you to place a meeple on that tile.
                            <br />
                            - Skip meeple placement: press <span className="font-semibold">Esc</span> or use Next (multiplayer).
                          </div>
                        </div>

                        <div>
                          <div className="font-semibold">Game modes</div>
                          <div className="opacity-90">
                            - Solo: play alone.
                            <br />
                            - Multiplayer Offline: multiple players on one computer, taking turns.
                            <br />
                            - Multiplayer Online (LAN): one computer hosts, others join via a browser link.
                          </div>
                        </div>

                        <div>
                          <div className="font-semibold">Online (LAN) rooms</div>
                          <div className="opacity-90">
                            - Create room: create a room and get a code.
                            <br />
                            - Join room: join by code or from Open lobbies.
                            <br />
                            - Start: starts the game (host only).
                          </div>
                        </div>

                        <div>
                          <div className="font-semibold">Saves</div>
                          <div className="opacity-90">
                            - Solo and Multiplayer have separate save lists.
                            <br />
                            - In the save list you can load or delete a save.
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          ) : soloMenuOpen ? (
            !savesOpen ? (
              <div className="scroll-grid">
                <button
                  type="button"
                  onClick={() => setSoloMenuOpen(false)}
                  className="scroll-btn"
                >
                  Back
                </button>

                <Link
                  href="/solo"
                  className="scroll-btn scroll-btn--primary"
                >
                  New Game
                </Link>

                <button
                  type="button"
                  onClick={async () => {
                    setSavesOpen(true);
                    await refreshSaves();
                  }}
                  className="scroll-btn scroll-btn--gem"
                >
                  Save
                </button>
              </div>
            ) : (
              <div className="scroll-grid">
                <button
                  type="button"
                  onClick={() => {
                    setSavesOpen(false);
                    setHoveredSaveId(null);
                  }}
                  className="scroll-btn"
                >
                  Back
                </button>

                {savesLoading && (
                  <div className="scroll-note">
                    Loading saves…
                  </div>
                )}

                {!savesLoading && savesErr && (
                  <div className="scroll-note text-red-400">
                    {savesErr}
                  </div>
                )}

                {!savesLoading && !savesErr && saves.length === 0 && (
                  <div className="scroll-note">
                    Немає сейвів.
                  </div>
                )}

                {!savesLoading && !savesErr && saves.length > 0 && (
                  <div className="grid gap-2">
                    {saves.map((s) => {
                      const label = s.label?.trim() ? s.label : new Date(s.savedAt).toLocaleString();
                      const hovered = hoveredSaveId === s.id;

                      return (
                        <div
                          key={s.id}
                          className="relative"
                          onMouseEnter={() => setHoveredSaveId(s.id)}
                          onMouseLeave={() => setHoveredSaveId((cur) => (cur === s.id ? null : cur))}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              router.push(`/solo?fileSave=${encodeURIComponent(s.id)}&fileSaveMode=solo`);
                            }}
                            className={hovered ? "scroll-btn scroll-btn--list scroll-btn--hover" : "scroll-btn scroll-btn--list"}
                          >
                            <div className="pr-10">{label}</div>
                          </button>

                          {hovered && (
                            <button
                              type="button"
                              onClick={async () => {
                                const res = await deleteGameFile(s.id, "solo");
                                if (!res.ok) {
                                  setSavesErr(res.reason ?? "Не вдалося видалити сейв");
                                  return;
                                }
                                if (hoveredSaveId === s.id) setHoveredSaveId(null);
                                await refreshSaves();
                              }}
                              className="absolute top-2 right-2 rounded-lg border border-red-500/40 bg-background/70 px-2 py-1 text-red-500"
                              aria-label="Delete save"
                              title="Delete"
                            >
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  d="M9 3h6m-8 4h10m-9 0 1 14h6l1-14M10 11v7m4-7v7"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )
          ) : (
            <div className="scroll-grid">
              {multiStep === "choose" ? (
                <>
                  <button
                    type="button"
                    onClick={() => setMultiMenuOpen(false)}
                    className="scroll-btn"
                  >
                    Back
                  </button>

                  <button
                    type="button"
                    onClick={() => router.push("/online")}
                    className="scroll-btn scroll-btn--gem"
                  >
                    Online
                  </button>

                  <button
                    type="button"
                    onClick={() => setMultiStep("offline")}
                    className="scroll-btn scroll-btn--primary"
                  >
                    Offline
                  </button>
                </>
              ) : (
                <>
                  {!multiSavesOpen ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setMultiStep("choose")}
                        className="scroll-btn"
                      >
                        Back
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPlayersErr(null);
                          setPlayersCount("2");
                          setPlayersModalOpen(true);
                        }}
                        className="scroll-btn scroll-btn--primary"
                      >
                        New Game
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          setMultiSavesOpen(true);
                          await refreshMultiSaves();
                        }}
                        className="scroll-btn scroll-btn--gem"
                      >
                        Save
                      </button>
                    </>
                  ) : (
                    <div className="scroll-grid">
                      <button
                        type="button"
                        onClick={() => {
                          setMultiSavesOpen(false);
                          setMultiHoveredSaveId(null);
                        }}
                        className="scroll-btn"
                      >
                        Back
                      </button>

                      {multiSavesLoading && (
                        <div className="scroll-note">
                          Loading saves…
                        </div>
                      )}

                      {!multiSavesLoading && multiSavesErr && (
                        <div className="scroll-note text-red-400">
                          {multiSavesErr}
                        </div>
                      )}

                      {!multiSavesLoading && !multiSavesErr && multiSaves.length === 0 && (
                        <div className="scroll-note">
                          Немає сейвів.
                        </div>
                      )}

                      {!multiSavesLoading && !multiSavesErr && multiSaves.length > 0 && (
                        <div className="grid gap-2">
                          {multiSaves.map((s) => {
                            const label = s.label?.trim() ? s.label : new Date(s.savedAt).toLocaleString();
                            const hovered = multiHoveredSaveId === s.id;

                            return (
                              <div
                                key={s.id}
                                className="relative"
                                onMouseEnter={() => setMultiHoveredSaveId(s.id)}
                                onMouseLeave={() => setMultiHoveredSaveId((cur) => (cur === s.id ? null : cur))}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    router.push(`/solo?fileSave=${encodeURIComponent(s.id)}&fileSaveMode=multi`);
                                  }}
                                  className={hovered ? "scroll-btn scroll-btn--list scroll-btn--hover" : "scroll-btn scroll-btn--list"}
                                >
                                  <div className="pr-10">{label}</div>
                                </button>

                                {hovered && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const res = await deleteGameFile(s.id, "multi");
                                      if (!res.ok) {
                                        setMultiSavesErr(res.reason ?? "Не вдалося видалити сейв");
                                        return;
                                      }
                                      if (multiHoveredSaveId === s.id) setMultiHoveredSaveId(null);
                                      await refreshMultiSaves();
                                    }}
                                    className="absolute top-2 right-2 rounded-lg border border-red-500/40 bg-background/70 px-2 py-1 text-red-500"
                                    aria-label="Delete save"
                                    title="Delete"
                                  >
                                    <svg
                                      width="16"
                                      height="16"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <path
                                        d="M9 3h6m-8 4h10m-9 0 1 14h6l1-14M10 11v7m4-7v7"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

        </section>
        </div>

      {playersModalOpen && (
        <div className="fixed inset-0 z-20 flex items-center justify-center p-3">
          <div className="absolute inset-0 bg-black/40" />

          <div className="relative scroll-dialog">
            <div className="text-lg font-semibold">Нова офлайн гра</div>
            <div className="text-sm opacity-80 mt-1">Введіть кількість гравців від 1 до 5</div>

            <form
              className="mt-4 grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                const n = Number(playersCount);
                if (!Number.isFinite(n) || n < 1 || n > 5) {
                  setPlayersErr("Кількість гравців має бути від 1 до 5");
                  return;
                }
                setPlayersModalOpen(false);
                setPlayersErr(null);
                router.push(`/solo?players=${encodeURIComponent(String(n))}`);
              }}
            >
              <input
                autoFocus
                inputMode="numeric"
                value={playersCount}
                onChange={(e) => {
                  setPlayersErr(null);
                  setPlayersCount(e.target.value);
                }}
                placeholder="2"
                className="scroll-input"
              />

              {playersErr && <div className="text-sm text-red-400">{playersErr}</div>}

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPlayersModalOpen(false);
                    setPlayersErr(null);
                  }}
                  className="scroll-btn"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="scroll-btn scroll-btn--primary"
                >
                  Start
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
