import { createContext, useContext, useMemo, useState } from "react";
import { DARK_THEME } from "./themes.js";
import type { ThemeTokens } from "./tokens.js";

export interface ThemeContextValue {
  theme: ThemeTokens;
  setTheme: (next: ThemeTokens) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DARK_THEME,
  setTheme: () => undefined,
});

export interface ThemeProviderProps {
  initialTheme?: ThemeTokens;
  children: React.ReactNode;
}

export function ThemeProvider(
  props: ThemeProviderProps,
): React.ReactElement {
  const [theme, setTheme] = useState<ThemeTokens>(
    props.initialTheme ?? DARK_THEME,
  );
  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme }),
    [theme],
  );
  return (
    <ThemeContext.Provider value={value}>
      {props.children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
