"use client";

import { Canvas } from "@react-three/fiber";
import { View } from "@react-three/drei";

/**
 * The one and only WebGL context for every worker orb on the page. It's a
 * fixed, transparent, click-through overlay; drei's `<View>` (see
 * `worker-orb-view.tsx`) scissors it into whatever DOM boxes are tracking it,
 * so N orbs cost one context instead of N. Mounted once by
 * `worker-dock-mount.tsx` and loaded with `ssr: false`.
 */
export default function OrbCanvas() {
  return (
    <Canvas
      eventSource={typeof document !== "undefined" ? document.body : undefined}
      eventPrefix="client"
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 30,
      }}
    >
      <View.Port />
    </Canvas>
  );
}
