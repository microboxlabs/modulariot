/**
 * One probe against a datasource, with the credential it has.
 *
 * A target that refuses the credential is a `200` with `success: false`.
 * This fails only when it could not ask.
 *
 * A BigQuery dataset needs the Google client, so it is reported as
 * untestable rather than given an invented pass.
 *
 * The credential is used for the one probe. Nothing here logs, echoes or
 * stores it.
 */

import type { DataSourceCredential } from "../seams/credentials";
import type {
  DataSourceDescriptor,
  DataSourceInput,
} from "../seams/datasources";

const DEFAULT_TIMEOUT_MS = 8000;

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

/** The probe URL and the auth to send with it. */
function probeRequest(
  target: string,
  credential: DataSourceCredential | null,
): { url: URL; headers: Record<string, string> } {
  const url = new URL(target);
  const headers: Record<string, string> = { accept: "application/json" };

  if (credential !== null && credential.kind === "HTTP_AUTH") {
    for (const [name, value] of Object.entries(credential.headers)) {
      headers[name] = value;
    }
    for (const [name, value] of Object.entries(credential.queryParams)) {
      url.searchParams.set(name, value);
    }
  }
  return { url, headers };
}

export async function testDataSourceConnection(
  datasource: DataSourceDescriptor | DataSourceInput,
  credential: DataSourceCredential | null,
  options: TestConnectionOptions = {},
): Promise<ConnectionTestResult> {
  const now = options.now ?? (() => new Date());
  const testedAt = now().toISOString();

  if (datasource.type !== "POSTGREST") {
    return {
      testable: false,
      success: false,
      testedAt,
      message: `A ${datasource.type} datasource cannot be tested from here yet`,
    };
  }

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

  let request: { url: URL; headers: Record<string, string> };
  try {
    request = probeRequest(datasource.target, credential);
  } catch {
    return {
      testable: true,
      success: false,
      testedAt,
      message: "The target is not a URL",
    };
  }

  const call = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await call(request.url, {
      method: "GET",
      headers: request.headers,
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

  if (response.status === 401 || response.status === 403) {
    return {
      testable: true,
      success: false,
      testedAt,
      status: response.status,
      message:
        credential === null || credential.kind === "NONE"
          ? "The target requires a credential and none is configured"
          : "The target refused the credential",
    };
  }

  if (response.status >= 300 && response.status < 400) {
    return {
      testable: true,
      success: false,
      testedAt,
      status: response.status,
      message:
        "The target answered with a redirect, which is not followed: the " +
        "destination would decide where the credential is sent",
    };
  }

  if (!response.ok) {
    return {
      testable: true,
      success: false,
      testedAt,
      status: response.status,
      message: `The target answered ${response.status}`,
    };
  }

  return {
    testable: true,
    success: true,
    testedAt,
    status: response.status,
    message: "The target answered",
  };
}
