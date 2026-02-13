"use client";

import React from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useGameStore } from "../../game/store/useGameStore";
import { TILESET } from "../../game/model/tileset";
import { getVisibleEmptyCells } from "../../game/logic/placement";
import { TileMesh } from "./TileMesh";
import { EmptyCell } from "./EmptyCell";

export function BoardScene(props: {
  onMessage: (msg: string, isError?: boolean) => void;
  api?: {
    tryPlace?: (x: number, y: number) => { ok: boolean; reason?: string };
    placeMeeple?: (x: number, y: number, feature: any) => { ok: boolean; reason?: string };
  };
}) {
  const board = useGameStore((s) => s.board);
  const active = useGameStore((s) => s.active);
  const tryPlace = useGameStore((s) => s.tryPlace);
  const meeples = useGameStore((s) => s.meeples);
  const meepleTarget = useGameStore((s) => s.meepleTarget);
  const placeMeeple = useGameStore((s) => s.placeMeeple);

  const tryPlaceFn = props.api?.tryPlace ?? tryPlace;
  const placeMeepleFn = props.api?.placeMeeple ?? placeMeeple;

  const [hover, setHover] = React.useState<{ x: number; y: number } | null>(null);

  const empties = React.useMemo(() => getVisibleEmptyCells(board), [board]);

  const meeplesByKey = React.useMemo(() => {
    const m = new Map<string, typeof meeples>();
    for (const p of meeples) {
      const k = `${p.x},${p.y}`;
      const cur = m.get(k);
      if (cur) cur.push(p);
      else m.set(k, [p]);
    }
    return m;
  }, [meeples]);

  const ghostDef = React.useMemo(() => {
    if (!active) return null;
    return TILESET[active.tileId] ?? null;
  }, [active]);

  return (
      <Canvas shadows camera={{ position: [3.5, 6, 3.5], fov: 45 }} style={{ width: "100%", height: "100%" }}>
        <color attach="background" args={["#0a0a0a"]} />

      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />
      <OrbitControls makeDefault />

      {/* Ground (optional) */}
      {/*
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial />
      </mesh>
      */}

      {/* Placed tiles */}
      {Object.values(board).map((t) => {
        const def = TILESET[t.tileId];
        if (!def) return null;
        const isTarget = Boolean(meepleTarget && meepleTarget.x === t.x && meepleTarget.y === t.y);
        const tileMeeples = meeplesByKey.get(`${t.x},${t.y}`) ?? [];
        return (
          <TileMesh
            key={`${t.x},${t.y}`}
            def={def}
            rotation={t.rotation}
            position={[t.x, 0.06, t.y]}
            tileX={t.x}
            tileY={t.y}
            meeples={tileMeeples}
            isMeepleTarget={isTarget}
            onMeepleFeatureClick={(feature) => {
              const res = placeMeepleFn(t.x, t.y, feature);
              props.onMessage(res.ok ? "Meeple placed." : `Cannot place meeple: ${res.reason}`, !res.ok);
            }}
          />
        );
      })}

      {active && hover && ghostDef && (
        <TileMesh
          def={ghostDef}
          rotation={active.rotation}
          position={[hover.x, 0.12, hover.y]}
          opacity={0.45}
        />
      )}

      {/* Empty cells to click (8-neighborhood visibility) */}
      {active &&
        empties.map((c) => (
          <EmptyCell
            key={`${c.x},${c.y}`}
            x={c.x}
            y={c.y}
            onHover={(x, y) => setHover({ x, y })}
            onUnhover={() => setHover(null)}
            onClick={(x, y) => {
              const res = tryPlaceFn(x, y);
              props.onMessage(
                res.ok ? `Placed at (${x},${y}). Drew next tile.` : `Cannot place: ${res.reason}`,
                !res.ok
              );

              setHover(null);
            }}
          />
        ))}
      </Canvas>
  );
}
