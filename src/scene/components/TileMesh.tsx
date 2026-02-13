import React from "react";
import * as THREE from "three";
import type { MeepleFeature, MeeplePlacement, TileDefinition, Rotation, EdgeDir } from "../../game/model/types";
import { rotateDir, rotateEdges } from "../../game/logic/rotate";
import { MeepleMesh } from "./MeepleMesh";

const TILE_SIZE = 1;
const HALF = TILE_SIZE / 2;

// heights
const BASE_THICKNESS = 0.08;
const CITY_HEIGHT = 0.05;
const WALL_HEIGHT = 0.08;

// thicknesses
const WALL_THICKNESS = 0.04;
const ROAD_THICKNESS = 0.02;
const ROAD_WIDTH = 0.16;

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

function cityDiagonalWalls(dir: EdgeDir, y: number, thickness: number, height: number): WallSeg[] {
  const c = { x: 0, z: 0 }; // center

  const { a, b } = cityTriangleCorners(dir);

  // IMPORTANT: only the two diagonals (center -> each corner).
  // No wall on the outer tile edge.
  return [
    wallBetween(c, a, y, thickness, height),
    wallBetween(c, b, y, thickness, height),
  ];
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

function cityDiagonalWallsFromHub(
  dir: EdgeDir,
  hub: { x: number; z: number },
  y: number,
  thickness: number,
  height: number
): WallSeg[] {
  const { a, b } = cityTriangleCorners(dir);
  return [
    wallBetween(hub, a, y, thickness, height),
    wallBetween(hub, b, y, thickness, height),
  ];
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

  const landColor = "#2f7d3d";
  const cityColor = "#e4c04a"; // yellow
  const wallColor = "#b31919"; // red
  const roadColor = "#7a5a3a";
  const accentBlue = "#2b6cff";
  const shieldColor = "#14b8a6"; // turquoise
  const junctionMarkerColor = "#d97706";

  const baseTopY = BASE_THICKNESS / 2;
  const roadY = baseTopY + 0.01;

  // Wall sits ABOVE city top
  const cityTopY = baseTopY + CITY_HEIGHT;
  // Sink a bit into the city top so there's no visible gap
  const wallY = cityTopY + WALL_HEIGHT / 2 - 0.01;

  const shieldY = cityTopY + 0.018;

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
        return [0, meepleY, -o];
      case "S":
        return [0, meepleY, o];
      case "E":
        return [o, meepleY, 0];
      case "W":
        return [-o, meepleY, 0];
    }
  }

  const roadCount =
    (edges.N.road ? 1 : 0) + (edges.E.road ? 1 : 0) + (edges.S.road ? 1 : 0) + (edges.W.road ? 1 : 0);
  const hasAnyCity = edges.N.terrain === "city" || edges.E.terrain === "city" || edges.S.terrain === "city" || edges.W.terrain === "city";
  const isRoadJunction = !hasAnyCity && (roadCount === 3 || roadCount === 4);
  const showJunctionMarker = isRoadJunction || def.id === "city_edge_roads_3";
  const churchCube = { size: 0.12, height: 0.1 };
  const churchCubeY = baseTopY + churchCube.height / 2;
  const cross = {
    thickness: churchCube.size * 0.12,
    height: 0.02,
    verticalLen: churchCube.size * 0.85,
    horizontalLen: churchCube.size * 0.55,
  };
  const crossY = baseTopY + churchCube.height + cross.height / 2 + 0.002;
  // Move the horizontal bar towards the "top" end of the vertical stroke (in tile plane).
  const crossHorizontalZOffset = -cross.verticalLen * 0.18;

  const hint = {
    radiusChurch: 0.14,
    radiusEdge: 0.12,
    height: 0.09,
    gap: 0.01,
  };

  const landTopY = baseTopY;
  const roadTopY = roadY + ROAD_THICKNESS / 2;
  const churchTopY = baseTopY + churchCube.height;

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

      {isChurch && (
        <group>
          {/* church cube */}
          <mesh position={[0, churchCubeY, 0]} castShadow>
            <boxGeometry args={[churchCube.size, churchCube.height, churchCube.size]} />
            <meshStandardMaterial color={accentBlue} transparent opacity={opacity} />
          </mesh>

          {/* cross (kept within the cube footprint) */}
          <mesh position={[0, crossY, 0]} castShadow>
            {/* vertical stroke (longer) */}
            <boxGeometry args={[cross.thickness, cross.height, cross.verticalLen]} />
            <meshStandardMaterial color={cityColor} transparent opacity={opacity} />
          </mesh>
          <mesh position={[0, crossY, crossHorizontalZOffset]} castShadow>
            {/* horizontal stroke (shorter) */}
            <boxGeometry args={[cross.horizontalLen, cross.height, cross.thickness]} />
            <meshStandardMaterial color={cityColor} transparent opacity={opacity} />
          </mesh>
        </group>
      )}

      {showJunctionMarker && (
        <group>
          {/* simple junction marker */}
          <mesh position={[0, baseTopY + churchCube.height / 2, 0]} castShadow>
            <boxGeometry args={[churchCube.size, churchCube.height, churchCube.size]} />
            <meshStandardMaterial color={junctionMarkerColor} transparent opacity={opacity} />
          </mesh>
        </group>
      )}

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
              <mesh key={`${gi}-group-wall-${idx}`} position={s.pos} rotation={[0, s.rotY, 0]} castShadow>
                <boxGeometry args={s.size} />
                <meshStandardMaterial color={wallColor} transparent opacity={opacity} />
              </mesh>
            ))}
          </group>
        );
      })}

      {/* Roads: reach center from edges */}
      {edges.N.road && (
        <mesh position={[0, roadY, -0.25]} castShadow>
          <boxGeometry args={[ROAD_WIDTH, ROAD_THICKNESS, 0.5]} />
          <meshStandardMaterial color={roadColor} transparent opacity={opacity} />
        </mesh>
      )}
      {edges.S.road && (
        <mesh position={[0, roadY, 0.25]} castShadow>
          <boxGeometry args={[ROAD_WIDTH, ROAD_THICKNESS, 0.5]} />
          <meshStandardMaterial color={roadColor} transparent opacity={opacity} />
        </mesh>
      )}
      {edges.W.road && (
        <mesh position={[-0.25, roadY, 0]} castShadow>
          <boxGeometry args={[0.5, ROAD_THICKNESS, ROAD_WIDTH]} />
          <meshStandardMaterial color={roadColor} transparent opacity={opacity} />
        </mesh>
      )}
      {edges.E.road && (
        <mesh position={[0.25, roadY, 0]} castShadow>
          <boxGeometry args={[0.5, ROAD_THICKNESS, ROAD_WIDTH]} />
          <meshStandardMaterial color={roadColor} transparent opacity={opacity} />
        </mesh>
      )}

      {(edges.N.road || edges.E.road || edges.S.road || edges.W.road) && (
        <mesh position={[0, roadY, 0]} castShadow>
          <boxGeometry args={[ROAD_WIDTH, ROAD_THICKNESS, ROAD_WIDTH]} />
          <meshStandardMaterial color={roadColor} transparent opacity={opacity} />
        </mesh>
      )}

      {def.hasShield && (
        <mesh
          geometry={SHIELD_GEOM}
          position={(() => {
            // Keep centered for the fully-city tile (matches your reference).
            if (def.id === "city_full_shield" || def.id === "city_opposite_connected_shield")
              return [0, shieldY, 0] as [number, number, number];

            // Otherwise, push towards the nearest "city" corner.
            const cityN = edges.N.terrain === "city";
            const cityE = edges.E.terrain === "city";
            const cityS = edges.S.terrain === "city";
            const cityW = edges.W.terrain === "city";

            const corners = [
              { x: -0.24, z: -0.24, score: (cityN ? 1 : 0) + (cityW ? 1 : 0) }, // NW
              { x: 0.24, z: -0.24, score: (cityN ? 1 : 0) + (cityE ? 1 : 0) }, // NE
              { x: 0.24, z: 0.24, score: (cityS ? 1 : 0) + (cityE ? 1 : 0) }, // SE
              { x: -0.24, z: 0.24, score: (cityS ? 1 : 0) + (cityW ? 1 : 0) }, // SW
            ];

            corners.sort((a, b) => b.score - a.score);
            const best = corners[0];
            return [best.x, shieldY, best.z] as [number, number, number];
          })()}
          rotation={[-Math.PI / 2, 0, 0]}
          castShadow
        >
          <meshStandardMaterial color={shieldColor} transparent opacity={opacity} />
        </mesh>
      )}

      {/* Placed meeples */}
      {meeples.map((m, i) => {
        const c = colorForPlayer((m as unknown as { player?: number }).player);
        if (m.feature.kind === "church") {
          return <MeepleMesh key={`meeple-${i}`} color={c} scale={1.0} position={[0, meepleY, 0]} />;
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
                position={[0, meepleY + 0.03, 0]}
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
