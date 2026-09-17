import * as THREE from "three";

type Point = [number, number, number];
type DetailProps = { opacity: number };

function Block({ position, size, color, opacity }: DetailProps & { position: Point; size: Point; color: string }) {
  return <mesh position={position} castShadow receiveShadow>
    <boxGeometry args={size} />
    <meshStandardMaterial color={color} roughness={0.95} transparent={opacity < 1} opacity={opacity} />
  </mesh>;
}

const roofShape = new THREE.Shape();
roofShape.moveTo(-0.5, 0);
roofShape.lineTo(0, 0.65);
roofShape.lineTo(0.5, 0);
roofShape.closePath();
const roofGeometry = new THREE.ExtrudeGeometry(roofShape, { depth: 1, bevelEnabled: false });
roofGeometry.translate(0, 0, -0.5);

export function House({ opacity, position = [0, 0, 0], scale = 1, roof = "#934e35" }: DetailProps & { position?: Point; scale?: number; roof?: string }) {
  return <group position={position} scale={scale}>
    <Block position={[0, 0.045, 0]} size={[0.095, 0.09, 0.12]} color="#dfcba2" opacity={opacity} />
    <mesh geometry={roofGeometry} position={[0, 0.09, 0]} scale={[0.12, 0.1, 0.15]} castShadow>
      <meshStandardMaterial color={roof} roughness={1} transparent={opacity < 1} opacity={opacity} />
    </mesh>
    <Block position={[0, 0.028, 0.061]} size={[0.026, 0.056, 0.004]} color="#594333" opacity={opacity} />
    <Block position={[-0.032, 0.063, 0.061]} size={[0.016, 0.021, 0.004]} color="#3b4240" opacity={opacity} />
    <Block position={[0.049, 0.044, 0]} size={[0.005, 0.009, 0.12]} color="#785a40" opacity={opacity} />
    <Block position={[0.03, 0.13, -0.032]} size={[0.019, 0.065, 0.022]} color="#a18c74" opacity={opacity} />
  </group>;
}

export function Tower({ opacity }: DetailProps) {
  return <group>
    <Block position={[0, 0.075, 0]} size={[0.105, 0.15, 0.105]} color="#a79e88" opacity={opacity} />
    <Block position={[0, 0.148, 0]} size={[0.125, 0.027, 0.125]} color="#d1c4a5" opacity={opacity} />
    {[-1, 1].flatMap(x => [-1, 1].map(z => <Block key={`${x}:${z}`} position={[x * 0.046, 0.174, z * 0.046]} size={[0.032, 0.033, 0.032]} color="#d1c4a5" opacity={opacity} />))}
    <Block position={[0, 0.104, 0.053]} size={[0.019, 0.044, 0.003]} color="#454a43" opacity={opacity} />
  </group>;
}

export function CastleWall({ opacity, length, height, thickness }: DetailProps & { length: number; height: number; thickness: number }) {
  const count = Math.max(2, Math.round(length / 0.075));
  return <group>
    <Block position={[0, 0, 0]} size={[thickness, height, length]} color="#948d79" opacity={opacity} />
    <Block position={[0, height * 0.32, 0]} size={[thickness + 0.009, 0.012, length]} color="#c8bda0" opacity={opacity} />
    {Array.from({ length: count }, (_, i) => <Block key={i} position={[0, height / 2 + 0.013, -length / 2 + (i + 0.5) * length / count]} size={[thickness + 0.008, 0.027, length / count * 0.52]} color="#bdb297" opacity={opacity} />)}
    {Array.from({ length: count }, (_, i) => <Block key={`stone-${i}`} position={[0, -height * 0.15, -length / 2 + (i + 0.5) * length / count]} size={[thickness + 0.002, height * 0.38, length / count * 0.87]} color={i % 2 ? "#aba18b" : "#b6aa91"} opacity={opacity} />)}
  </group>;
}

export function Tree({ opacity, position, variant = 0 }: DetailProps & { position: Point; variant?: number }) {
  return <group position={position}>
    <Block position={[0, 0.034, 0]} size={[0.018, 0.068, 0.018]} color="#765839" opacity={opacity} />
    <mesh position={[0, 0.091, 0]} scale={[0.052, 0.07, 0.048]} castShadow>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color={variant % 2 ? "#597b39" : "#365f35"} roughness={1} transparent={opacity < 1} opacity={opacity} />
    </mesh>
  </group>;
}

// A gently winding dirt ribbon. Both ends retain the exact edge/centre alignment.
const roadShape = new THREE.Shape();
roadShape.moveTo(-0.08, 0);
roadShape.bezierCurveTo(-0.055, 0.17, -0.115, 0.31, -0.08, 0.5);
roadShape.lineTo(0.08, 0.5);
roadShape.bezierCurveTo(0.045, 0.31, 0.105, 0.17, 0.08, 0);
roadShape.closePath();
const roadGeometry = new THREE.ShapeGeometry(roadShape, 16);
roadGeometry.rotateX(-Math.PI / 2);

export function MedievalRoad({ opacity }: DetailProps) {
  return <group>
    <mesh geometry={roadGeometry} receiveShadow>
      <meshStandardMaterial color="#b59a6d" roughness={1} transparent={opacity < 1} opacity={opacity} />
    </mesh>
    {Array.from({ length: 8 }, (_, i) => <Block key={i} position={[Math.sin(i * 2.3) * 0.043, 0.002, -(i + 0.5) / 16]} size={[0.018 + (i % 3) * 0.006, 0.004, 0.015]} color={i % 2 ? "#cbb78e" : "#948363"} opacity={opacity} />)}
  </group>;
}

export function Monastery({ opacity }: DetailProps) {
  return <group>
    <Block position={[0, 0.006, 0]} size={[0.3, 0.012, 0.29]} color="#b5ab8b" opacity={opacity} />
    <group position={[-0.05, 0.01, 0.025]} scale={[1.25, 1.15, 1.5]}><House opacity={opacity} roof="#66716e" /></group>
    <group position={[0.078, 0.01, -0.048]}><Tower opacity={opacity} /></group>
    <mesh position={[0.078, 0.231, -0.048]} rotation={[0, Math.PI / 4, 0]} castShadow>
      <coneGeometry args={[0.09, 0.105, 4]} />
      <meshStandardMaterial color="#596b68" transparent={opacity < 1} opacity={opacity} />
    </mesh>
    <Block position={[0.078, 0.306, -0.048]} size={[0.011, 0.062, 0.011]} color="#d8c58d" opacity={opacity} />
    <Block position={[0.078, 0.315, -0.048]} size={[0.042, 0.011, 0.011]} color="#d8c58d" opacity={opacity} />
  </group>;
}
