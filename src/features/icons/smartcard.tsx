import { Player } from "@lordicon/react";
import { useEffect, useRef } from "react";

import icon from "@assets/lordicons-smartcard.json";

export default function SmartCardIcon() {
  const playerRef = useRef<Player>(null);
  const colors = "#1C64F2";

  useEffect(() => {
    setTimeout(() => {
      playerRef.current?.playFromBeginning();
    }, 500);
  }, []);

  return (
    <Player
      ref={playerRef}
      icon={icon}
      size={150}
      state="hover-pinch"
      colors={`primary:${colors},secondary:${colors}`}
    />
  );
}
