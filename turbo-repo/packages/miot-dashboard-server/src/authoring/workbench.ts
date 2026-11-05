import {
  problemFromMessage,
  queryPlanDraftSchema,
  type QueryColumn,
  type QueryEstimate,
  type QueryPlan,
  type QueryPlanDraft,
  type QueryPreview,
  type QuerySource,
  type SourceSchema,
} from "@microboxlabs/miot-dashboard-contract/authoring";
import type { DashboardQueryValue } from "@microboxlabs/miot-dashboard-contract/document";
import { DashboardServerError } from "../access/errors";
import { BigQueryProblem, createBigQueryRunner } from "../queries/bigquery";
import type { BigQueryPlan } from "../queries/bigquery-plan";
import type {
  AuthoringRequest,
  QueryAuthoring,
  SourceAccess,
} from "../seams/authoring";
import { columnsOf, previewOf } from "./preview";
import { readSourceSchema } from "./source-schema";

/** The limits a dashboard applies to a query result. */
export const PREVIEW_LIMITS = { maxRows: 5000, maxBytes: 2 * 1024 * 1024 };

export interface QueryWorkbenchOptions {
  authoring: QueryAuthoring;
  /** Host cap on a query's `maximumBytesBilled`; 1 GB by default. */
  maximumBytesBilled?: number;
  /** At most 20 s. */
  timeoutMs?: number;
  /** How long a source schema is reused; 10 minutes by default. */
  schemaTtlMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export interface QueryWorkbench {
  sources(request: AuthoringRequest): Promise<QuerySource[]>;
  schema(
    request: AuthoringRequest,
    sourceId: string,
    projectId: string,
    options?: { refresh?: boolean },
  ): Promise<SourceSchema>;
  estimate(
    request: AuthoringRequest,
    sourceId: string,
    draft: unknown,
  ): Promise<QueryEstimate>;
  preview(
    request: AuthoringRequest,
    sourceId: string,
    draft: unknown,
  ): Promise<QueryPreview>;
  listPlans(request: AuthoringRequest, sourceId: string): Promise<QueryPlan[]>;
  getPlan(
    request: AuthoringRequest,
    sourceId: string,
    planId: string,
  ): Promise<QueryPlan>;
  createPlan(
    request: AuthoringRequest,
    sourceId: string,
    draft: unknown,
  ): Promise<QueryPlan>;
  updatePlan(
    request: AuthoringRequest,
    sourceId: string,
    planId: string,
    draft: unknown,
    expectedRevision: string,
  ): Promise<QueryPlan>;
  removePlan(
    request: AuthoringRequest,
    sourceId: string,
    planId: string,
  ): Promise<void>;
}

const MAX_CACHED = 64;

function parseDraft(input: unknown): QueryPlanDraft {
  const parsed = queryPlanDraftSchema.safeParse(input);
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  const field = issue?.path.join(".") || "draft";
  throw DashboardServerError.badRequest(
    `Invalid query ${field}: ${issue?.message ?? "invalid"}`,
  );
}

export function planOf(draft: QueryPlanDraft): BigQueryPlan {
  return {
    projectId: draft.projectId,
    location: draft.location,
    sql: draft.sql,
    maximumBytesBilled: draft.maximumBytesBilled,
    parameterTypes: Object.fromEntries(
      draft.parameters.map((parameter) => [parameter.name, parameter.type]),
    ),
  };
}

function samplesOf(draft: QueryPlanDraft): Record<string, DashboardQueryValue> {
  return Object.fromEntries(
    draft.parameters.map((parameter) => [
      parameter.name,
      parameter.sample ?? null,
    ]),
  );
}

function problemOf(error: unknown) {
  if (error instanceof BigQueryProblem)
    return problemFromMessage(error.message);
  throw error;
}

export function createQueryWorkbench(
  options: QueryWorkbenchOptions,
): QueryWorkbench {
  const runner = createBigQueryRunner(options);
  const now = options.now ?? Date.now;
  const schemaTtlMs = options.schemaTtlMs ?? 10 * 60_000;
  const schemas = new Map<string, { at: number; schema: SourceSchema }>();
  const { authoring } = options;

  async function access(
    request: AuthoringRequest,
    sourceId: string,
  ): Promise<SourceAccess> {
    const granted = await authoring.accessFor({ ...request, sourceId });
    request.signal.throwIfAborted();
    if (!granted?.accessToken)
      throw DashboardServerError.notFound("Query source not found");
    return granted;
  }

  function checkCap(draft: QueryPlanDraft) {
    if (draft.maximumBytesBilled > runner.byteCap)
      throw DashboardServerError.badRequest(
        `Invalid query maximumBytesBilled: at most ${runner.byteCap}`,
      );
  }

  async function estimateDraft(
    token: string,
    draft: QueryPlanDraft,
    signal: AbortSignal,
  ): Promise<QueryEstimate> {
    const deadline = AbortSignal.any([
      signal,
      AbortSignal.timeout(runner.timeoutMs),
    ]);
    try {
      const dry = await runner.dryRun(
        planOf(draft),
        samplesOf(draft),
        token,
        deadline,
      );
      deadline.throwIfAborted();
      const estimate: QueryEstimate = {
        ok: dry.statementType === "SELECT",
        statementType: dry.statementType,
        totalBytesProcessed: Number(dry.totalBytesProcessed),
        columns: columnsOf(dry.fields),
      };
      if (!estimate.ok)
        estimate.problem = {
          message: `Only SELECT statements can be saved; this one is ${dry.statementType}`,
        };
      return estimate;
    } catch (error) {
      if (deadline.aborted && !signal.aborted) {
        return {
          ok: false,
          problem: {
            message: `The estimate took more than ${runner.timeoutMs / 1000} s`,
          },
        };
      }
      return { ok: false, problem: problemOf(error) };
    }
  }

  async function checkedContent(
    request: AuthoringRequest,
    sourceId: string,
    input: unknown,
  ) {
    const draft = parseDraft(input);
    checkCap(draft);
    const granted = await access(request, sourceId);
    const estimate = await estimateDraft(
      granted.accessToken,
      draft,
      request.signal,
    );
    if (!estimate.ok)
      throw DashboardServerError.badRequest(
        `BigQuery refused the query: ${estimate.problem?.message ?? "unknown error"}`,
      );
    return { ...draft, columns: estimate.columns ?? [] };
  }

  async function knownPlan(
    request: AuthoringRequest,
    sourceId: string,
    planId: string,
  ) {
    const plan = await authoring.plans.get(
      request.identity.tenantId,
      sourceId,
      planId,
    );
    if (plan === null) throw DashboardServerError.notFound("Query not found");
    return plan;
  }

  return {
    sources: (request) => authoring.listSources(request),

    async schema(request, sourceId, projectId, schemaOptions = {}) {
      if (!/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(projectId))
        throw DashboardServerError.badRequest("Invalid projectId");
      const granted = await access(request, sourceId);
      const key = JSON.stringify([
        request.identity.tenantId,
        request.identity.userId,
        request.identity.kind,
        request.scopeId,
        sourceId,
        projectId,
      ]);
      const cached = schemas.get(key);
      if (cached && !schemaOptions.refresh && now() - cached.at < schemaTtlMs)
        return cached.schema;
      let schema: SourceSchema;
      try {
        schema = await readSourceSchema({
          projectId,
          token: granted.accessToken,
          signal: request.signal,
          maximumBytesBilled: runner.byteCap,
          call: runner.call,
        });
      } catch (error) {
        if (error instanceof BigQueryProblem)
          throw new DashboardServerError("UPSTREAM_ERROR", error.message);
        if (
          !request.signal.aborted &&
          error instanceof Error &&
          ["TimeoutError", "AbortError"].includes(error.name)
        )
          throw new DashboardServerError(
            "UPSTREAM_ERROR",
            "BigQuery did not answer the schema request in time",
          );
        throw error;
      }
      if (schemas.size >= MAX_CACHED) {
        const oldest = schemas.keys().next().value;
        if (oldest !== undefined) schemas.delete(oldest);
      }
      schemas.delete(key);
      schemas.set(key, { at: now(), schema });
      return schema;
    },

    async estimate(request, sourceId, input) {
      const draft = parseDraft(input);
      checkCap(draft);
      const granted = await access(request, sourceId);
      return estimateDraft(granted.accessToken, draft, request.signal);
    },

    async preview(request, sourceId, input) {
      const draft = parseDraft(input);
      checkCap(draft);
      const granted = await access(request, sourceId);
      const started = now();
      const signal = AbortSignal.any([
        request.signal,
        AbortSignal.timeout(runner.timeoutMs),
      ]);
      try {
        return await runner.run(
          planOf(draft),
          samplesOf(draft),
          granted.accessToken,
          signal,
          PREVIEW_LIMITS,
          (result) =>
            previewOf(result, PREVIEW_LIMITS.maxRows, now() - started),
        );
      } catch (error) {
        if (signal.aborted && !request.signal.aborted)
          return failedPreview({
            message: `The query took more than ${runner.timeoutMs / 1000} s, the dashboard limit`,
          });
        return failedPreview(problemOf(error));
      }
    },

    listPlans: async (request, sourceId) => {
      await access(request, sourceId);
      return authoring.plans.list(request.identity.tenantId, sourceId);
    },

    getPlan: async (request, sourceId, planId) => {
      await access(request, sourceId);
      return knownPlan(request, sourceId, planId);
    },

    async createPlan(request, sourceId, input) {
      const content = await checkedContent(request, sourceId, input);
      return authoring.plans.create(
        request.identity.tenantId,
        sourceId,
        content,
        request.identity.userId,
      );
    },

    async updatePlan(request, sourceId, planId, input, expectedRevision) {
      const content = await checkedContent(request, sourceId, input);
      await knownPlan(request, sourceId, planId);
      return authoring.plans.update(
        request.identity.tenantId,
        sourceId,
        planId,
        content,
        expectedRevision,
        request.identity.userId,
      );
    },

    async removePlan(request, sourceId, planId) {
      await access(request, sourceId);
      await knownPlan(request, sourceId, planId);
      await authoring.plans.remove(request.identity.tenantId, sourceId, planId);
    },
  };
}

function failedPreview(problem: { message: string }): QueryPreview {
  return {
    ok: false,
    columns: [] as QueryColumn[],
    rows: [],
    totalRows: 0,
    truncated: false,
    totalBytesProcessed: 0,
    cacheHit: false,
    durationMs: 0,
    warnings: [],
    problem,
  };
}
