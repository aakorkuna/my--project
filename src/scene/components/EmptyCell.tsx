import React from "react";

export function EmptyCell(props: {
  x: number;
  y: number;
  onClick: (x: number, y: number) => void;
  onHover?: (x: number, y: number) => void;
  onUnhover?: () => void;
}) {
  const { x, y, onClick, onHover, onUnhover } = props;
  const [hovered, setHovered] = React.useState(false);

  return (
    <mesh
      position={[x, 0.02, y]}
      onPointerEnter={(e) => {
        e.stopPropagation();
        setHovered(true);
        onHover?.(x, y);
      }}
      onPointerLeave={(e) => {
        e.stopPropagation();
        setHovered(false);
        onUnhover?.();
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick(x, y);
      }}
      receiveShadow
    >
      <boxGeometry args={[0.98, 0.02, 0.98]} />
      <meshStandardMaterial transparent opacity={hovered ? 0.55 : 0.25} />
    </mesh>
  );
}