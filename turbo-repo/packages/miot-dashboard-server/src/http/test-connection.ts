/**
 * Does this datasource answer, with this credential?
 *
 * The contract is modulariot's: a request carrying the thing to test, and a
 * `200` describing the outcome rather than an error status. A datasource
 * refusing our credential is not the caller's fault — the caller asked a
 * question and got an answer — so the refusal is in the body. The endpoint
 * itself fails only when it could not ask.
 *
 * Not every datasource has an answer. A BigQuery dataset needs the Google
 * client to say anything, so it is reported as untestable rather than given
 * an invented pass. That mirrors modulariot's rule for a bare API key.
 *
 * Nothing here logs, echoes or stores the credential. The unsaved-values
 * form is the one place a secret legitimately arrives over HTTP, and it is
 * used for the one request and dropped.
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
  /** Short and safe. Never the target's body, which can quote a credential. */
  message: string;
  /** What the target answered, when it answered at all. */
  status?: number;
}

export interface TestConnectionOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  now?: () => Date;
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
    // The message is the fetch layer's, not the target's body: a DNS or TLS
    // failure names a host, which the operator configured and already knows.
    return {
      testable: true,
      success: false,
      testedAt,
      message: `Could not reach the target: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }

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
