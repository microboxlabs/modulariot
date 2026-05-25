import { Text } from "ink";
import { useEffect, useState } from "react";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

// Floor on the spinner's tick budget. A caller passing 0 / a negative /
// a single-digit value would otherwise schedule setInterval to fire as
// fast as the event loop allows and force Ink to re-render every tick.
// 50ms = 20 fps, more than any status spinner needs.
const MIN_INTERVAL_MS = 50;

export interface SpinnerProps {
  color?: string;
  // Requested tick interval in ms. Defaults to 125 (8 fps), the same
  // budget the rest of the TUI assumed before this prop existed.
  // Values below MIN_INTERVAL_MS are clamped up.
  intervalMs?: number;
}

export function Spinner(props: SpinnerProps): React.ReactElement {
  const interval = Math.max(MIN_INTERVAL_MS, props.intervalMs ?? 125);
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
