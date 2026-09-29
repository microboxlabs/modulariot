"use client";

import {
  createContext,
  useContext,
  useMemo,
  type PropsWithChildren,
} from "react";
import type { DashboardQueryDefinition } from "@microboxlabs/miot-dashboard-contract/document";
import type { createDashboardServerClient } from "../services/dashboard-server-client";
import { useDashboard } from "./dashboard-context";
import { useDashboardFilters } from "./dashboard-filters-context";
import { PlannerResultsProvider } from "./planner-context";
import { useSavedQueryResults } from "@microboxlabs/miot-dashboard-ui/react";

type Session = {
  client: ReturnType<typeof createDashboardServerClient>;
  slug: string;
  sessionKey: string;
  queries: DashboardQueryDefinition[];
  errorMessage: string;
};
const SessionContext = createContext<Session | null>(null);

/** Organization-bound input outside the reusable widget provider. */
export function DashboardQuerySession({
  client,
  slug,
  sessionKey,
  queries,
  errorMessage,
  children,
}: Readonly<PropsWithChildren<Session>>) {
  const value = useMemo(
    () => ({ client, slug, sessionKey, queries, errorMessage }),
    [client, slug, sessionKey, queries, errorMessage]
  );
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

/** Mounted inside DashboardProvider; exposes only saved server-query results to widgets. */
export function SavedQueryResults({ children }: Readonly<PropsWithChildren>) {
  const session = useContext(SessionContext);
  if (!session) throw new Error("DashboardQuerySession is required");
  return <QueryResults session={session}>{children}</QueryResults>;
}

function QueryResults({
  session,
  children,
}: Readonly<PropsWithChildren<{ session: Session }>>) {
  const { refreshInterval, editMode } = useDashboard();
  const { activeFilters } = useDashboardFilters();
  const value = useSavedQueryResults({
    ...session,
    filters: activeFilters,
    refreshIntervalMs: refreshInterval * 1000,
    paused: editMode,
  });
  return (
    <PlannerResultsProvider value={value}>{children}</PlannerResultsProvider>
  );
}
