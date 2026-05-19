import { Text } from "ink";
import { useEffect, useState } from "react";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export interface SpinnerProps {
  color?: string;
  // Tick interval in ms. Capped at 8 fps (125ms) by default to keep the
  // reconciler's frame cost predictable.
  intervalMs?: number;
}

export function Spinner(props: SpinnerProps): React.ReactElement {
  const interval = props.intervalMs ?? 125;
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setFrame((f) => (f + 1) % FRAMES.length);
    }, interval);
    return (): void => {
      clearInterval(id);
    };
  }, [interval]);

  return <Text color={props.color}>{FRAMES[frame]}</Text>;
}
