"use client";

import type { PropsWithChildren } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

interface SidebarContextProps {
  desktop: {
    activeSection: string | null;
    setActiveSection(label: string | null): void;
    toggleSection(label: string): void;
  };
  mobile: {
    isOpen: boolean;
    close(): void;
    toggle(): void;
  };
}

const SidebarContext = createContext<SidebarContextProps | null>(null);

export function SidebarProvider({ children }: Readonly<PropsWithChildren>) {
  const [isOpenMobile, setIsOpenMobile] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const toggleSection = useCallback((label: string) => {
    setActiveSection((prev) => (prev === label ? null : label));
  }, []);

  const closeMobile = useCallback(() => setIsOpenMobile(false), []);
  const toggleMobile = useCallback(() => setIsOpenMobile((s) => !s), []);

  const value = useMemo<SidebarContextProps>(
    () => ({
      desktop: {
        activeSection,
        setActiveSection,
        toggleSection,
      },
      mobile: {
        isOpen: isOpenMobile,
        close: closeMobile,
        toggle: toggleMobile,
      },
    }),
    [activeSection, toggleSection, isOpenMobile, closeMobile, toggleMobile]
  );

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
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
