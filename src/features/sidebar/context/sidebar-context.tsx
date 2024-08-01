"use client";

import type { PropsWithChildren } from "react";
import { createContext, useContext, useState } from "react";
import { SidebarCookie } from "../services/sidebar-cookie.service.types";

interface SidebarContextProps {
  desktop: {
    isCollapsed: boolean;
    setCollapsed(value: boolean): void;
    toggle(): void;
  };
  mobile: {
    isOpen: boolean;
    close(): void;
    toggle(): void;
  };
}

const SidebarContext = createContext<SidebarContextProps | null>(null);

export function SidebarProvider({
  initialCollapsed,
  children,
}: PropsWithChildren<{ initialCollapsed: boolean }>) {
  const [isOpenMobile, setIsOpenMobile] = useState(false);
  const [isCollapsed, setCollapsed] = useState(initialCollapsed);

  function handleSetCollapsed(value: boolean) {
    setCollapsed(value);
    setCookie(value);
  }

  function setCookie(value: boolean) {
    fetch("/api/sidebar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        isCollapsed: value,
      } satisfies SidebarCookie),
    });
  }

  return (
    <SidebarContext.Provider
      value={{
        desktop: {
          isCollapsed,
          setCollapsed: handleSetCollapsed,
          toggle: () => handleSetCollapsed(!isCollapsed),
        },
        mobile: {
          isOpen: isOpenMobile,
          close: () => setIsOpenMobile(false),
          toggle: () => setIsOpenMobile((state) => !state),
        },
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebarContext(): SidebarContextProps {
  const context = useContext(SidebarContext);

  if (!context) {
    throw new Error(
      "useSidebarContext must be used within the SidebarContext provider!",
    );
  }

  return context;
}
