import { useStdout } from "ink";
import { useEffect, useState } from "react";

const FALLBACK_COLUMNS = 80;
// Below this the chrome's border math degenerates; clamp so callers
// never have to handle absurd widths.
const MIN_COLUMNS = 20;

export function useTerminalWidth(): number {
  const { stdout } = useStdout();
  const [columns, setColumns] = useState<number>(
    stdout?.columns ?? FALLBACK_COLUMNS,
  );

  useEffect(() => {
    if (!stdout) return;
    const onResize = (): void => {
      setColumns(stdout.columns ?? FALLBACK_COLUMNS);
    };
    stdout.on("resize", onResize);
    return (): void => {
      stdout.off("resize", onResize);
    };
  }, [stdout]);

  return Math.max(MIN_COLUMNS, columns);
}
