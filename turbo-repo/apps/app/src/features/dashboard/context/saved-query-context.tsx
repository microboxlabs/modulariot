"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import type { DashboardQueryDefinition } from "@microboxlabs/miot-dashboard-contract/document";
import type { createDashboardServerClient } from "../services/dashboard-server-client";
import { useDashboard } from "./dashboard-context";
import { useDashboardFilters } from "./dashboard-filters-context";
import {
  PlannerResultsProvider,
  type PlannerQueryResult,
} from "./planner-context";
import { usePollingInterval } from "../hooks/use-polling-interval";

type Session = {
  client: ReturnType<typeof createDashboardServerClient>;
  slug: string;
  queries: DashboardQueryDefinition[];
  errorMessage: string;
};
const SessionContext = createContext<Session | null>(null);

/** Organization-bound input outside the reusable widget provider. */
export function DashboardQuerySession({
  client,
  slug,
  queries,
  errorMessage,
  children,
}: Readonly<PropsWithChildren<Session>>) {
  const value = useMemo(
    () => ({ client, slug, queries, errorMessage }),
    [client, slug, queries, errorMessage]
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
  const { client, slug, queries, errorMessage } = session;
  const requestKey = JSON.stringify([
    client.key(slug),
    queries,
    selectedFilters(queries, activeFilters),
  ]);
  const [poll, setPoll] = useState(0);
  const [state, setState] = useState<{
    key: string;
    results: Map<string, PlannerQueryResult>;
  } | null>(null);
  const running = useRef(false);
  usePollingInterval(
    () => {
      if (!running.current) setPoll((value) => value + 1);
    },
    editMode ? 0 : refreshInterval * 1000
  );

  useEffect(() => {
    const controller = new AbortController();
    running.current = true;
    if (
      new Set(queries.map((query) => query.variableName)).size !==
        queries.length ||
      new Set(queries.map((query) => query.id)).size !== queries.length
    ) {
      running.current = false;
      setState({
        key: requestKey,
        results: new Map(
          queries.map((query) => [
            query.variableName,
            { rows: [], loading: false, error: errorMessage },
          ])
        ),
      });
      return () => controller.abort();
    }
    setState((previous) => {
      if (previous?.key === requestKey) return previous;
      const results = new Map<string, PlannerQueryResult>();
      for (const query of queries)
        results.set(query.variableName, {
          rows: [],
          loading: true,
          error: null,
        });
      return { key: requestKey, results };
    });
    let next = 0;
    async function worker() {
      while (next < queries.length && !controller.signal.aborted) {
        const query = queries[next++]!;
        const result = await queryResult(
          session,
          query,
          activeFilters,
          controller.signal
        );
        if (controller.signal.aborted) return;
        setState((previous) => {
          const results = new Map(
            previous?.key === requestKey ? previous.results : []
          );
          results.set(query.variableName, result);
          return { key: requestKey, results };
        });
      }
    }
    void Promise.all(
      Array.from({ length: Math.min(4, queries.length) }, worker)
    ).finally(() => {
      if (!controller.signal.aborted) running.current = false;
    });
    return () => {
      controller.abort();
      running.current = false;
    };
    // The serialized key includes every query/filter value; client identity handles host changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, client, poll, errorMessage]);

  const value = useMemo(() => {
    const results =
      state?.key === requestKey
        ? state.results
        : new Map<string, PlannerQueryResult>();
    const definitions = queries.map((query) => ({
      id: query.id,
      variableName: query.variableName,
      schema: query.schema,
      pgrestFunctionName: "",
      pgrestHttpMethod: "GET" as const,
      pgrestParams: [],
    }));
    const schemas = new Map(
      queries.map((query) => {
        const first = results.get(query.variableName)?.rows[0];
        return [
          query.variableName,
          first ? Object.keys(first) : (query.schema ?? []),
        ];
      })
    );
    return { results, definitions, schemas };
  }, [queries, requestKey, state]);
  return (
    <PlannerResultsProvider value={value}>{children}</PlannerResultsProvider>
  );
}

function selectedFilters(
  queries: DashboardQueryDefinition[],
  filters: Record<string, string>
) {
  const selected: Record<string, string> = {};
  for (const query of queries) {
    for (const parameter of Object.values(query.parameters)) {
      if (parameter.kind === "filter" && Object.hasOwn(filters, parameter.key))
        selected[parameter.key] = filters[parameter.key]!;
    }
  }
  return selected;
}

function renderValue(
  value: string | number | boolean | null | (string | number | boolean | null)[]
) {
  if (value === null) return "";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

async function queryResult(
  session: Session,
  query: DashboardQueryDefinition,
  filters: Record<string, string>,
  signal: AbortSignal
): Promise<PlannerQueryResult> {
  try {
    const rows = await session.client.query(
      session.slug,
      query.id,
      selectedFilters([query], filters),
      signal
    );
    return {
      rows: rows.map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([key, value]) => [key, renderValue(value)])
        )
      ),
      loading: false,
      error: null,
    };
  } catch {
    return { rows: [], loading: false, error: session.errorMessage };
  }
}
