/**
 * Query authoring for a server that keeps its own datasources and credentials:
 * the sources are its active BIGQUERY datasources, the token comes from the
 * service account in the vault, and saved queries are run by
 * `createLocalQueryOperations`.
 */

import { createHash } from "node:crypto";
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
  const tokens = new Map<
    string,
    { token: string; expiresAt: number; fingerprint: string }
  >();

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
    const sources = await options.dataSources.list(tenantId);
    const available = await Promise.all(
      sources
        .filter(usable)
        .map(async (source): Promise<QuerySource | null> => {
          const account = await serviceAccount(tenantId, source);
          if (account === null) return null;
          return {
            id: source.id,
            label: source.name,
            kind: "BIGQUERY",
            defaultProjectId: account.projectId,
          };
        }),
    );
    return available.filter((source): source is QuerySource => source !== null);
  }

  async function accessFor(
    request: AuthoringRequest & { sourceId: string },
  ): Promise<SourceAccess | null> {
    const tenantId = request.identity.tenantId;
    const source = await options.dataSources.get(tenantId, request.sourceId);
    if (source === null || !usable(source)) return null;
    const key = JSON.stringify([tenantId, source.id, source.credentialRef]);
    const account = await serviceAccount(tenantId, source);
    if (account === null) {
      tokens.delete(key);
      return null;
    }
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify([
          account.projectId,
          account.clientEmail,
          account.privateKey,
        ]),
      )
      .digest("hex");
    const cached = tokens.get(key);
    if (
      cached?.fingerprint === fingerprint &&
      cached.expiresAt - 60_000 > now()
    ) {
      return {
        accessToken: cached.token,
        expiresAt: new Date(cached.expiresAt).toISOString(),
      };
    }
    const granted = await serviceAccountAccessToken({
      clientEmail: account.clientEmail,
      privateKey: account.privateKey,
      scope: BIGQUERY_SCOPE,
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
      now,
    });
    tokens.delete(key);
    if (tokens.size >= 64) {
      const oldest = tokens.keys().next().value;
      if (oldest !== undefined) tokens.delete(oldest);
    }
    tokens.set(key, { ...granted, fingerprint });
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
        const connections = await Promise.all(
          sources.map(async (source) => {
            const plans = await authoring.plans.list(
              identity.tenantId,
              source.id,
            );
            return {
              id: source.id,
              label: source.label,
              operations: plans.map((plan) => ({
                id: plan.id,
                label: plan.name,
                ...(plan.columns
                  ? { schema: plan.columns.map((column) => column.name) }
                  : {}),
              })),
            };
          }),
        );
        return connections;
      },
    },
  };
}
