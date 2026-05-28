import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "kanbanCompactView";

/**
 * Persists the board-wide compact/expanded card toggle (the header "expand"
 * action) to localStorage so the choice survives reloads. Starts from
 * `initial` on first render and hydrates the saved value after mount.
 */
export function useCompactViewPreference(initial = true) {
  const [compact, setCompactState] = useState(initial);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        setCompactState(saved === "true");
      }
    } catch {
      // Storage unavailable (private mode); keep the in-memory value.
    }
  }, []);

  const setCompact = useCallback((value: boolean) => {
    setCompactState(value);
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // Ignore persistence failures and keep in-memory state.
    }
  }, []);

  return [compact, setCompact] as const;
}
