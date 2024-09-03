import { Player } from "@lordicon/react";
import { useEffect, useRef } from "react";

import icon from "@assets/lordicons.json";

export default function FingerprintIcon({
  state,
}: {
  state: "success" | "failed";
}) {
  const playerRef = useRef<Player>(null);

  useEffect(() => {
    setTimeout(() => {
      playerRef.current?.playFromBeginning();
    }, 500);
  }, []);

  const playerState = state === "success" ? "morph-correct" : "hover-wrong";
  const colors = state === "success" ? "#31c48d" : "#F05252";

  return (
    <Player
      ref={playerRef}
      icon={icon}
      size={150}
      state={playerState}
      colors={`primary:${colors},secondary:${colors}`}
    />
  );
}
