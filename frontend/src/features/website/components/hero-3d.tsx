'use client';

import { Suspense, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, Sparkles } from '@react-three/drei';
import type { Group, Mesh } from 'three';

/**
 * Real WebGL 3D hero centrepiece — a rotating faceted gold gem inside a
 * gold ring, with floating sparkles, soft lighting and a mouse-reactive
 * camera. Rendered client-side only (imported with ssr:false).
 */
function Gem() {
  const group = useRef<Group>(null);
  const gem = useRef<Mesh>(null);

  useFrame((state, delta) => {
    if (gem.current) {
      gem.current.rotation.y += delta * 0.4;
      gem.current.rotation.x += delta * 0.12;
    }
    if (group.current) {
      // gentle mouse parallax
      const { x, y } = state.pointer;
      group.current.rotation.y += (x * 0.4 - group.current.rotation.y) * 0.05;
      group.current.rotation.x += (-y * 0.3 - group.current.rotation.x) * 0.05;
    }
  });

  return (
    <group ref={group}>
      <Float speed={2} rotationIntensity={0.4} floatIntensity={1.2}>
        {/* faceted gem */}
        <mesh ref={gem} castShadow>
          <icosahedronGeometry args={[1.35, 0]} />
          <meshStandardMaterial
            color="#E3C877"
            metalness={0.85}
            roughness={0.18}
            emissive="#7d5a12"
            emissiveIntensity={0.25}
            flatShading
          />
        </mesh>

        {/* orbiting gold ring */}
        <mesh rotation={[Math.PI / 2.2, 0.4, 0]}>
          <torusGeometry args={[2.1, 0.07, 16, 100]} />
          <meshStandardMaterial color="#D4AF37" metalness={1} roughness={0.25} />
        </mesh>
      </Float>

      <Sparkles count={40} scale={6} size={4} speed={0.4} color="#E3C877" />
    </group>
  );
}

function Rig() {
  const { camera } = useThree();
  useFrame((state) => {
    camera.position.x += (state.pointer.x * 0.6 - camera.position.x) * 0.03;
    camera.position.y += (state.pointer.y * 0.4 - camera.position.y) * 0.03;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

export default function Hero3D() {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0, 6], fov: 45 }}
      gl={{ alpha: true, antialias: true }}
      style={{ background: 'transparent' }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 6, 4]} intensity={2.2} color="#fff4d6" />
      <pointLight position={[-4, -2, 3]} intensity={40} color="#D4AF37" />
      <pointLight position={[4, 3, -2]} intensity={25} color="#ffe8a3" />
      <Suspense fallback={null}>
        <Gem />
      </Suspense>
      <Rig />
    </Canvas>
  );
}
