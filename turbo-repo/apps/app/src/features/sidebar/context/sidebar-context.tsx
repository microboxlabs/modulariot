"use client";

import type { PropsWithChildren } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

/** The section the gear opens: the Ajustes menu. */
export const SETTINGS_SECTION_LABEL = "settings";

interface SidebarContextProps {
  desktop: {
    activeSection: string | null;
    setActiveSection(label: string | null): void;
    toggleSection(label: string): void;
  };
  mobile: {
    isOpen: boolean;
    /** The section to show when the sidebar opens; null picks the one of the current page. */
    initialSection: string | null;
    close(): void;
    toggle(): void;
    openSection(label: string): void;
  };
}

const SidebarContext = createContext<SidebarContextProps | null>(null);

export function SidebarProvider({ children }: Readonly<PropsWithChildren>) {
  const [isOpenMobile, setIsOpenMobile] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const toggleSection = useCallback((label: string) => {
    setActiveSection((prev) => (prev === label ? null : label));
  }, []);

  const [initialSection, setInitialSection] = useState<string | null>(null);
  const closeMobile = useCallback(() => {
    setIsOpenMobile(false);
    setInitialSection(null);
  }, []);
  const toggleMobile = useCallback(() => setIsOpenMobile((s) => !s), []);
  const openMobileSection = useCallback((label: string) => {
    setInitialSection(label);
    setIsOpenMobile(true);
  }, []);

  const value = useMemo<SidebarContextProps>(
    () => ({
      desktop: {
        activeSection,
        setActiveSection,
        toggleSection,
      },
      mobile: {
        isOpen: isOpenMobile,
        initialSection,
        close: closeMobile,
        toggle: toggleMobile,
        openSection: openMobileSection,
      },
    }),
    [
      activeSection,
      toggleSection,
      isOpenMobile,
      initialSection,
      closeMobile,
      toggleMobile,
      openMobileSection,
    ]
  );

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
}

/** The sidebar, or null outside the secured layout (e.g. in a test or a kiosk page). */
export function useOptionalSidebarContext(): SidebarContextProps | null {
  return useContext(SidebarContext);
}

export function useSidebarContext(): SidebarContextProps {
  const context = useContext(SidebarContext);

  if (!context) {
    throw new Error(
      "useSidebarContext must be used within the SidebarContext provider!"
    );
  }

  return context;
}
