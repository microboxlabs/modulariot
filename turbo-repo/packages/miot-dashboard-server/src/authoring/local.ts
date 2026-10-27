/**
 * Query authoring for a server that keeps its own datasources and credentials:
 * the sources are its active BIGQUERY datasources, the token comes from the
 * service account in the vault, and saved queries are run by
 * `createLocalQueryOperations`.
 */

import type { QuerySource } from "@microboxlabs/miot-dashboard-contract/authoring";
import { serviceAccountAccessToken } from "../identity/google-service-account";
import {
  createBigQueryOperationExecutor,
  type BigQueryRunnerOptions,
} from "../queries/bigquery";
import type {
  AuthoringRequest,
  QueryAuthoring,
  QueryPlanStore,
  SourceAccess,
} from "../seams/authoring";
import type { CredentialsVault } from "../seams/credentials";
import type {
  DataSourceDescriptor,
  DataSourceStore,
} from "../seams/datasources";
import type { DashboardOperationExecutor } from "../seams/operations";
import type { DashboardQueryCatalog } from "../seams/query-catalog";
import { planOf } from "./workbench";

/** `jobs.insert` needs the full BigQuery scope; the read-only one cannot run jobs. */
export const BIGQUERY_SCOPE = "https://www.googleapis.com/auth/bigquery";

export interface LocalQueryAuthoringOptions {
  dataSources: DataSourceStore;
  credentials: CredentialsVault;
  plans: QueryPlanStore;
  /** For the token endpoint. */
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export function createLocalQueryAuthoring(
  options: LocalQueryAuthoringOptions,
): QueryAuthoring {
  const now = options.now ?? Date.now;
  const tokens = new Map<string, { token: string; expiresAt: number }>();

  const usable = (source: DataSourceDescriptor | null) =>
    source !== null &&
    source.type === "BIGQUERY" &&
    source.isActive &&
    source.credentialRef !== undefined;

  async function serviceAccount(
    tenantId: string,
    source: DataSourceDescriptor,
  ) {
    if (source.credentialRef === undefined) return null;
    const credential = await options.credentials.resolve(
      tenantId,
      source.credentialRef,
    );
    return credential?.kind === "SERVICE_ACCOUNT" ? credential : null;
  }

  async function listSources(
    request: AuthoringRequest,
  ): Promise<QuerySource[]> {
    const tenantId = request.identity.tenantId;
    const sources: QuerySource[] = [];
    for (const source of await options.dataSources.list(tenantId)) {
      if (!usable(source)) continue;
      const account = await serviceAccount(tenantId, source);
      if (account === null) continue;
      sources.push({
        id: source.id,
        label: source.name,
        kind: "BIGQUERY",
        defaultProjectId: account.projectId,
      });
    }
    return sources;
  }

  async function accessFor(
    request: AuthoringRequest & { sourceId: string },
  ): Promise<SourceAccess | null> {
    const tenantId = request.identity.tenantId;
    const source = await options.dataSources.get(tenantId, request.sourceId);
    if (source === null || !usable(source)) return null;
    const key = [tenantId, source.id, source.credentialRef].join("\0");
    const cached = tokens.get(key);
    if (cached && cached.expiresAt - 60_000 > now())
      return {
        accessToken: cached.token,
        expiresAt: new Date(cached.expiresAt).toISOString(),
      };
    const account = await serviceAccount(tenantId, source);
    if (account === null) return null;
    const granted = await serviceAccountAccessToken({
      clientEmail: account.clientEmail,
      privateKey: account.privateKey,
      scope: BIGQUERY_SCOPE,
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
      now,
    });
    tokens.set(key, granted);
    return {
      accessToken: granted.token,
      expiresAt: new Date(granted.expiresAt).toISOString(),
    };
  }

  return { listSources, accessFor, plans: options.plans };
}

/**
 * Runs saved queries from dashboards and lists them in the query catalog: the
 * source is the connection and each saved query an operation. Parameters a
 * dashboard does not send are bound as null.
 */
export function createLocalQueryOperations(
  options: BigQueryRunnerOptions & { authoring: QueryAuthoring },
): DashboardOperationExecutor & { queryCatalog: DashboardQueryCatalog } {
  const { authoring } = options;
  const executor = createBigQueryOperationExecutor({
    ...options,
    async resolve(request) {
      const tenantId = request.identity.tenantId;
      const plan = await authoring.plans.get(
        tenantId,
        request.connectionId,
        request.operationId,
      );
      if (plan === null) return null;
      const declared = new Set(
        plan.parameters.map((parameter) => parameter.name),
      );
      if (Object.keys(request.parameters).some((name) => !declared.has(name)))
        return null;
      const access = await authoring.accessFor({
        identity: request.identity,
        scopeId: request.ref.scopeId,
        signal: request.signal,
        sourceId: request.connectionId,
      });
      if (access === null) return null;
      return {
        plan: planOf(plan),
        parameters: Object.fromEntries(
          plan.parameters.map((parameter) => [
            parameter.name,
            request.parameters[parameter.name] ?? null,
          ]),
        ),
        accessToken: access.accessToken,
      };
    },
  });
  return {
    execute: (request) => executor.execute(request),
    queryCatalog: {
      async list({ identity, ref, signal }) {
        const sources = await authoring.listSources({
          identity,
          scopeId: ref.scopeId,
          signal,
        });
        const connections = [];
        for (const source of sources) {
          const plans = await authoring.plans.list(
            identity.tenantId,
            source.id,
          );
          connections.push({
            id: source.id,
            label: source.label,
            operations: plans.map((plan) => ({
              id: plan.id,
              label: plan.name,
              ...(plan.columns
                ? { schema: plan.columns.map((column) => column.name) }
                : {}),
            })),
          });
        }
        return connections;
      },
    },
  };
}
