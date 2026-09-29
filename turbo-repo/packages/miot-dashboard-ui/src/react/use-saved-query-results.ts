"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  DashboardQueryDefinition,
  DashboardQueryValue,
} from "@microboxlabs/miot-dashboard-contract/document";
import type { PlannerQueryResult } from "./planner-results";
import { usePollingInterval } from "./use-polling-interval";

/** Minimal saved-query transport; compatible with createDashboardClient. */
export interface DashboardQueryClient {
  key: (slug: string) => string;
  query: (
    slug: string,
    queryId: string,
    filters: Record<string, DashboardQueryValue>,
    signal: AbortSignal,
  ) => Promise<Record<string, DashboardQueryValue>[]>;
}
export interface SavedQueryOptions {
  client: DashboardQueryClient;
  sessionKey: string;
  slug: string;
  queries: readonly DashboardQueryDefinition[];
  filters: Readonly<Record<string, string>>;
  refreshIntervalMs: number;
  paused: boolean;
  errorMessage: string;
}

export function useSavedQueryResults({
  client,
  sessionKey,
  slug,
  queries,
  filters: activeFilters,
  refreshIntervalMs,
  paused,
  errorMessage,
}: SavedQueryOptions) {
  const requestKey = JSON.stringify([
    sessionKey,
    client.key(slug),
    queries,
    selectedFilters(queries, activeFilters),
  ]);
  const [poll, setPoll] = useState(0);
  const [state, setState] = useState<{
    key: string;
    client: DashboardQueryClient;
    results: Map<string, PlannerQueryResult>;
  } | null>(null);
  const running = useRef(false);
  usePollingInterval(
    () => {
      if (!running.current) setPoll((value) => value + 1);
    },
    paused ? 0 : refreshIntervalMs,
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
        client,
        results: new Map(
          queries.map((query) => [
            query.variableName,
            { rows: [], loading: false, error: errorMessage },
          ]),
        ),
      });
      return () => controller.abort();
    }
    setState((previous) => {
      if (previous?.key === requestKey && previous.client === client)
        return previous;
      const results = new Map<string, PlannerQueryResult>();
      for (const query of queries)
        results.set(query.variableName, {
          rows: [],
          loading: true,
          error: null,
        });
      return { key: requestKey, client, results };
    });
    let next = 0;
    async function worker() {
      while (next < queries.length && !controller.signal.aborted) {
        const query = queries[next++]!;
        const result = await queryResult(
          { client, slug, errorMessage },
          query,
          activeFilters,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setState((previous) => {
          const results = new Map(
            previous?.key === requestKey && previous.client === client
              ? previous.results
              : [],
          );
          results.set(query.variableName, result);
          return { key: requestKey, client, results };
        });
      }
    }
    void Promise.all(
      Array.from({ length: Math.min(4, queries.length) }, worker),
    ).finally(() => {
      if (!controller.signal.aborted) running.current = false;
    });
    return () => {
      controller.abort();
      running.current = false;
    };
    // The serialized key includes every query/filter value; client identity handles host changes.
  }, [requestKey, client, poll, errorMessage]);

  const value = useMemo(() => {
    const results =
      state?.key === requestKey && state.client === client
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
      }),
    );
    return { results, definitions, schemas };
  }, [queries, requestKey, state, client]);
  return value;
}

function selectedFilters(
  queries: readonly DashboardQueryDefinition[],
  filters: Readonly<Record<string, string>>,
) {
  const selected = new Map<string, string>();
  for (const query of queries) {
    for (const parameter of Object.values(query.parameters)) {
      if (parameter.kind === "filter" && Object.hasOwn(filters, parameter.key))
        selected.set(parameter.key, filters[parameter.key]!);
    }
  }
  return Object.fromEntries(selected);
}

function renderValue(
  value:
    | string
    | number
    | boolean
    | null
    | (string | number | boolean | null)[],
) {
  if (value === null) return "";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

async function queryResult(
  session: Pick<SavedQueryOptions, "client" | "slug" | "errorMessage">,
  query: DashboardQueryDefinition,
  filters: Readonly<Record<string, string>>,
  signal: AbortSignal,
): Promise<PlannerQueryResult> {
  try {
    const rows = await session.client.query(
      session.slug,
      query.id,
      selectedFilters([query], filters),
      signal,
    );
    return {
      rows: rows.map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([key, value]) => [key, renderValue(value)]),
        ),
      ),
      loading: false,
      error: null,
    };
  } catch {
    return { rows: [], loading: false, error: session.errorMessage };
  }
}
