"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

// ============================================================================
// Types
// ============================================================================

export interface DirtySettingsContextValue {
  /** Whether the form in this provider has unsaved changes */
  isDirty: boolean;
  /** Register the current dirty state from a child component */
  registerDirty: (dirty: boolean) => void;
  /** The save-and-close callback registered by the shell */
  onSaveAndClose: (() => void) | undefined;
  /** Let the shell register its save+close handler */
  registerSaveAndClose: (fn: (() => void) | undefined) => void;
}

// ============================================================================
// Context
// ============================================================================

const DirtySettingsContext = createContext<DirtySettingsContextValue>({
  isDirty: false,
  registerDirty: () => {},
  onSaveAndClose: undefined,
  registerSaveAndClose: () => {},
});

// ============================================================================
// Provider
// ============================================================================

export interface DirtySettingsProviderProps {
  children: ReactNode;
}

export function DirtySettingsProvider({
  children,
}: Readonly<DirtySettingsProviderProps>) {
  const [isDirty, setIsDirty] = useState(false);
  const saveAndCloseRef = useRef<(() => void) | undefined>(undefined);
  const [hasSaveAndClose, setHasSaveAndClose] = useState(false);

  const registerDirty = useCallback((dirty: boolean) => {
    setIsDirty(dirty);
  }, []);

  const registerSaveAndClose = useCallback((fn: (() => void) | undefined) => {
    saveAndCloseRef.current = fn;
    setHasSaveAndClose(fn !== undefined);
  }, []);

  // Stable wrapper that reads the ref at call time — never stale
  const onSaveAndClose = useCallback(() => {
    saveAndCloseRef.current?.();
  }, []);

  const value = useMemo(
    () => ({
      isDirty,
      registerDirty,
      onSaveAndClose: hasSaveAndClose ? onSaveAndClose : undefined,
      registerSaveAndClose,
    }),
    [
      isDirty,
      registerDirty,
      onSaveAndClose,
      hasSaveAndClose,
      registerSaveAndClose,
    ]
  );

  return (
    <DirtySettingsContext.Provider value={value}>
      {children}
    </DirtySettingsContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

/** Read dirty state from the nearest DirtySettingsProvider */
export function useDirtySettings(): DirtySettingsContextValue {
  return useContext(DirtySettingsContext);
}
