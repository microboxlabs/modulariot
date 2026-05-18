import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import {
  prepareAlfrescoAuth,
  getGroupsForPerson,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { logger } from "@/lib/logger";

const ALFRESCO_API_URL = process.env.ECM_API_URL || "";

/**
 * Standard response structure for list endpoints
 */
export interface ListResponse<T> {
  data: T[];
  total?: number;
}

/**
 * Configuration for the Alfresco CRUD client
 */
export interface AlfrescoCrudClientConfig {
  /** Base endpoint path (e.g., "/api/planned-services") */
  endpoint: string;
  /** Resource name for logging (e.g., "planned service") */
  resourceName: string;
  /** Whether to return mock data when backend returns 404 (dev mode) */
  mockOn404?: boolean;
}

/**
 * Options for individual requests
 */
export interface RequestOptions<T> {
  /** Query parameters to append to the URL */
  params?: Record<string, string | undefined>;
  /** Request body for POST/PUT */
  body?: unknown;
  /** Mock response generator for 404s (only used if mockOn404 is true) */
  mockResponse?: () => T;
}

/**
 * Result of an authenticated request check
 */
type AuthResult =
  | { authenticated: true; session: Session }
  | { authenticated: false; response: NextResponse };

/**
 * Checks authentication and returns session or unauthorized response
 */
export async function requireAuth(): Promise<AuthResult> {
  const session = await auth();

  if (!session) {
    return {
      authenticated: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { authenticated: true, session };
}

/**
 * Result of an authorize-by-group check
 */
type AnyGroupResult =
  | { authorized: true; session: Session; userGroups: string[] }
  | { authorized: false; response: NextResponse };

/**
 * Authenticate, fetch the caller's Alfresco groups, and authorize if at
 * least one group matches `allowedGroups`. Layered on top of `requireAuth`:
 * the 401 path is identical, plus a 403 when authenticated but missing
 * every allowed group. Use this on any mutating API route that should
 * reject pure GROUP_CALENDAR_VIEWER (or other read-only) users.
 *
 * The membership lookup runs every request — there is no in-memory cache
 * here. That matches the pattern in `task/unclaim/route.ts` and keeps the
 * helper free of cross-request state; if Alfresco group lookups ever
 * become a hot path, fold caching into `getGroupsForPerson` itself.
 */
export async function requireAnyGroup(
  allowedGroups: readonly string[]
): Promise<AnyGroupResult> {
  const authResult = await requireAuth();
  if (!authResult.authenticated) {
    return { authorized: false, response: authResult.response };
  }

  const userGroups = await getGroupsForPerson(authResult.session);
  const hasAccess = userGroups.some((g) => allowedGroups.includes(g));
  if (!hasAccess) {
    logger.warn(
      { userEmail: authResult.session.user?.email, allowedGroups },
      "Forbidden: caller lacks every required group"
    );
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Forbidden: missing required group" },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true,
    session: authResult.session,
    userGroups,
  };
}

/**
 * Builds a URL with optional query parameters
 */
function buildUrl(
  baseEndpoint: string,
  params?: Record<string, string | undefined>
): string {
  const url = `${ALFRESCO_API_URL}${baseEndpoint}`;

  if (!params) return url;

  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      queryParams.set(key, value);
    }
  });

  const queryString = queryParams.toString();
  return queryString ? `${url}?${queryString}` : url;
}

/**
 * Creates a typed Alfresco CRUD client for a specific resource
 *
 * @example
 * ```ts
 * const client = createAlfrescoCrudClient({
 *   endpoint: "/api/planned-services",
 *   resourceName: "planned service",
 * });
 *
 * // In GET handler:
 * const result = await client.list<PlannedServiceListResponse>(session, {
 *   params: { startDate, endDate },
 *   mockResponse: () => ({ data: [], total: 0 }),
 * });
 * ```
 */
export function createAlfrescoCrudClient(config: AlfrescoCrudClientConfig) {
  const { endpoint, resourceName, mockOn404 = false } = config;

  /**
   * Makes an authenticated request to Alfresco API
   */
  async function request<T>(
    session: Session,
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    options: RequestOptions<T> = {}
  ): Promise<{ data: T; status: number } | { error: NextResponse }> {
    const { params, body, mockResponse } = options;

    try {
      const url = buildUrl(path, params);
      const { url: authUrl, headers } = prepareAlfrescoAuth(url, session);

      const fetchOptions: RequestInit = {
        method,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
      };

      if (body && (method === "POST" || method === "PUT")) {
        fetchOptions.body = JSON.stringify(body);
      }

      const response = await fetch(authUrl, fetchOptions);

      // Handle 404 or 5xx with mock response if enabled (backend not yet implemented)
      if (
        (response.status === 404 || response.status >= 500) &&
        mockOn404 &&
        mockResponse
      ) {
        logger.warn(
          { endpoint: path, method, status: response.status },
          `${resourceName} endpoint returned ${response.status}, using mock response`
        );
        return { data: mockResponse(), status: method === "POST" ? 201 : 200 };
      }

      // Handle 404 as not found error
      if (response.status === 404) {
        return {
          error: NextResponse.json(
            { error: `${resourceName} not found` },
            { status: 404 }
          ),
        };
      }

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          {
            endpoint: path,
            method,
            status: response.status,
            statusText: response.statusText,
            errorText: errorText.substring(0, 500),
          },
          `Alfresco API error for ${resourceName}`
        );
        throw new Error(
          `Alfresco API request failed: ${response.status} ${response.statusText}`
        );
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return { data: null as T, status: 204 };
      }

      const data = (await response.json()) as T;
      return { data, status: response.status };
    } catch (error) {
      logger.error(
        { err: error, endpoint: path, method },
        `Error in ${resourceName} ${method} request`
      );
      return {
        error: NextResponse.json(
          { error: `Error ${method.toLowerCase()}ing ${resourceName}` },
          { status: 500 }
        ),
      };
    }
  }

  return {
    /**
     * GET list of resources
     */
    async list<T>(
      session: Session,
      options: RequestOptions<T> = {}
    ): Promise<NextResponse<T | { error: string }>> {
      const result = await request<T>(session, "GET", endpoint, options);

      if ("error" in result) return result.error as NextResponse<{ error: string }>;
      return NextResponse.json(result.data);
    },

    /**
     * GET single resource by ID
     */
    async get<T>(
      session: Session,
      id: string,
      options: RequestOptions<T> = {}
    ): Promise<NextResponse<T | { error: string }>> {
      const result = await request<T>(
        session,
        "GET",
        `${endpoint}/${id}`,
        options
      );

      if ("error" in result) return result.error as NextResponse<{ error: string }>;
      return NextResponse.json(result.data);
    },

    /**
     * POST create new resource
     */
    async create<T>(
      session: Session,
      body: unknown,
      options: Omit<RequestOptions<T>, "body"> = {}
    ): Promise<NextResponse<T | { error: string }>> {
      const result = await request<T>(session, "POST", endpoint, {
        ...options,
        body,
      });

      if ("error" in result) return result.error as NextResponse<{ error: string }>;
      return NextResponse.json(result.data, { status: 201 });
    },

    /**
     * PUT update existing resource
     */
    async update<T>(
      session: Session,
      id: string,
      body: unknown,
      options: Omit<RequestOptions<T>, "body"> = {}
    ): Promise<NextResponse<T | { error: string }>> {
      const result = await request<T>(session, "PUT", `${endpoint}/${id}`, {
        ...options,
        body,
      });

      if ("error" in result) return result.error as NextResponse<{ error: string }>;
      return NextResponse.json(result.data);
    },

    /**
     * DELETE remove resource
     */
    async delete(
      session: Session,
      id: string,
      options: RequestOptions<{ success: boolean }> = {}
    ): Promise<NextResponse<{ success: boolean } | { error: string }>> {
      const result = await request<{ success: boolean }>(
        session,
        "DELETE",
        `${endpoint}/${id}`,
        {
          ...options,
          mockResponse: options.mockResponse ?? (() => ({ success: true })),
        }
      );

      if ("error" in result) return result.error as NextResponse<{ error: string }>;
      return NextResponse.json({ success: true });
    },

    /** The configured endpoint */
    endpoint,

    /** The configured resource name */
    resourceName,
  };
}

/**
 * Helper to validate required fields in request body
 */
export function validateRequired<T extends object>(
  body: T,
  requiredFields: (keyof T)[]
): { valid: true } | { valid: false; response: NextResponse } {
  const missingFields = requiredFields.filter(
    (field) => body[field] === undefined || body[field] === null
  );

  if (missingFields.length > 0) {
    return {
      valid: false,
      response: NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(", ")}` },
        { status: 400 }
      ),
    };
  }

  return { valid: true };
}
