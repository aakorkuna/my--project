import React from "react";
import * as THREE from "three";
import type { MeepleFeature, MeeplePlacement, TileDefinition, Rotation, EdgeDir } from "../../game/model/types";
import { rotateDir, rotateEdges } from "../../game/logic/rotate";
import { MeepleMesh } from "./MeepleMesh";
import { CastleWall, House, MedievalRoad, Monastery, Tower, Tree } from "./TileScenery";

const TILE_SIZE = 1;
const HALF = TILE_SIZE / 2;

// heights
const BASE_THICKNESS = 0.08;
const CITY_HEIGHT = 0.05;
const WALL_HEIGHT = 0.08;

// thicknesses
const WALL_THICKNESS = 0.04;
const ROAD_THICKNESS = 0.02;
const DIR_ANGLE: Record<EdgeDir, number> = { N: 0, E: -Math.PI / 2, S: Math.PI, W: Math.PI / 2 };

function makeShieldGeometry(width: number, height: number, depth: number): THREE.BufferGeometry {
  // 2D shield silhouette in the X/Y plane, then extruded along +Z.
  // We'll rotate it later so it sits flat on the tile.
  const w = width;
  const h = height;

  const shape = new THREE.Shape();
  // Start near top-left, go clockwise
  shape.moveTo(-w * 0.45, h * 0.45);
  shape.quadraticCurveTo(0, h * 0.6, w * 0.45, h * 0.45);
  shape.lineTo(w * 0.42, h * 0.05);
  shape.quadraticCurveTo(w * 0.38, -h * 0.25, 0, -h * 0.55);
  shape.quadraticCurveTo(-w * 0.38, -h * 0.25, -w * 0.42, h * 0.05);
  shape.lineTo(-w * 0.45, h * 0.45);

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    steps: 1,
  });
  geom.center();
  geom.computeVertexNormals();
  return geom;
}

const SHIELD_GEOM = makeShieldGeometry(0.16, 0.2, 0.02);

function cityTriangleCorners(dir: EdgeDir): { a: { x: number; z: number }; b: { x: number; z: number } } {
  switch (dir) {
    case "N":
      return { a: { x: -HALF, z: -HALF }, b: { x: HALF, z: -HALF } };
    case "E":
      return { a: { x: HALF, z: -HALF }, b: { x: HALF, z: HALF } };
    case "S":
      return { a: { x: HALF, z: HALF }, b: { x: -HALF, z: HALF } };
    case "W":
      return { a: { x: -HALF, z: HALF }, b: { x: -HALF, z: -HALF } };
  }
}

type WallSeg = {
  pos: [number, number, number];
  rotY: number;
  size: [number, number, number]; // [thicknessX, heightY, lengthZ]
};

function wallBetween(
  a: { x: number; z: number },
  b: { x: number; z: number },
  y: number,
  thickness: number,
  height: number
): WallSeg {
  const mx = (a.x + b.x) / 2;
  const mz = (a.z + b.z) / 2;

  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.sqrt(dx * dx + dz * dz);

  // box length is along local Z, so rotate around Y to match direction
  const rotY = Math.atan2(dx, dz);

  return {
    pos: [mx, y, mz],
    rotY,
    size: [thickness, height, len],
  };
}

function makeTriangleExtrude(dir: EdgeDir, height: number) {
  // 2D plane is (x,z) -> Vector2(x,-z), then extruded and rotated so depth becomes +Y
  const shape = new THREE.Shape();
  const center = new THREE.Vector2(0, 0);

  const { a, b } = cityTriangleCorners(dir);
  const av = new THREE.Vector2(a.x, -a.z);
  const bv = new THREE.Vector2(b.x, -b.z);

  shape.moveTo(center.x, center.y);
  shape.lineTo(av.x, av.y);
  shape.lineTo(bv.x, bv.y);
  shape.lineTo(center.x, center.y);

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
    steps: 1,
  });

  // ExtrudeGeometry extrudes along +Z. Rotate so extrusion becomes +Y.
  geom.rotateX(-Math.PI / 2);
  geom.computeVertexNormals();
  return geom;
}

const TRI_GEOMS = {
  N: makeTriangleExtrude("N", CITY_HEIGHT),
  E: makeTriangleExtrude("E", CITY_HEIGHT),
  S: makeTriangleExtrude("S", CITY_HEIGHT),
  W: makeTriangleExtrude("W", CITY_HEIGHT),
} satisfies Record<EdgeDir, THREE.BufferGeometry>;

function makeTriangleExtrudeWithHub(dir: EdgeDir, hub: { x: number; z: number }, height: number) {
  const shape = new THREE.Shape();
  const center = new THREE.Vector2(hub.x, -hub.z);

  const { a, b } = cityTriangleCorners(dir);
  const av = new THREE.Vector2(a.x, -a.z);
  const bv = new THREE.Vector2(b.x, -b.z);

  shape.moveTo(center.x, center.y);
  shape.lineTo(av.x, av.y);
  shape.lineTo(bv.x, bv.y);
  shape.lineTo(center.x, center.y);

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
    steps: 1,
  });

  geom.rotateX(-Math.PI / 2);
  geom.computeVertexNormals();
  return geom;
}

function hubForGroup(group: EdgeDir[]): { x: number; z: number } {
  // If multiple city edges are connected, use the true center.
  if (group.length >= 2) return { x: 0, z: 0 };

  // Single-edge city segments are pulled slightly towards their edge
  // to visually avoid merging when there are disconnected segments.
  const o = 0.18;
  switch (group[0]) {
    case "N":
      return { x: 0, z: -o };
    case "S":
      return { x: 0, z: o };
    case "E":
      return { x: o, z: 0 };
    case "W":
      return { x: -o, z: 0 };
  }
}

const CITY_OPPOSITE_CONNECTED_IDS = new Set<TileDefinition["id"]>([
  "city_opposite_connected",
  "city_opposite_connected_shield",
]);

const CITY_HUB_HALF_OPPOSITE_CONNECTED = 0.18;

function hubRectSidePoints(
  dir: EdgeDir,
  hub: { x: number; z: number },
  half: number
): { a: { x: number; z: number }; b: { x: number; z: number } } {
  switch (dir) {
    case "N":
      return { a: { x: hub.x - half, z: hub.z - half }, b: { x: hub.x + half, z: hub.z - half } };
    case "E":
      return { a: { x: hub.x + half, z: hub.z - half }, b: { x: hub.x + half, z: hub.z + half } };
    case "S":
      return { a: { x: hub.x + half, z: hub.z + half }, b: { x: hub.x - half, z: hub.z + half } };
    case "W":
      return { a: { x: hub.x - half, z: hub.z + half }, b: { x: hub.x - half, z: hub.z - half } };
  }
}

const CITY_STRIP_CACHE = new Map<string, THREE.BufferGeometry>();

function cityStripKey(dir: EdgeDir, half: number): string {
  return `${dir}|${half.toFixed(3)}`;
}

function getCityStripGeom(dir: EdgeDir, hubHalf: number, height: number): THREE.BufferGeometry {
  // hub is always centered for these tiles
  const key = cityStripKey(dir, hubHalf);
  const cached = CITY_STRIP_CACHE.get(key);
  if (cached) return cached;

  const hub = { x: 0, z: 0 };
  const { a: edgeA, b: edgeB } = cityTriangleCorners(dir);
  const { a: hubA, b: hubB } = hubRectSidePoints(dir, hub, hubHalf);

  // Quad from hub-side -> edge-side; this fills the center gap so connectivity is visually obvious.
  const shape = new THREE.Shape();
  shape.moveTo(hubA.x, -hubA.z);
  shape.lineTo(edgeA.x, -edgeA.z);
  shape.lineTo(edgeB.x, -edgeB.z);
  shape.lineTo(hubB.x, -hubB.z);
  shape.closePath();

  const geom = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, steps: 1 });
  // ExtrudeGeometry extrudes along +Z. Rotate so extrusion becomes +Y.
  geom.rotateX(-Math.PI / 2);
  geom.computeVertexNormals();

  CITY_STRIP_CACHE.set(key, geom);
  return geom;
}

function cityCornerPoint(corner: "NW" | "NE" | "SE" | "SW"): { x: number; z: number } {
  switch (corner) {
    case "NW":
      return { x: -HALF, z: -HALF };
    case "NE":
      return { x: HALF, z: -HALF };
    case "SE":
      return { x: HALF, z: HALF };
    case "SW":
      return { x: -HALF, z: HALF };
  }
}

function wallsForCityGroup(group: EdgeDir[], hub: { x: number; z: number }, y: number, thickness: number, height: number): WallSeg[] {
  const hasN = group.includes("N");
  const hasE = group.includes("E");
  const hasS = group.includes("S");
  const hasW = group.includes("W");

  const out: WallSeg[] = [];

  // A corner diagonal is part of the outer perimeter only when exactly one
  // of its adjacent edges belongs to this connected city group.
  // This removes walls between connected city edges and removes all walls
  // for the full-city tile.
  if (hasN !== hasW) out.push(wallBetween(hub, cityCornerPoint("NW"), y, thickness, height));
  if (hasN !== hasE) out.push(wallBetween(hub, cityCornerPoint("NE"), y, thickness, height));
  if (hasS !== hasE) out.push(wallBetween(hub, cityCornerPoint("SE"), y, thickness, height));
  if (hasS !== hasW) out.push(wallBetween(hub, cityCornerPoint("SW"), y, thickness, height));

  return out;
}

function wallsForOppositeConnectedCity(group: EdgeDir[], y: number, thickness: number, height: number): WallSeg[] {
  const hasN = group.includes("N");
  const hasE = group.includes("E");
  const hasS = group.includes("S");
  const hasW = group.includes("W");

  // These two tiles have a single connected city spanning opposite edges.
  // We outline the connected shape: short hub-edge walls + diagonals to the outer corners.
  const h = CITY_HUB_HALF_OPPOSITE_CONNECTED;

  // City on E+W (connected)
  if (hasE && hasW && !hasN && !hasS) {
    return [
      // short hub top/bottom edges (city vs land)
      wallBetween({ x: -h, z: -h }, { x: h, z: -h }, y, thickness, height),
      wallBetween({ x: -h, z: h }, { x: h, z: h }, y, thickness, height),

      // diagonals from hub corners to outer corners
      wallBetween({ x: -h, z: -h }, { x: -HALF, z: -HALF }, y, thickness, height),
      wallBetween({ x: -h, z: h }, { x: -HALF, z: HALF }, y, thickness, height),
      wallBetween({ x: h, z: -h }, { x: HALF, z: -HALF }, y, thickness, height),
      wallBetween({ x: h, z: h }, { x: HALF, z: HALF }, y, thickness, height),
    ];
  }

  // City on N+S (connected)
  if (hasN && hasS && !hasE && !hasW) {
    return [
      // short hub left/right edges (city vs land)
      wallBetween({ x: -h, z: -h }, { x: -h, z: h }, y, thickness, height),
      wallBetween({ x: h, z: -h }, { x: h, z: h }, y, thickness, height),

      // diagonals from hub corners to outer corners
      wallBetween({ x: -h, z: -h }, { x: -HALF, z: -HALF }, y, thickness, height),
      wallBetween({ x: h, z: -h }, { x: HALF, z: -HALF }, y, thickness, height),
      wallBetween({ x: -h, z: h }, { x: -HALF, z: HALF }, y, thickness, height),
      wallBetween({ x: h, z: h }, { x: HALF, z: HALF }, y, thickness, height),
    ];
  }

  // Fallback (shouldn't happen for the intended tiles)
  return wallsForCityGroup(group, { x: 0, z: 0 }, y, thickness, height);
}

export function TileMesh(props: {
  def: TileDefinition;
  rotation: Rotation;
  position: [number, number, number];
  opacity?: number;
  tileX?: number;
  tileY?: number;
  meeples?: MeeplePlacement[];
  isMeepleTarget?: boolean;
  onMeepleFeatureClick?: (feature: MeepleFeature) => void;
}) {
  const {
    def,
    rotation,
    position,
    opacity = 1,
    meeples = [],
    isMeepleTarget = false,
    onMeepleFeatureClick,
  } = props;
  const edges = rotateEdges(def.edges, rotation);

  const cityDirsBase = (["N", "E", "S", "W"] as const).filter((d) => def.edges[d].terrain === "city");
  const cityGroupsBase = def.cityGroups && def.cityGroups.length > 0 ? def.cityGroups : cityDirsBase.length > 0 ? [cityDirsBase] : [];
  const cityGroups = cityGroupsBase
    .map((g) => g.map((d) => rotateDir(d, rotation)))
    // Filter out any dirs that are not city after rotation (defensive)
    .map((g) => g.filter((d) => edges[d].terrain === "city"));

  const landColor = "#789451";
  const cityColor = "#b9aa87"; // sandstone courtyard
  const shieldColor = "#3167a8";

  const baseTopY = BASE_THICKNESS / 2;
  const roadY = baseTopY + 0.01;

  // Wall sits ABOVE city top
  const cityTopY = baseTopY + CITY_HEIGHT;
  // Sink a bit into the city top so there's no visible gap
  const wallY = cityTopY + WALL_HEIGHT / 2 - 0.01;


  const isChurch = def.id === "church" || def.id === "church_road";

  const meepleColor = "#2b6cff";
  const PLAYER_COLORS = [
    "#ffffff", // white
    "#ef4444", // red
    "#22c55e", // green
    "#2b6cff", // blue (existing)
    "#eab308", // yellow
  ] as const;
  const colorForPlayer = (pi: number | undefined) =>
    PLAYER_COLORS[Math.max(0, Math.min(PLAYER_COLORS.length - 1, typeof pi === "number" ? pi : 3))] ?? meepleColor;
  const meepleY = baseTopY + 0.055;

  function roadMeeplePos(dir: EdgeDir): [number, number, number] {
    // If the road enters a city edge (gate), keep the meeple more inward.
    const isCityGate = edges[dir].terrain === "city";
    // Align with the rendered road segment centers (which sit at +/-0.25).
    const o = isCityGate ? 0.16 : 0.25;
    switch (dir) {
      case "N":
        return [0, meepleY, -o];
      case "S":
        return [0, meepleY, o];
      case "E":
        return [o, meepleY, 0];
      case "W":
        return [-o, meepleY, 0];
    }
  }

  function cityMeeplePos(dir: EdgeDir): [number, number, number] {
    // City meeple sits closer to the edge than the road meeple.
    const o = 0.33;
    switch (dir) {
      case "N":
        return [0, cityTopY + 0.01, -o];
      case "S":
        return [0, cityTopY + 0.01, o];
      case "E":
        return [o, cityTopY + 0.01, 0];
      case "W":
        return [-o, cityTopY + 0.01, 0];
    }
  }

  const roadCount =
    (edges.N.road ? 1 : 0) + (edges.E.road ? 1 : 0) + (edges.S.road ? 1 : 0) + (edges.W.road ? 1 : 0);
  const hasAnyCity = edges.N.terrain === "city" || edges.E.terrain === "city" || edges.S.terrain === "city" || edges.W.terrain === "city";
  const isRoadJunction = !hasAnyCity && (roadCount === 3 || roadCount === 4);
  const showJunctionMarker = isRoadJunction || def.id === "city_edge_roads_3";
  const hint = {
    radiusChurch: 0.14,
    radiusEdge: 0.12,
    height: 0.09,
    gap: 0.01,
  };

  const landTopY = baseTopY;
  const roadTopY = roadY + ROAD_THICKNESS / 2;
  const churchTopY = baseTopY + 0.34;

  function surfaceYForDir(dir: EdgeDir): number {
    let y = landTopY;
    if (edges[dir].road) y = Math.max(y, roadTopY);
    if (edges[dir].terrain === "city") y = Math.max(y, cityTopY);
    return y;
  }

  function surfaceYCenter(): number {
    let y = landTopY;
    if (edges.N.road || edges.E.road || edges.S.road || edges.W.road) y = Math.max(y, roadTopY);
    if (hasAnyCity) y = Math.max(y, cityTopY);
    if (isChurch) y = Math.max(y, churchTopY);
    return y;
  }

  function hintCenterY(surfaceTopY: number): number {
    return surfaceTopY + hint.gap + hint.height / 2;
  }

  return (
    <group position={position}>
      {/* Base land */}
      <mesh receiveShadow castShadow>
        <boxGeometry args={[TILE_SIZE, BASE_THICKNESS, TILE_SIZE]} />
        <meshStandardMaterial color={landColor} transparent opacity={opacity} />
      </mesh>

      {(["N", "E", "S", "W"] as const).filter(dir => edges[dir].terrain === "land").map(dir => (
        <group key={`grove-${dir}`} rotation={[0, DIR_ANGLE[dir], 0]}>
          <Tree position={[-0.19, baseTopY, -0.36]} opacity={opacity} />
          <Tree position={[0.19, baseTopY, -0.37]} opacity={opacity} variant={1} />
        </group>
      ))}

      {isChurch && <group position={[0, baseTopY, 0]} rotation={[0, -rotation * Math.PI / 180, 0]}><Monastery opacity={opacity} /></group>}

      {showJunctionMarker && <group position={[0, baseTopY + 0.02, 0]} rotation={[0, -rotation * Math.PI / 180, 0]}>
        <House position={[-0.067, 0, -0.06]} scale={0.7} opacity={opacity} />
        <House position={[0.067, 0, -0.045]} scale={0.65} roof="#796248" opacity={opacity} />
        <House position={[0.012, 0, 0.065]} scale={0.7} roof="#a46b43" opacity={opacity} />
      </group>}

      {/* City triangles + walls around them */}
      {cityGroups.map((group, gi) => {
        if (group.length === 0) return null;
        const hub = hubForGroup(group);

        const isOppositeConnectedCity = CITY_OPPOSITE_CONNECTED_IDS.has(def.id);

        return (
          <group key={`city-group-${gi}`}>
            {isOppositeConnectedCity ? (
              <group>
                {/* Center hub to make the E<->W city connection visible */}
                <mesh position={[0, baseTopY + CITY_HEIGHT / 2, 0]} castShadow receiveShadow>
                  <boxGeometry args={[CITY_HUB_HALF_OPPOSITE_CONNECTED * 2, CITY_HEIGHT, CITY_HUB_HALF_OPPOSITE_CONNECTED * 2]} />
                  <meshStandardMaterial color={cityColor} transparent opacity={opacity} />
                </mesh>

                {group.map((dir) => (
                  <mesh
                    key={`city-${gi}-${dir}`}
                    position={[0, baseTopY, 0]}
                    geometry={getCityStripGeom(dir, CITY_HUB_HALF_OPPOSITE_CONNECTED, CITY_HEIGHT)}
                    castShadow
                    receiveShadow
                  >
                    <meshStandardMaterial color={cityColor} transparent opacity={opacity} />
                  </mesh>
                ))}
              </group>
            ) : (
              group.map((dir) => (
                <group key={`city-${gi}-${dir}`}>
                  <mesh
                    position={[0, baseTopY, 0]}
                    geometry={hub.x === 0 && hub.z === 0 ? TRI_GEOMS[dir] : makeTriangleExtrudeWithHub(dir, hub, CITY_HEIGHT)}
                    castShadow
                    receiveShadow
                  >
                    <meshStandardMaterial color={cityColor} transparent opacity={opacity} />
                  </mesh>
                </group>
              ))
            )}

            {(isOppositeConnectedCity
              ? wallsForOppositeConnectedCity(group, wallY, WALL_THICKNESS, WALL_HEIGHT)
              : wallsForCityGroup(group, hub, wallY, WALL_THICKNESS, WALL_HEIGHT)
            ).map((s, idx) => (
              <group key={`${gi}-group-wall-${idx}`} position={s.pos} rotation={[0, s.rotY, 0]}>
                <CastleWall thickness={s.size[0]} height={s.size[1]} length={s.size[2]} opacity={opacity} />
              </group>
            ))}
          </group>
        );
      })}

      {/* Reserve the middle of every city edge for meeples. */}
      {cityGroups.flatMap((group, gi) => group.map((dir, di) => (
        <group key={`buildings-${gi}-${dir}`} rotation={[0, DIR_ANGLE[dir], 0]}>
          <House position={[-0.18, cityTopY, -0.38]} scale={0.85} opacity={opacity} />
          <group position={[0.18, cityTopY, -0.38]}>
            <Tower opacity={opacity} />
            {def.hasShield && gi === 0 && di === 0 && <group position={[0, 0.245, 0]} rotation={[-Math.PI / 4, 0, 0]} scale={0.65}>
              <mesh geometry={SHIELD_GEOM} castShadow>
                <meshStandardMaterial color={shieldColor} metalness={0.25} roughness={0.5} transparent opacity={opacity} />
              </mesh>
              <mesh position={[0, 0, 0.012]}>
                <boxGeometry args={[0.015, 0.13, 0.004]} />
                <meshStandardMaterial color="#ead49c" transparent opacity={opacity} />
              </mesh>
              <mesh position={[0, 0.023, 0.012]}>
                <boxGeometry args={[0.09, 0.014, 0.004]} />
                <meshStandardMaterial color="#ead49c" transparent opacity={opacity} />
              </mesh>
            </group>}
          </group>
        </group>
      )))}

      {(["N", "E", "S", "W"] as const).filter(dir => edges[dir].road).map(dir => (
        <group key={`road-${dir}`} position={[0, roadY + ROAD_THICKNESS / 2, 0]} rotation={[0, DIR_ANGLE[dir], 0]}>
          <MedievalRoad opacity={opacity} />
        </group>
      ))}
      {roadCount > 0 && <mesh position={[0, roadY + ROAD_THICKNESS / 2 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[0.083, 16]} />
        <meshStandardMaterial color="#b59a6d" roughness={1} transparent opacity={opacity} />
      </mesh>}

      {/* Placed meeples */}
      {meeples.map((m, i) => {
        const c = colorForPlayer((m as unknown as { player?: number }).player);
        if (m.feature.kind === "church") {
          return <MeepleMesh key={`meeple-${i}`} color={c} scale={1.0} position={[0, churchTopY + 0.01, 0]} />;
        }
        if (m.feature.kind === "road") {
          return (
            <MeepleMesh
              key={`meeple-${i}`}
              color={c}
              scale={1.0}
              position={roadMeeplePos(m.feature.dir)}
            />
          );
        }
        return (
          <MeepleMesh
            key={`meeple-${i}`}
            color={c}
            scale={1.0}
            position={cityMeeplePos(m.feature.dir)}
          />
        );
      })}

      {/* Click hit-zones for meeple placement on the last placed tile */}
      {isMeepleTarget && onMeepleFeatureClick && (
        <group>
          {isChurch && (
            <group>
              {/* subtle visual hint (not black) */}
              <mesh position={[0, hintCenterY(surfaceYCenter()), 0]}>
                <cylinderGeometry args={[hint.radiusChurch, hint.radiusChurch, hint.height, 24]} />
                <meshStandardMaterial color={meepleColor} transparent opacity={0.28} depthWrite={false} />
              </mesh>
              {/* invisible hitbox */}
              <mesh
                position={[0, hintCenterY(churchTopY), 0]}
                onClick={(e) => {
                  e.stopPropagation();
                  onMeepleFeatureClick({ kind: "church" });
                }}
              >
                <boxGeometry args={[0.3, 0.1, 0.3]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
            </group>
          )}

          {(["N", "E", "S", "W"] as const).map((dir) => {
            if (!edges[dir].road) return null;
            const pos = roadMeeplePos(dir);
            return (
              <group key={`meeple-hit-${dir}`}>
                {/* subtle visual hint (not black) */}
                <mesh position={[pos[0], hintCenterY(surfaceYForDir(dir)), pos[2]]}>
                  <cylinderGeometry args={[hint.radiusEdge, hint.radiusEdge, hint.height, 24]} />
                  <meshStandardMaterial color={meepleColor} transparent opacity={0.28} depthWrite={false} />
                </mesh>
                {/* invisible hitbox */}
                <mesh
                  position={[pos[0], meepleY + 0.03, pos[2]]}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMeepleFeatureClick({ kind: "road", dir });
                  }}
                >
                  <boxGeometry args={[0.3, 0.1, 0.3]} />
                  <meshBasicMaterial transparent opacity={0} depthWrite={false} />
                </mesh>
              </group>
            );
          })}

          {(["N", "E", "S", "W"] as const).map((dir) => {
            if (edges[dir].terrain !== "city") return null;
            const pos = cityMeeplePos(dir);
            return (
              <group key={`meeple-hit-city-${dir}`}>
                {/* subtle visual hint (not black) */}
                <mesh position={[pos[0], hintCenterY(surfaceYForDir(dir)), pos[2]]}>
                  <cylinderGeometry args={[hint.radiusEdge, hint.radiusEdge, hint.height, 24]} />
                  <meshStandardMaterial color={meepleColor} transparent opacity={0.28} depthWrite={false} />
                </mesh>
                {/* invisible hitbox */}
                <mesh
                  position={[pos[0], meepleY + 0.03, pos[2]]}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMeepleFeatureClick({ kind: "city", dir });
                  }}
                >
                  <boxGeometry args={[0.3, 0.1, 0.3]} />
                  <meshBasicMaterial transparent opacity={0} depthWrite={false} />
                </mesh>
              </group>
            );
          })}
        </group>
      )}
    </group>
  );
}
