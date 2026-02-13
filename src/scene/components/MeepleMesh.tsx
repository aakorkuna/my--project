import React from "react";

export function MeepleMesh(props: {
  color: string;
  position?: [number, number, number];
  scale?: number;
}) {
  const { color, position = [0, 0, 0], scale = 1 } = props;

  // A simple, stylized 3D meeple built from primitives.
  // Kept low-poly and stable (no external assets).
  return (
    <group position={position} scale={scale}>
      {/* feet */}
      <mesh position={[-0.05, 0.02, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.055, 0.04, 14]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0.05, 0.02, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.055, 0.04, 14]} />
        <meshStandardMaterial color={color} />
      </mesh>

      {/* body */}
      <mesh position={[0, 0.075, 0]} castShadow>
        <cylinderGeometry args={[0.075, 0.095, 0.11, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>

      {/* arms */}
      <mesh position={[-0.11, 0.09, 0]} castShadow>
        <sphereGeometry args={[0.04, 14, 14]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0.11, 0.09, 0]} castShadow>
        <sphereGeometry args={[0.04, 14, 14]} />
        <meshStandardMaterial color={color} />
      </mesh>

      {/* neck */}
      <mesh position={[0, 0.135, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.06, 0.05, 14]} />
        <meshStandardMaterial color={color} />
      </mesh>

      {/* head */}
      <mesh position={[0, 0.18, 0]} castShadow>
        <sphereGeometry args={[0.06, 18, 18]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}
