import React, { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Box3, Vector3 } from "three";

export function CameraRig({ command, assembly, selectedObject, orbit }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const object =
      command.action === "focus" ? selectedObject.current : assembly.current;
    if (!object || !orbit.current) return;
    object.updateWorldMatrix(true, true);
    const box = new Box3().setFromObject(object);
    if (box.isEmpty()) {
      box.setFromCenterAndSize(new Vector3(), new Vector3(4, 2, 2));
    }
    const center = box.getCenter(new Vector3());
    const extent = box.getSize(new Vector3());
    const verticalFov = (camera.fov * Math.PI) / 180;
    const tan = Math.tan(verticalFov / 2);
    const aspect = size.width / size.height;
    const distance =
      Math.max(extent.y / 2 / tan, extent.x / 2 / tan / aspect) *
        (command.padding || 1.2) +
      extent.z;
    const direction =
      command.action === "rear"
        ? new Vector3(0.3, 0.18, -1).normalize()
        : command.action === "front"
          ? new Vector3(0, 0, 1)
          : new Vector3(0.52, 0.3, 1).normalize();
    camera.position.copy(
      center.clone().addScaledVector(direction, Math.max(1.8, distance)),
    );
    orbit.current.target.copy(center);
    camera.lookAt(center);
    camera.updateProjectionMatrix();
    orbit.current.update();
  }, [command, size.width, size.height, camera]);
  return null;
}

export function DinRail({ length = 3.9 }) {
  return (
    <group position={[-1.08, 0, -0.61]}>
      <mesh receiveShadow>
        <boxGeometry args={[length, 0.35, 0.025]} />
        <meshStandardMaterial
          color="#80959e"
          metalness={0.85}
          roughness={0.31}
        />
      </mesh>
      {[-0.155, 0.155].map((y) => (
        <mesh key={y} position={[0, y, 0.04]} castShadow>
          <boxGeometry args={[length, 0.04, 0.1]} />
          <meshStandardMaterial
            color="#c6d3d6"
            metalness={0.9}
            roughness={0.3}
          />
        </mesh>
      ))}
      {Array.from({ length: Math.ceil(length / 0.4) }, (_, i) => (
        <mesh key={i} position={[-length / 2 + 0.2 + i * 0.4, 0, 0.014]}>
          <boxGeometry args={[0.13, 0.054, 0.004]} />
          <meshStandardMaterial color="#2e4854" />
        </mesh>
      ))}
    </group>
  );
}
