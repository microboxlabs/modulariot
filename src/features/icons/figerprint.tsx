import { Player } from "@lordicon/react";
import { useEffect, useRef } from "react";

import icon from "@assets/lordicons.json";

export default function FingerprintIcon({
  state,
}: {
  state: "success" | "failed" | "in_progress";
}) {
  const playerRef = useRef<Player>(null);

  useEffect(() => {
    setTimeout(() => {
      playerRef.current?.playFromBeginning();
    }, 500);
  }, []);

  const playerState =
    state === "success"
      ? "morph-correct"
      : state === "failed"
        ? "hover-wrong"
        : "loop-cycle";
  const colors =
    state === "success"
      ? "#31c48d"
      : state === "failed"
        ? "#F05252"
        : "#1A57DB";
  return (
    <Player
      ref={playerRef}
      icon={icon}
      size={150}
      state={playerState}
      colors={`primary:${colors},secondary:${colors}`}
      onComplete={() => {
        if (state === "in_progress") {
          playerRef.current?.playFromBeginning();
        }
      }}
    />
  );
}
