/**
 * One probe against a datasource, with the credential it has.
 *
 * A target that refuses the credential is a `200` with `success: false`.
 * This fails only when it could not ask.
 *
 * A PostgREST target is fetched as it is. A BigQuery dataset is read
 * through the BigQuery REST API, with a service account exchanged for an
 * access token first, or with the header a host already produced.
 *
 * The credential is used for the one probe. Nothing here logs, echoes or
 * stores it.
 */

import type { DataSourceCredential } from "../seams/credentials";
import type {
  DataSourceDescriptor,
  DataSourceInput,
} from "../seams/datasources";
import {
  ServiceAccountError,
  serviceAccountAccessToken,
} from "../identity/google-service-account";

const DEFAULT_TIMEOUT_MS = 8000;
const BIGQUERY_API = "https://bigquery.googleapis.com/bigquery/v2";
const BIGQUERY_SCOPE = "https://www.googleapis.com/auth/bigquery.readonly";

export interface ConnectionTestResult {
  /** False when this kind of datasource cannot be exercised from here. */
  testable: boolean;
  success: boolean;
  /** ISO-8601. */
  testedAt: string;
  /** Never the target's body, which can quote the credential back. */
  message: string;
  /** What the target answered, when it answered at all. */
  status?: number;
}

export interface TestConnectionOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  now?: () => Date;
  /** Where a service account is exchanged for a token. For tests. */
  googleTokenUrl?: string;
}

/** The outcome when the probe could not be attempted. */
export function untested(
  message: string,
  options: TestConnectionOptions = {},
): ConnectionTestResult {
  const now = options.now ?? (() => new Date());
  return {
    testable: true,
    success: false,
    testedAt: now().toISOString(),
    message,
  };
}

/**
 * `project.dataset`, or `dataset` alone when the credential names the
 * project. A dataset id is letters, digits and underscores; a project id
 * may also carry dots, dashes and a colon.
 */
export function parseBigQueryTarget(
  target: string,
): { projectId: string | undefined; datasetId: string } | null {
  const match = /^(?:([a-z][a-z0-9.:-]*[a-z0-9])\.)?([A-Za-z0-9_]+)$/.exec(
    target,
  );
  if (match === null || match[2] === undefined) return null;
  return { projectId: match[1], datasetId: match[2] };
}

function applyHttpAuth(
  url: URL,
  credential: DataSourceCredential | null,
): Record<string, string> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (credential !== null && credential.kind === "HTTP_AUTH") {
    for (const [name, value] of Object.entries(credential.headers)) {
      headers[name] = value;
    }
    for (const [name, value] of Object.entries(credential.queryParams)) {
      url.searchParams.set(name, value);
    }
  }
  return headers;
}

/** One GET, classified. Reads no body. */
async function probe(
  url: URL,
  headers: Record<string, string>,
  anonymous: boolean,
  testedAt: string,
  options: TestConnectionOptions,
  notFound: string,
): Promise<ConnectionTestResult> {
  const call = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await call(url, {
      method: "GET",
      headers,
      // The destination would otherwise decide where the credential goes.
      redirect: "manual",
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch (error) {
    // A fixed message. `fetch` quotes what it was handed: an invalid header
    // value comes back verbatim, and that value is the credential.
    return {
      testable: true,
      success: false,
      testedAt,
      message:
        error instanceof Error && error.name === "TimeoutError"
          ? "The target did not answer in time"
          : "Could not reach the target",
    };
  }

  // Nothing here reads the body. Left unread, it holds the connection open
  // until the garbage collector gets to it.
  void response.body?.cancel().catch(() => undefined);

  const failed = (message: string): ConnectionTestResult => ({
    testable: true,
    success: false,
    testedAt,
    status: response.status,
    message,
  });

  if (response.status === 401 || response.status === 403) {
    return failed(
      anonymous
        ? "The target requires a credential and none is configured"
        : "The target refused the credential",
    );
  }
  if (response.status === 404) {
    return failed(notFound);
  }
  if (response.status >= 300 && response.status < 400) {
    return failed(
      "The target answered with a redirect, which is not followed: the " +
        "destination would decide where the credential is sent",
    );
  }
  if (!response.ok) {
    return failed(`The target answered ${response.status}`);
  }
  return {
    testable: true,
    success: true,
    testedAt,
    status: response.status,
    message: "The target answered",
  };
}

async function testPostgrest(
  datasource: DataSourceDescriptor | DataSourceInput,
  credential: DataSourceCredential | null,
  testedAt: string,
  options: TestConnectionOptions,
): Promise<ConnectionTestResult> {
  if (credential !== null && credential.kind === "SERVICE_ACCOUNT") {
    return {
      testable: false,
      success: false,
      testedAt,
      message:
        "A service-account credential needs its provider's client to be " +
        "exercised, which this datasource type does not use",
    };
  }

  let url: URL;
  try {
    url = new URL(datasource.target);
  } catch {
    return {
      testable: true,
      success: false,
      testedAt,
      message: "The target is not a URL",
    };
  }
  const headers = applyHttpAuth(url, credential);
  return probe(
    url,
    headers,
    credential === null || credential.kind === "NONE",
    testedAt,
    options,
    "The target answered 404",
  );
}

async function testBigQuery(
  datasource: DataSourceDescriptor | DataSourceInput,
  credential: DataSourceCredential | null,
  testedAt: string,
  options: TestConnectionOptions,
): Promise<ConnectionTestResult> {
  const parsed = parseBigQueryTarget(datasource.target);
  if (parsed === null) {
    return {
      testable: true,
      success: false,
      testedAt,
      message: "The target is not a BigQuery dataset: use project.dataset",
    };
  }

  let headers: Record<string, string>;
  let projectId = parsed.projectId;
  const url = new URL(`${BIGQUERY_API}/projects/-/datasets/-`);

  if (credential !== null && credential.kind === "SERVICE_ACCOUNT") {
    projectId ??= credential.projectId;
    try {
      const access = await serviceAccountAccessToken({
        clientEmail: credential.clientEmail,
        privateKey: credential.privateKey,
        scope: BIGQUERY_SCOPE,
        tokenUrl: options.googleTokenUrl,
        timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        fetchImpl: options.fetchImpl,
        now:
          options.now === undefined
            ? undefined
            : () => options.now!().getTime(),
      });
      headers = {
        accept: "application/json",
        Authorization: `Bearer ${access.token}`,
      };
    } catch (error) {
      return {
        testable: true,
        success: false,
        testedAt,
        message:
          error instanceof ServiceAccountError
            ? error.message
            : "The service account could not be exchanged for a token",
      };
    }
  } else {
    headers = applyHttpAuth(url, credential);
  }

  if (projectId === undefined) {
    return {
      testable: true,
      success: false,
      testedAt,
      message: "The target has to name the project: use project.dataset",
    };
  }

  url.pathname =
    `/bigquery/v2/projects/${encodeURIComponent(projectId)}` +
    `/datasets/${encodeURIComponent(parsed.datasetId)}`;
  return probe(
    url,
    headers,
    credential === null || credential.kind === "NONE",
    testedAt,
    options,
    "The dataset does not exist, or the credential cannot see it",
  );
}

export async function testDataSourceConnection(
  datasource: DataSourceDescriptor | DataSourceInput,
  credential: DataSourceCredential | null,
  options: TestConnectionOptions = {},
): Promise<ConnectionTestResult> {
  const now = options.now ?? (() => new Date());
  const testedAt = now().toISOString();

  switch (datasource.type) {
    case "POSTGREST":
      return testPostgrest(datasource, credential, testedAt, options);
    case "BIGQUERY":
      return testBigQuery(datasource, credential, testedAt, options);
    default:
      return {
        testable: false,
        success: false,
        testedAt,
        message: `A ${String(datasource.type)} datasource cannot be tested from here yet`,
      };
  }
}
