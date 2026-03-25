import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import {
  AuthToken,
  AuthTokenConfig,
} from "@/features/common/providers/sreamhub-api/streamhub-api.provider";

// Common configuration for StreamHub API authentication
const getAuthConfig = (): AuthTokenConfig => ({
  clientId: `${process.env.STREAMHUB_CLIENT_ID}`,
  clientSecret: `${process.env.STREAMHUB_CLIENT_SECRET}`,
  audience: `${process.env.STREAMHUB_AUDIENCE}`,
  grantType: "client_credentials",
});

// Shared AuthToken instance
const authToken = new AuthToken(getAuthConfig());

/**
 * Get the shared AuthToken instance for custom implementations
 */
export function getSharedAuthToken() {
  return authToken;
}

/**
 * Helper function to set URL parameters from request to API params
 */
export function setParam(
  url: URL,
  params: URLSearchParams,
  variableName: string,
  paramName: string
) {
  const value = url.searchParams.get(variableName);
  if (value) {
    params.set(paramName, value);
  }
}

/**
 * Generic handler for StreamHub API endpoints
 */
export function createStreamHubApiHandler(
  apiEndpoint: string,
  paramMapping?: Array<{ source: string; target: string }>
) {
  return async function GET(req: NextRequest) {
    const session = await auth();
    if (!session) {
      return NextResponse.json({
        status: 401,
      });
    }

    const url = new URL(req.url);
    const params = new URLSearchParams();

    // Apply parameter mapping if provided
    if (paramMapping) {
      paramMapping.forEach(({ source, target }) => {
        setParam(url, params, source, target);
      });
    }

    try {
      const token = await authToken.getToken();

      const apiUrl = `${process.env.STREAMHUB_URL}${apiEndpoint}`;
      const fullUrl = params.toString()
        ? `${apiUrl}?${params.toString()}`
        : apiUrl;

      const response = await fetch(fullUrl, {
        headers: {
          accept: "application/json",
          Authorization: ` Bearer ${token}`,
        },
      });

      if (!response.ok) {
        // Check if response is HTML (error page)
        const contentType = response.headers.get("content-type");
        if (contentType?.includes("text/html")) {
          return NextResponse.json(
            { error: "Service temporarily unavailable. Please try again." },
            { status: response.status >= 500 ? response.status : 502 }
          );
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Verify content-type is JSON before parsing
      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        return NextResponse.json(
          { error: "Service returned an unexpected response. Please try again." },
          { status: 502 }
        );
      }

      const data = await response.json();
      return NextResponse.json(data);
    } catch (error) {
      console.error(error);
      
      // Handle JSON parsing errors
      if (error instanceof SyntaxError && error.message.includes("Unexpected token")) {
        return NextResponse.json(
          { error: "Service temporarily unavailable. Please try again." },
          { status: 502 }
        );
      }
      
      return NextResponse.json(
        { error: "Failed to fetch data. Please try again." },
        { status: 500 }
      );
    }
  };
}
