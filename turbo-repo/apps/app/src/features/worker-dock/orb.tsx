"use client";

/* react-three-fiber turns three.js classes into intrinsic JSX elements whose
   props (args, position, intensity, …) eslint-plugin-react doesn't know. */
/* eslint-disable react/no-unknown-property */

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import { Color, MathUtils, type Group } from "three";
import { acquirePointerTracking, pointer } from "./pointer";
import {
  ORB_HOVERS,
  ORB_TRANSITIONS,
  pickOrbHover,
  pickOrbTransition,
} from "./orb-animations";

export type OrbMode = "idle" | "hover" | "follow" | "exit";

const ENTER_MS = 440;
const easeIn = (x: number) => x * x * x;
const easeOut = (x: number) => 1 - (1 - x) ** 3;

/**
 * A little round worker: a body in one of the dashboard preset colours with two
 * plain white eyes (no pupils) that slide around the front of the face toward
 * whatever they're looking at.
 * - `idle`  — gentle bob, eyes drift lazily.
 * - `hover` — one of four random in-place reactions ({@link ORB_HOVERS}).
 * - `follow`— eyes track the window cursor (see {@link pointer}).
 * - `exit`  — plays a randomly chosen disappear from {@link ORB_TRANSITIONS}
 *   (clipped by the `<View>` scissor, so it reads as leaving "behind the
 *   screen"); the spot it leaves keeps a flat `WorkerBadge` disc.
 *
 * With `entrance`, on mount it plays a randomly chosen *appear* from the same
 * list — so the character comes and goes a different way each time, and travels
 * between places with nothing drawn on top in between.
 *
 * Lives inside a drei `<View>` (see `worker-orb-view.tsx`); brings its own
 * camera so each view renders self-contained (no lights — the materials are
 * unlit `meshBasicMaterial`). The camera sits outside the animated `root` group
 * so the transitions don't move it.
 */
export function Orb({
  color,
  mode,
  entrance = false,
  entranceDelayMs = 140,
  notify = false,
}: Readonly<{
  color: string;
  mode: OrbMode;
  entrance?: boolean;
  /** Hold before the appear starts — e.g. wait out the chat panel sliding open. */
  entranceDelayMs?: number;
  /** Notification "special state": the orb shrinks + slides left and a 3D "!"
   *  scales in out front-right. */
  notify?: boolean;
}>) {
  const root = useRef<Group>(null);
  const leftEye = useRef<Group>(null);
  const rightEye = useRef<Group>(null);
  const bang = useRef<Group>(null);
  const bangAmt = useRef(0);
  const hop = useRef(0);
  const enter = useRef(entrance ? 0 : 1);
  const enterDelay = useRef(entrance ? entranceDelayMs : 0);
  const exit = useRef(0);
  const exitIdx = useRef(-1);
  const hoverIdx = useRef(-1);

  // one random appear picked per mount; the disappear is picked when `exit` fires
  const appearIdx = useMemo(() => pickOrbTransition(), []);

  useEffect(() => acquirePointerTracking(), []);

  const bodyColor = useMemo(() => new Color(color), [color]);

  useFrame((state, delta) => {
    const g = root.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const ms = delta * 1000;

    // ── appear progress ── hold it at the start until the view is actually
    // on-screen at a real size, otherwise the entrance burns off while the
    // chat panel is still sliding open and you never see it.
    const measured = state.size.width > 8 && state.size.height > 8;
    if (measured) {
      if (enterDelay.current > 0) enterDelay.current -= ms;
      else enter.current = Math.min(1, enter.current + ms / ENTER_MS);
    }
    const qAppear = easeOut(enter.current);

    // ── disappear: pick a variant the first frame `exit` is asked for ──
    if (mode === "exit") {
      if (exitIdx.current < 0) exitIdx.current = pickOrbTransition();
    } else if (exit.current < 0.02) {
      exitIdx.current = -1;
    }
    exit.current = MathUtils.damp(exit.current, mode === "exit" ? 1 : 0, 13, delta);
    const qExit = 1 - easeIn(exit.current);

    const disappearing = exitIdx.current >= 0 && exit.current > 0.001;
    const q = Math.min(qAppear, qExit);
    const transition = disappearing
      ? ORB_TRANSITIONS[exitIdx.current]
      : ORB_TRANSITIONS[appearIdx];
    const off = transition.at(q, t);

    // ── in-place life ── a gentle idle bob always, plus one of four random
    // hover reactions while the pointer's over it. Both fade out (× q) during
    // an appear/disappear so they don't fight the transition.
    if (mode === "hover") {
      if (hoverIdx.current < 0) hoverIdx.current = pickOrbHover();
    } else if (hop.current < 0.02) {
      hoverIdx.current = -1;
    }
    hop.current = MathUtils.damp(hop.current, mode === "hover" ? 1 : 0, 9, delta);
    const idleBob = Math.sin(t * 2) * 0.04 * q;
    const hv = ORB_HOVERS[hoverIdx.current >= 0 ? hoverIdx.current : 0](
      t,
      hop.current * q,
    );

    // ── notification "special state" ── the orb shrinks and slides left to
    // make room for the "!" out front-right (see the sibling `bang` group).
    bangAmt.current = MathUtils.damp(bangAmt.current, notify ? 1 : 0, 12, delta);
    const nsmooth = bangAmt.current * bangAmt.current * (3 - 2 * bangAmt.current);
    const nScale = 1 - nsmooth * 0.32;
    const nShiftX = nsmooth * -0.5;

    const s = off.scale ?? 1;
    g.position.set(
      (off.px ?? 0) + (hv.px ?? 0) + nShiftX,
      idleBob + (off.py ?? 0) + (hv.py ?? 0),
      (off.pz ?? 0) + (hv.pz ?? 0),
    );
    g.scale.set(
      Math.max(0.001, s * (off.sx ?? 1) * (hv.sx ?? 1) * nScale),
      Math.max(0.001, s * (off.sy ?? 1) * (hv.sy ?? 1) * nScale),
      Math.max(0.001, s * (off.sz ?? 1) * (hv.sz ?? 1) * nScale),
    );
    g.rotation.set(
      (off.rx ?? 0) + (hv.rx ?? 0),
      (off.ry ?? 0) + (hv.ry ?? 0),
      (off.rz ?? 0) + (hv.rz ?? 0) + Math.sin(t * 1.2) * 0.03 * q,
    );

    // ── eyes ── default gaze dead centre; in follow mode the cursor maps
    // linearly across the whole viewport (mouse low → eyes at the bottom of
    // the face, no top-half bias). Idle orbs do a tiny centred wander.
    const look =
      mode === "follow" && pointer.seen
        ? { x: MathUtils.clamp(pointer.nx, -1, 1), y: MathUtils.clamp(pointer.ny, -1, 1) }
        : { x: Math.sin(t * 0.5) * 0.22, y: Math.sin(t * 0.8) * 0.16 };

    // Modest horizontal travel so neither eye ever wanders toward the limb of
    // the sphere (where perspective + self-occlusion make it shrink and
    // vanish); more generous vertical range since that's the one that needs to
    // reach. z barely changes and stays proud of the body.
    const dx = look.x * 0.16;
    const dy = look.y * 0.3;
    const dz = 0.9 - (dx * dx + dy * dy) * 0.25;
    for (const [eye, restX] of [
      [leftEye.current, -0.34] as const,
      [rightEye.current, 0.34] as const,
    ]) {
      if (!eye) continue;
      eye.position.x = MathUtils.damp(eye.position.x, restX + dx, 10, delta);
      eye.position.y = MathUtils.damp(eye.position.y, dy, 10, delta);
      eye.position.z = MathUtils.damp(eye.position.z, dz, 10, delta);
    }

    // ── the "!" mark ── sits out in front and to the right (independent of the
    // orb's own transform), scales in with the special state, then bobs + pulses
    const b = bang.current;
    if (b) {
      const v = bangAmt.current;
      b.visible = v > 0.01;
      const pop = 1 + Math.sin(t * 7) * 0.08;
      b.scale.setScalar(v * pop * 1.15);
      b.position.set(
        0.62,
        0.14 + Math.sin(t * 3.5) * 0.05 * v,
        1.15,
      );
      b.rotation.z = -0.12 + Math.sin(t * 5) * 0.12 * v;
    }
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 4.6]} fov={42} />

      <group ref={root}>
        {/* body — unlit basic material, so it's *exactly* the badge colour with
            no shading; the silhouette + squash/eye motion carry the 3D feel */}
        <mesh>
          <sphereGeometry args={[1, 48, 48]} />
          <meshBasicMaterial color={bodyColor} toneMapped={false} />
        </mesh>

        {/* eyes — pure flat white everywhere, no pupil; the whole eye slides */}
        <group ref={leftEye} position={[-0.34, 0, 0.9]}>
          <mesh>
            <sphereGeometry args={[0.19, 24, 24]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </mesh>
        </group>
        <group ref={rightEye} position={[0.34, 0, 0.9]}>
          <mesh>
            <sphereGeometry args={[0.19, 24, 24]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </mesh>
        </group>
      </group>

      {/* "!" mark — a solid 3D glyph living OUT FRONT of the orb (sibling of
          `root`, so the orb's shrink/slide in the special state doesn't move
          it). depthTest off so nothing clips it. */}
      <group
        ref={bang}
        rotation={[0.12, -0.16, 0]}
        scale={0}
        visible={false}
      >
        <mesh position={[0, 0.19, 0]} renderOrder={20}>
          <capsuleGeometry args={[0.14, 0.42, 8, 20]} />
          <meshBasicMaterial
            color="#ffffff"
            toneMapped={false}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[0, -0.34, 0]} renderOrder={20}>
          <sphereGeometry args={[0.15, 20, 20]} />
          <meshBasicMaterial
            color="#ffffff"
            toneMapped={false}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
      </group>
    </>
  );
}
