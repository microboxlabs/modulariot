import type { DashboardQueryCatalog } from "../seams/query-catalog";
import { projectQueryCatalog } from "./query-catalog";
import type { QueryAuthoring } from "../seams/authoring";
import {
  createQueryWorkbench,
  type QueryWorkbenchOptions,
} from "../authoring/workbench";
/**
 * The HTTP layer: a Web `Request` in, a Web `Response` out.
 *
 * This is the seam between the package and any way of serving it. It holds no
 * listener and imports no framework, so exactly one implementation serves both
 * shapes the project supports:
 *
 *  - an existing server mounts it (Next route handlers re-export it; anything
 *    fetch-shaped calls it directly),
 *  - the standalone server wraps it in a Node listener.
 *
 * Written against Web standard `Request` and `Response` rather than a
 * framework's own types on purpose. Next 16 route handlers already accept and
 * return these, so a Next adapter is a re-export rather than a translation,
 * and no framework version churn reaches consumers.
 *
 * Every route authorizes before it touches the store. That ordering is not
 * repeated per route: each one calls `authorize` first and uses the decision
 * it returns, which already carries the loaded record.
 */

import {
  createDashboardQueryService,
  type DashboardQueryOptions,
} from "../queries/service";
import { DEFAULT_MAX_BODY_BYTES, readJsonBody } from "./read-json";
import { validateDashboardConfig } from "@microboxlabs/miot-dashboard-contract/schema";
import {
  createAccessControl,
  type AccessControlOptions,
  type AccessDecision,
} from "../access/access-control";
import { DashboardServerError, isDashboardServerError } from "../access/errors";
import {
  applyCredential,
  isCredentialsStore,
  type CredentialInput,
  type CredentialsVault,
  type DataSourceCredential,
} from "../seams/credentials";
import type {
  DataSourceDescriptor,
  DataSourceInput,
  DataSourceStore,
} from "../seams/datasources";
import {
  parseCredentialInput,
  parseDataSourceInput,
  parseDataSourceTestInput,
} from "./parse-datasource";
import {
  testDataSourceConnection,
  untested,
  type ConnectionTestResult,
  type TestConnectionOptions,
} from "./test-connection";
import { errorResponse, jsonResponse, noContentResponse } from "./responses";
import { matchRoute, type RouteMatch } from "./routes";
import { withoutVisibilitySnapshot } from "../access/visibility-snapshot";
import { createScopedRouteRunner } from "./folder-transaction";
import { removeAuthorizedDashboard } from "./remove-dashboard";
import { createFolderRoutes } from "./folder-routes";
import { parseAssignments } from "./parse-assignments";
import type { DashboardFolderStore } from "../seams/folders";
import { restrictedConfig, scopeVisibilityLoader } from "../access/visibility";
import { withCors, type CorsOptions } from "./cors";

export interface DashboardHandlerOptions extends AccessControlOptions<Request> {
  /**
   * Path prefix the routes are mounted under, e.g. "/api/dashboard".
   * Stripped before matching. Defaults to the root.
   */
  basePath?: string;
  /** Optional host-authorized authoring metadata; omitted routes return 404. */
  queryCatalog?: DashboardQueryCatalog;
  cors?: CorsOptions;
  /** Maximum JSON body bytes in embedded and standalone handlers; default 1 MiB. */
  maxBodyBytes?: number;
  /** Omit to disable saved-query execution (404). */
  queries?: Pick<
    DashboardQueryOptions<Request>,
    "operations" | "timeoutMs" | "maxConcurrent" | "maxRows" | "maxBytes"
  >;
  /** Omit it and the datasource routes answer 404. */
  dataSources?: DataSourceStore;
  /**
   * The credential routes are served only when this vault can be written to
   * (see `isCredentialsStore`). A read-only one answers 404.
   */
  credentials?: CredentialsVault;
  /** Omit it and the query-source routes answer 404. */
  authoring?: QueryAuthoring;
  /**
   * Omit it and the folder routes answer 404, and the dashboard listing
   * carries no `folderId`.
   */
  folders?: DashboardFolderStore;
  /** Limits, clock and fetch of the query editor. */
  authoringOptions?: Omit<QueryWorkbenchOptions, "authoring">;
  /** Clock, fetch and timeout for the connection test. For tests. */
  testConnection?: TestConnectionOptions;
  /**
   * Called with what this handler did not choose: anything thrown that is not
   * a `DashboardServerError`, and so became a bare 500. A 404, a 403 or a 409
   * is an answer this code decided on and already says so on the wire, so it
   * does not arrive here — nothing routine reads as a fault.
   *
   * The 500 envelope is deliberately bare, because an upstream exception is
   * the most likely place a connection string or a token surfaces. That
   * redaction leaves the operator with a 500 and no cause, so the error is
   * handed here instead and a host decides what to do with it. The standalone
   * server logs it.
   *
   * Anything this throws is swallowed: a failing logger must not turn a
   * request that had an answer into one that does not.
   */
  onError?: (error: unknown, request: Request) => void;
}

export type DashboardHandler = (request: Request) => Promise<Response>;

/**
 * Build the request handler.
 *
 * Returns 404 with the standard envelope for anything it does not recognise,
 * so a host mounting it under a prefix gets a consistent body even for a
 * mistyped path.
 */
/**
 * Who sees a dashboard is part of who may use it, so only who manages its
 * permissions changes it. A first save sets it freely: its creator is about
 * to manage them.
 */
function requireVisibilityUnchangedOrManaged(
  decision: AccessDecision,
  config: unknown,
  atomic: boolean,
): void {
  const record = decision.dashboard?.record;
  requireAtomicPrivateMutation(record?.config, atomic);
  requireAtomicPrivateMutation(config, atomic);
  if (!record) return;
  if (restrictedConfig(record.config) === restrictedConfig(config)) return;
  if (decision.dashboard?.capabilities.canManagePermissions) {
    if (!atomic)
      throw DashboardServerError.badRequest(
        "Changing dashboard visibility is unavailable for this store",
      );
    return;
  }
  throw DashboardServerError.forbidden(
    "CAPABILITY",
    "Only who manages this dashboard's permissions may change who sees it",
  );
}

function requireAtomicPrivateMutation(config: unknown, atomic: boolean): void {
  if (!atomic && restrictedConfig(config)) {
    throw DashboardServerError.badRequest(
      "Changing restricted dashboards is unavailable for this store",
    );
  }
}

export function createDashboardHandler(
  options: DashboardHandlerOptions,
): DashboardHandler {
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  if (!Number.isSafeInteger(maxBodyBytes) || maxBodyBytes < 1) {
    throw new TypeError("maxBodyBytes must be a positive safe integer");
  }
  const readBody = cachedBodyReader(maxBodyBytes);
  const visibility =
    options.visibility ?? scopeVisibilityLoader(options.folders);
  const scopeTransaction = scopeTransactionFor(options);
  const snapshot: AccessControlOptions<Request>["snapshot"] =
    options.snapshot ?? scopeTransaction;
  const access = createAccessControl<Request>({
    ...options,
    visibility,
    snapshot,
  });
  const queries =
    options.queries === undefined
      ? null
      : createDashboardQueryService({
          ...options,
          ...options.queries,
          visibility,
          snapshot,
        });

  /**
   * The hook belongs to the host, so it is not trusted to return. A logger
   * that throws would otherwise escape the catch it was called from and turn
   * a request that had an answer — the 500 envelope — into one that does not.
   */
  const reportError = (error: unknown, request: Request): void => {
    try {
      options.onError?.(error, request);
    } catch {
      // Nothing left to report it to.
    }
  };
  const workbench =
    options.authoring === undefined
      ? null
      : createQueryWorkbench({
          ...options.authoringOptions,
          authoring: options.authoring,
        });
  /** Authorizes before anything else, as every route here does. */
  async function authoring(
    request: Request,
    match: RouteMatch,
    action: "query.author.read" | "query.author.run" | "query.author.write",
  ) {
    if (workbench === null) throw notFound();
    const decision = await access.authorize(request, {
      tenantId: match.tenantId,
      scopeId: match.scopeId,
      action,
    });
    return {
      workbench,
      context: {
        identity: decision.identity,
        scopeId: match.scopeId,
        signal: request.signal,
      },
    };
  }
  const basePath = normalizeBasePath(options.basePath);
  const testOptions = options.testConnection ?? {};

  /**
   * One connection test, with the credential sent inline or the one the
   * datasource names.
   *
   * A named credential that resolves to nothing is a failed test, not an
   * anonymous probe: a target that allows anonymous reads would otherwise
   * answer, and the operator would be told a broken datasource works.
   */
  async function runTest(
    tenantId: string,
    datasource: DataSourceDescriptor | DataSourceInput,
    inline?: CredentialInput,
  ): Promise<ConnectionTestResult> {
    let credential: DataSourceCredential | null = null;

    if (inline !== undefined) {
      credential = applyCredential(inline);
    } else if (datasource.credentialRef !== undefined) {
      const ref = datasource.credentialRef;
      credential =
        options.credentials === undefined
          ? null
          : await options.credentials.resolve(tenantId, ref);
      if (credential === null) {
        return untested(
          `The credential "${ref}" could not be resolved`,
          testOptions,
        );
      }
    }

    return testDataSourceConnection(datasource, credential, testOptions);
  }

  // Build once. Each route keeps its authorization before parsing and storage.
  const routes: Record<
    RouteMatch["route"],
    (request: Request, match: RouteMatch) => Promise<Response>
  > = {
    ...createFolderRoutes({
      access,
      store: options.store,
      folders: options.folders,
      visibility,
      readBody,
    }),
    async dashboards(request, match) {
      const method = request.method.toUpperCase();
      if (method !== "GET") return methodNotAllowed();
      const data = await access.list(request, {
        tenantId: match.tenantId,
        scopeId: match.scopeId,
      });
      return jsonResponse({ data });
    },

    async dashboard(request, match) {
      const method = request.method.toUpperCase();
      const slug = requireSlug(match);
      if (method === "GET") {
        const decision = await access.authorize(request, {
          tenantId: match.tenantId,
          scopeId: match.scopeId,
          slug,
          action: "dashboard.load",
        });
        // authorize already loaded it; a second store round trip would be
        // both wasteful and a chance for the two reads to disagree.
        const record = decision.dashboard?.record ?? null;
        const response = jsonResponse({ data: record?.config ?? null });
        response.headers.set("ETag", `"${record?.revision ?? 0}"`);
        return response;
      }
      if (method === "PUT") {
        // Authorize before parsing: an unauthorized caller learns nothing
        // about the request schema, and does no parsing work for us.
        const decision = await access.authorize(request, {
          tenantId: match.tenantId,
          scopeId: match.scopeId,
          slug,
          action: "dashboard.save",
        });
        const config = await readBody(request);
        requireValidConfig(config);
        requireVisibilityUnchangedOrManaged(
          decision,
          config,
          scopeTransaction !== undefined,
        );
        const expectedRevision = decision.dashboard?.record?.revision ?? 0;
        const requestedRevision = readExpectedRevision(request);
        if (
          requestedRevision !== undefined &&
          requestedRevision !== expectedRevision
        ) {
          throw DashboardServerError.conflict(
            "The dashboard changed; reload before saving it",
          );
        }
        const saved = await options.store.save(
          refOf(decision.identity.tenantId, match.scopeId, slug),
          config,
          {
            updatedBy: decision.identity.userId,
            expectedRevision,
          },
        );
        const response = jsonResponse(
          { data: { revision: saved.revision, updatedAt: saved.updatedAt } },
          200,
        );
        response.headers.set("ETag", `"${saved.revision}"`);
        return response;
      }
      if (method === "DELETE") {
        const decision = await access.authorize(request, {
          tenantId: match.tenantId,
          scopeId: match.scopeId,
          slug,
          action: "dashboard.delete",
        });
        if (decision.dashboard?.record == null) {
          throw DashboardServerError.notFound("Dashboard not found");
        }
        const ref = refOf(decision.identity.tenantId, match.scopeId, slug);
        requireAtomicPrivateMutation(
          decision.dashboard.record.config,
          scopeTransaction !== undefined,
        );
        await removeAuthorizedDashboard(
          options.store,
          ref,
          decision.dashboard.record.revision,
          scopeTransaction !== undefined,
        );
        return noContentResponse();
      }
      return methodNotAllowed();
    },

    async query(request, match) {
      if (request.method !== "POST") return methodNotAllowed();
      if (queries === null)
        throw DashboardServerError.notFound(
          "Query execution is not configured",
        );
      const data = await queries.execute(
        request,
        refOf(match.tenantId, match.scopeId, requireSlug(match)),
        requireId(match),
        async () => queryFilters(await readBody(request)),
        request.signal,
      );
      return jsonResponse({ data });
    },

    async queryCatalog(request, match) {
      if (request.method !== "GET") return methodNotAllowed();
      if (!options.queryCatalog)
        throw DashboardServerError.notFound("Query catalog is not configured");
      const ref = refOf(match.tenantId, match.scopeId, requireSlug(match));
      const decision = await access.authorize(request, {
        ...ref,
        action: "dashboard.save",
      });
      if (!decision.dashboard?.record)
        throw DashboardServerError.notFound("Dashboard not found");
      request.signal.throwIfAborted();
      const catalog = await options.queryCatalog.list({
        identity: decision.identity,
        ref,
        signal: request.signal,
      });
      request.signal.throwIfAborted();
      return jsonResponse({ connections: projectQueryCatalog(catalog) });
    },

    async scopeCapabilities(request, match) {
      if (request.method.toUpperCase() !== "GET") return methodNotAllowed();
      return jsonResponse(
        await access.scopeCapabilities(request, {
          tenantId: match.tenantId,
          scopeId: match.scopeId,
        }),
      );
    },

    async capabilities(request, match) {
      const method = request.method.toUpperCase();
      if (method !== "GET") return methodNotAllowed();
      const capabilities = await access.capabilities(request, {
        tenantId: match.tenantId,
        scopeId: match.scopeId,
        slug: requireSlug(match),
      });
      return jsonResponse(capabilities);
    },

    async permissions(request, match) {
      const method = request.method.toUpperCase();
      const slug = requireSlug(match);
      if (method === "GET") {
        const decision = await access.authorize(request, {
          tenantId: match.tenantId,
          scopeId: match.scopeId,
          slug,
          action: "dashboard.permissions.read",
        });
        return jsonResponse({
          assignments: decision.dashboard?.assignments ?? [],
        });
      }
      if (method === "PUT") {
        // Authorize before parsing, as above. This route leaked more than
        // the other: `parseAssignments` names the offending field and lists
        // the valid roles, so an unauthenticated caller could read the
        // permission vocabulary straight out of the 400s.
        const decision = await access.authorize(request, {
          tenantId: match.tenantId,
          scopeId: match.scopeId,
          slug,
          action: "dashboard.permissions.write",
        });
        requireAtomicPrivateMutation(
          decision.dashboard?.record?.config,
          scopeTransaction !== undefined,
        );
        const assignments = parseAssignments(await readBody(request));
        await options.store.setPermissions(
          refOf(decision.identity.tenantId, match.scopeId, slug),
          assignments,
        );
        return noContentResponse();
      }
      return methodNotAllowed();
    },

    async datasources(request, match) {
      const method = request.method.toUpperCase();
      const store = requireDataSources(options.dataSources);
      if (method === "GET") {
        const decision = await access.authorize(request, {
          tenantId: match.tenantId,
          scopeId: match.scopeId,
          action: "datasource.list",
        });
        const data = await store.list(decision.identity.tenantId);
        return jsonResponse({ data });
      }
      if (method === "POST") {
        const decision = await access.authorize(request, {
          tenantId: match.tenantId,
          scopeId: match.scopeId,
          action: "datasource.write",
        });
        const input = parseDataSourceInput(await readBody(request));
        const id = crypto.randomUUID();
        const data = await store.put(decision.identity.tenantId, id, input);
        return jsonResponse({ data }, 201);
      }
      return methodNotAllowed();
    },

    async datasourcesTest(request, match) {
      const method = request.method.toUpperCase();
      // No store: these values have not been saved yet.
      if (method !== "POST") return methodNotAllowed();
      const decision = await access.authorize(request, {
        tenantId: match.tenantId,
        scopeId: match.scopeId,
        action: "datasource.write",
      });
      const input = parseDataSourceTestInput(await readBody(request));
      if (
        input.credential !== undefined &&
        input.datasource.credentialRef !== undefined
      ) {
        throw DashboardServerError.badRequest(
          'Send "credential" or a "credentialRef" on the datasource, not ' +
            "both. They can name different secrets, and the test would " +
            "then answer about one of them without saying which.",
        );
      }
      return jsonResponse({
        data: await runTest(
          decision.identity.tenantId,
          input.datasource,
          input.credential,
        ),
      });
    },

    async datasourceTest(request, match) {
      const method = request.method.toUpperCase();
      const store = requireDataSources(options.dataSources);
      const id = requireId(match);
      if (method !== "POST") return methodNotAllowed();
      const decision = await access.authorize(request, {
        tenantId: match.tenantId,
        scopeId: match.scopeId,
        action: "datasource.write",
      });
      const descriptor = await store.get(decision.identity.tenantId, id);
      if (descriptor === null) {
        throw DashboardServerError.notFound("Datasource not found");
      }
      return jsonResponse({
        data: await runTest(decision.identity.tenantId, descriptor),
      });
    },

    async datasource(request, match) {
      const method = request.method.toUpperCase();
      const store = requireDataSources(options.dataSources);
      const id = requireId(match);
      if (method === "GET") {
        const decision = await access.authorize(request, {
          tenantId: match.tenantId,
          scopeId: match.scopeId,
          action: "datasource.list",
        });
        const data = await store.get(decision.identity.tenantId, id);
        if (data === null) {
          throw DashboardServerError.notFound("Datasource not found");
        }
        return jsonResponse({ data });
      }
      if (method === "PUT") {
        const decision = await access.authorize(request, {
          tenantId: match.tenantId,
          scopeId: match.scopeId,
          action: "datasource.write",
        });
        const input = parseDataSourceInput(await readBody(request));
        const data = await store.put(decision.identity.tenantId, id, input);
        return jsonResponse({ data });
      }
      if (method === "DELETE") {
        const decision = await access.authorize(request, {
          tenantId: match.tenantId,
          scopeId: match.scopeId,
          action: "datasource.write",
        });
        await store.remove(decision.identity.tenantId, id);
        return noContentResponse();
      }
      return methodNotAllowed();
    },

    async credentials(request, match) {
      const method = request.method.toUpperCase();
      const vault = requireCredentialsStore(options.credentials);
      if (method !== "GET") return methodNotAllowed();
      const decision = await access.authorize(request, {
        tenantId: match.tenantId,
        scopeId: match.scopeId,
        action: "datasource.list",
      });
      const data = await vault.listCredentials(decision.identity.tenantId);
      return jsonResponse({ data });
    },

    async credential(request, match) {
      const method = request.method.toUpperCase();
      const vault = requireCredentialsStore(options.credentials);
      const ref = requireId(match);
      if (method === "GET") {
        const decision = await access.authorize(request, {
          tenantId: match.tenantId,
          scopeId: match.scopeId,
          action: "datasource.list",
        });
        const data = await vault.describeCredential(
          decision.identity.tenantId,
          ref,
        );
        if (data === null) {
          throw DashboardServerError.notFound("Credential not found");
        }
        return jsonResponse({ data });
      }
      if (method === "PUT") {
        const decision = await access.authorize(request, {
          tenantId: match.tenantId,
          scopeId: match.scopeId,
          action: "datasource.write",
        });
        const input = parseCredentialInput(await readBody(request));
        // The response is the summary. Echoing the input back would put
        // the secret in a response body.
        const data = await vault.putCredential(
          decision.identity.tenantId,
          ref,
          input,
        );
        return jsonResponse({ data });
      }
      if (method === "DELETE") {
        const decision = await access.authorize(request, {
          tenantId: match.tenantId,
          scopeId: match.scopeId,
          action: "datasource.write",
        });
        await vault.removeCredential(decision.identity.tenantId, ref);
        return noContentResponse();
      }
      return methodNotAllowed();
    },

    async querySources(request, match) {
      if (request.method.toUpperCase() !== "GET") return methodNotAllowed();
      const { workbench, context } = await authoring(
        request,
        match,
        "query.author.read",
      );
      return jsonResponse({ data: await workbench.sources(context) });
    },

    async querySourceSchema(request, match) {
      if (request.method.toUpperCase() !== "GET") return methodNotAllowed();
      const { workbench, context } = await authoring(
        request,
        match,
        "query.author.read",
      );
      const url = new URL(request.url, "http://localhost");
      const projectId = url.searchParams.get("projectId") ?? "";
      const data = await workbench.schema(
        context,
        requireId(match),
        projectId,
        {
          refresh: url.searchParams.get("refresh") === "1",
        },
      );
      return jsonResponse({ data });
    },

    async queryPlans(request, match) {
      const method = request.method.toUpperCase();
      if (method === "GET") {
        const { workbench, context } = await authoring(
          request,
          match,
          "query.author.read",
        );
        return jsonResponse({
          data: await workbench.listPlans(context, requireId(match)),
        });
      }
      if (method === "POST") {
        const { workbench, context } = await authoring(
          request,
          match,
          "query.author.write",
        );
        const data = await workbench.createPlan(
          context,
          requireId(match),
          await readBody(request),
        );
        return planResponse(data, 201);
      }
      return methodNotAllowed();
    },

    async queryPlan(request, match) {
      const method = request.method.toUpperCase();
      const planId = requirePlanId(match);
      if (method === "GET") {
        const { workbench, context } = await authoring(
          request,
          match,
          "query.author.read",
        );
        return planResponse(
          await workbench.getPlan(context, requireId(match), planId),
        );
      }
      if (method === "PUT") {
        const { workbench, context } = await authoring(
          request,
          match,
          "query.author.write",
        );
        const revision = readPlanRevision(request);
        const data = await workbench.updatePlan(
          context,
          requireId(match),
          planId,
          await readBody(request),
          revision,
        );
        return planResponse(data);
      }
      if (method === "DELETE") {
        const { workbench, context } = await authoring(
          request,
          match,
          "query.author.write",
        );
        await workbench.removePlan(context, requireId(match), planId);
        return noContentResponse();
      }
      return methodNotAllowed();
    },

    async queryEstimate(request, match) {
      if (request.method.toUpperCase() !== "POST") return methodNotAllowed();
      const { workbench, context } = await authoring(
        request,
        match,
        "query.author.run",
      );
      return jsonResponse({
        data: await workbench.estimate(
          context,
          requireId(match),
          await readBody(request),
        ),
      });
    },

    async queryPreview(request, match) {
      if (request.method.toUpperCase() !== "POST") return methodNotAllowed();
      const { workbench, context } = await authoring(
        request,
        match,
        "query.author.run",
      );
      return jsonResponse({
        data: await workbench.preview(
          context,
          requireId(match),
          await readBody(request),
        ),
      });
    },
  };

  const runRoute = createScopedRouteRunner({
    access,
    audit: options.audit,
    now: options.now,
    onAuditError: options.onAuditError,
    folders: options.folders,
    transaction: scopeTransaction,
    readBody,
    routes,
  });

  const handle = async function handle(request: Request): Promise<Response> {
    return withoutVisibilitySnapshot(async () => {
      try {
        const pathname = pathnameOf(request.url);
        const routable = stripBasePath(pathname, basePath);
        if (routable === null) return errorResponse(notFound());
        const match = matchRoute(routable);
        if (match === null) return errorResponse(notFound());
        return await runRoute(request, match);
      } catch (error) {
        // A DashboardServerError is an answer this code chose — a 404, a 403, a
        // 409 — and says so on the wire. Anything else reached here by
        // surprise, and is the only kind worth waking someone for.
        if (!isDashboardServerError(error)) reportError(error, request);
        return errorResponse(error);
      }
    });
  };
  return options.cors ? withCors(handle, options.cors) : handle;
}

// ------------------------------------------------------------- helpers ----

function scopeTransactionFor(
  options: DashboardHandlerOptions,
): DashboardFolderStore["transaction"] | undefined {
  const folders = options.folders;
  if (folders) return (scope, body) => folders.transaction(scope, body);
  const store = options.store;
  if (store.scopeTransaction)
    return (scope, body) => store.scopeTransaction!(scope, body);
  return undefined;
}

function cachedBodyReader(maxBodyBytes: number) {
  const bodies = new WeakMap<Request, Promise<unknown>>();
  return (request: Request) => {
    let body = bodies.get(request);
    if (body === undefined) {
      body = readJsonBody(request, maxBodyBytes);
      bodies.set(request, body);
    }
    return body;
  };
}

const refOf = (tenantId: string, scopeId: string, slug: string) => ({
  tenantId,
  scopeId,
  slug,
});

const notFound = () => DashboardServerError.notFound("No such endpoint");

function methodNotAllowed(): Response {
  // Deliberately the same envelope as everything else, and deliberately a 404
  // rather than a 405: which methods exist on a path is not something an
  // unauthorized caller should be able to enumerate.
  return errorResponse(notFound());
}

function requireSlug(match: RouteMatch): string {
  if (match.slug === undefined) {
    throw DashboardServerError.badRequest("Missing dashboard slug");
  }
  return match.slug;
}

function requirePlanId(match: RouteMatch): string {
  if (match.planId === undefined) {
    throw DashboardServerError.badRequest("Missing query identifier");
  }
  return match.planId;
}

function planResponse(plan: { revision: string }, status = 200): Response {
  const response = jsonResponse({ data: plan }, status);
  response.headers.set("ETag", `"${plan.revision}"`);
  return response;
}

/** A saved query is only replaced with the revision it was read at. */
function readPlanRevision(request: Request): string {
  const header = request.headers.get("if-match");
  const token = header?.replace(/^W\//, "").replaceAll('"', "").trim();
  if (!token) {
    throw DashboardServerError.badRequest(
      "Send the revision of the query you edited as If-Match",
    );
  }
  return token;
}

function requireId(match: RouteMatch): string {
  if (match.id === undefined) {
    throw DashboardServerError.badRequest("Missing identifier");
  }
  return match.id;
}

/**
 * 404, not 501. A status code must not tell an unauthenticated caller which
 * stores this deployment has configured.
 */
function requireDataSources(
  store: DataSourceStore | undefined,
): DataSourceStore {
  if (store === undefined) throw notFound();
  return store;
}

/**
 * The credential routes need a vault that can be written to. A read-only one
 * is answered the same way as none at all.
 */
function requireCredentialsStore(vault: CredentialsVault | undefined) {
  if (vault === undefined || !isCredentialsStore(vault)) throw notFound();
  return vault;
}

/**
 * The pathname of a request URL, without throwing on a relative one.
 *
 * Exported because the standalone server has to read the same string to answer
 * its probes, and `new URL(request.url)` there would throw before anything
 * could turn it into a response.
 */
export function pathnameOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    // A relative URL is legal in some server frameworks' request objects.
    return url.split("?")[0] ?? "/";
  }
}

const SLASH = "/";

/**
 * Trim trailing slashes and guarantee a leading one.
 *
 * Deliberately not `replace(/\/+$/, "")`. A repeated character class anchored
 * at the end backtracks quadratically, so a long run of slashes costs time
 * proportional to its square. CodeQL flags it as a polynomial regular
 * expression and it is right to: the value reaches here from configuration
 * that a deployment can set, and the linear version below is no harder to
 * read.
 *
 * Exported because the documentation page has to arrive at the same answer.
 * `serve` hands both the same unnormalized value, so anything computing its
 * own version of this would disagree with the router for a prefix written
 * `api/dashboard` or `/api/dashboard/` — and "Try it out" would then address
 * a path the router does not serve.
 */
export function normalizeBasePath(basePath: string | undefined): string {
  if (!basePath) return "";
  let end = basePath.length;
  while (end > 0 && basePath[end - 1] === SLASH) end--;
  const trimmed = basePath.slice(0, end);
  if (trimmed.length === 0) return "";
  return trimmed.startsWith(SLASH) ? trimmed : `/${trimmed}`;
}

/** Returns the remaining path, or null when the prefix does not match. */
function stripBasePath(pathname: string, basePath: string): string | null {
  if (basePath === "") return pathname;
  if (pathname === basePath) return "/";
  if (pathname.startsWith(`${basePath}/`)) {
    return pathname.slice(basePath.length);
  }
  return null;
}

/** How many faults a refusal names before it just counts the rest. */
const MAX_REPORTED_PROBLEMS = 5;

function requireValidConfig(config: unknown): void {
  const result = validateDashboardConfig(config);
  if (result.valid) return;
  const shown = result.problems.slice(0, MAX_REPORTED_PROBLEMS);
  const remaining = result.problems.length - shown.length;
  const tail = remaining > 0 ? `, and ${remaining} more` : "";
  throw DashboardServerError.badRequest(
    `Dashboard config does not match the contract: ${shown.join("; ")}${tail}`,
  );
}

/**
 * Optimistic concurrency token.
 *
 * `If-Match` is the standard header for it. The store decides whether the
 * revision is stale and signals a conflict; this layer only carries the value.
 */
function readExpectedRevision(request: Request): number | undefined {
  const header = request.headers.get("if-match");
  if (header === null) return undefined;
  const token = header.replace(/^W\//, "").replaceAll('"', "").trim();
  // `Number("")` is 0, so an empty or quote-only If-Match used to arrive as
  // "expect revision 0" — which the store reads as "expect this dashboard not
  // to exist" and answers 409 for a perfectly good save. An absent precondition
  // is spelled by omitting the header, never by sending an empty one.
  if (token.length === 0) {
    throw DashboardServerError.badRequest(
      "If-Match must be an integer revision; omit the header to write without a precondition",
    );
  }
  const value = Number(token);
  if (!Number.isInteger(value) || value < 0) {
    throw DashboardServerError.badRequest(
      "If-Match must be an integer revision",
    );
  }
  return value;
}

function queryFilters(body: unknown): unknown {
  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => key !== "filters")
  ) {
    throw DashboardServerError.badRequest(
      "Body must contain only dashboard filters",
    );
  }
  return Object.hasOwn(body, "filters")
    ? (body as { filters: unknown }).filters
    : {};
}
