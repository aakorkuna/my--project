"use client";

import React from "react";
import Link from "next/link";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

import { TILESET } from "../../src/game/model/tileset";
import { TileMesh } from "../../src/scene/components/TileMesh";

function TilesCanvas() {
  const defs = React.useMemo(
    () => Object.values(TILESET).slice().sort((a, b) => a.id.localeCompare(b.id)),
    []
  );

  const cols = 4;
  const spacing = 1.35;
  const rows = Math.ceil(defs.length / cols);
  const xOffset = ((Math.min(cols, defs.length) - 1) * spacing) / 2;
  const zOffset = ((rows - 1) * spacing) / 2;

  return (
    <Canvas
      shadows
      camera={{ position: [0, 8, 8], fov: 45 }}
      style={{ width: "100%", height: "75vh", borderRadius: 12, border: "1px solid #333" }}
    >
      <color attach="background" args={["#0e0e11"]} />

      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />

      <OrbitControls makeDefault />

      {defs.map((def, i) => {
        const c = i % cols;
        const r = Math.floor(i / cols);
        const x = c * spacing - xOffset;
        const z = r * spacing - zOffset;

        return <TileMesh key={def.id} def={def} rotation={0} position={[x, 0.06, z]} />;
      })}
    </Canvas>
  );
}

export default function TilesPage() {
  const defs = React.useMemo(
    () => Object.values(TILESET).slice().sort((a, b) => a.id.localeCompare(b.id)),
    []
  );

  const totalTiles = React.useMemo(() => {
    // Keep consistent with buildInitialDeck(): default weight=1, floored, clamped >=0
    return defs.reduce((sum, d) => sum + Math.max(0, Math.floor(d.weight ?? 1)), 0);
  }, [defs]);

  return (
    <main style={{ padding: 18, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <Link
          href="/"
          style={{
            padding: "8px 12px",
            border: "1px solid #444",
            borderRadius: 10,
            textDecoration: "none",
            color: "inherit",
            display: "inline-block",
          }}
        >
          ← Back
        </Link>

        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Tiles</h1>
      </div>
      <div style={{ marginBottom: 10, opacity: 0.9 }}>All tile types from TILESET.</div>

      <TilesCanvas />

      <div style={{ marginTop: 14 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>List</h2>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
          {defs.map((d) => (
            <li key={d.id}>
              <b>{d.id}</b>
              {d.label ? ` — ${d.label}` : ""}
              {typeof d.weight === "number" ? ` (weight: ${d.weight})` : ""}
            </li>
          ))}
        </ul>

        <div style={{ marginTop: 10, fontWeight: 700 }}>
          Total tiles (sum of weights): {totalTiles}
        </div>
      </div>
    </main>
  );
}
