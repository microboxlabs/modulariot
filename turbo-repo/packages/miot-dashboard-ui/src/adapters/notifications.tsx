/**
 * Seam C — notifications.
 *
 * Package components report user-facing outcomes through an injected
 * `NotifyFn`; hosts map it onto their toast/notification system. Defaults to
 * console logging so the package works standalone.
 */

import { createContext, useContext } from "react";
import type { ReactNode } from "react";

export type NotifyLevel = "success" | "error" | "warning" | "info";

export type NotifyFn = (level: NotifyLevel, message: string) => void;

/** Default notifier: console (warn/error for problems, log otherwise). */
export const consoleNotify: NotifyFn = (level, message) => {
  if (level === "error") console.error(`[miot-dashboard] ${message}`);
  else if (level === "warning") console.warn(`[miot-dashboard] ${message}`);
  else console.log(`[miot-dashboard] ${level}: ${message}`);
};

const NotifyContext = createContext<NotifyFn>(consoleNotify);

export interface DashboardNotificationsProviderProps {
  notify?: NotifyFn;
  children: ReactNode;
}

export function DashboardNotificationsProvider({
  notify,
  children,
}: DashboardNotificationsProviderProps) {
  return (
    <NotifyContext.Provider value={notify ?? consoleNotify}>
      {children}
    </NotifyContext.Provider>
  );
}

export function useDashboardNotify(): NotifyFn {
  return useContext(NotifyContext);
}
