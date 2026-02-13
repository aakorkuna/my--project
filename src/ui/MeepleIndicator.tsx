"use client";

import React from "react";
import { Canvas } from "@react-three/fiber";
import { MeepleMesh } from "../scene/components/MeepleMesh";

export function MeepleIndicator(props: { count: number; color?: string; className?: string }) {
  const { count, color = "#2b6cff" } = props;

  // Render remaining meeples as small 3D models (single color).
  const items = Array.from({ length: Math.max(0, count) });
  const startX = -((items.length - 1) * 0.33) / 2;

  return (
    <div className={props.className} style={{ width: 360, height: 84, pointerEvents: "none" }}>
      <Canvas
        orthographic
        gl={{ alpha: true, antialias: true }}
        camera={{ position: [0, 1.8, 5], zoom: 120 }}
        style={{ width: "100%", height: "100%", background: "transparent" }}
      >
        <ambientLight intensity={0.9} />
        <directionalLight position={[3, 6, 4]} intensity={1.0} />

        <group position={[startX, -0.12, 0]}>
          {items.map((_, i) => (
            <MeepleMesh
              key={i}
              color={color}
              scale={1.0}
              position={[i * 0.33, 0, 0]}
            />
          ))}
        </group>
      </Canvas>
    </div>
  );
}
