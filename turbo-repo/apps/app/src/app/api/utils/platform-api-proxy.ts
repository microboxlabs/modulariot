import { NextResponse } from "next/server";
import { forwardToStreamhubModulith } from "@/app/api/utils/streamhub-modulith-proxy";

/**
 * Route handlers that proxy `/api/admin/platform/...` to a platform API on the
 * streamhub modulith, under `base` (for example
 * `/api/v1/platform/symptom-templates`). The modulith requires platform
 * ownership, so the user's session is always forwarded: the ownership check
 * reads the token's email.
 */
export interface RouteParams {
  params: Promise<{ path?: string[] }>;
}

const SEGMENT = /^[A-Za-z0-9._-]+$/;

const badPath = () =>
  NextResponse.json({ error: "Invalid path" }, { status: 400 });

export function platformApiProxy(base: string) {
  async function upstreamPath(
    request: Request,
    { params }: RouteParams
  ): Promise<string | null> {
    const path = (await params).path ?? [];
    if (!path.every((s) => SEGMENT.test(s) && s !== "." && s !== "..")) {
      return null;
    }
    const suffix = path.length ? `/${path.join("/")}` : "";
    return `${base}${suffix}${new URL(request.url).search}`;
  }

  async function forwardRead(
    request: Request,
    context: RouteParams,
    method: "GET" | "DELETE"
  ) {
    const path = await upstreamPath(request, context);
    if (!path) return badPath();
    return method === "GET"
      ? forwardToStreamhubModulith(path, { sessionOnly: true })
      : forwardToStreamhubModulith(path, { method, sessionOnly: true });
  }

  async function forwardWrite(
    request: Request,
    context: RouteParams,
    method: "POST" | "PUT" | "PATCH"
  ) {
    const path = await upstreamPath(request, context);
    if (!path) return badPath();
    let body: unknown = {};
    const text = await request.text();
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        return NextResponse.json(
          { error: "Invalid JSON body" },
          { status: 400 }
        );
      }
    }
    return forwardToStreamhubModulith(path, {
      method,
      body,
      sessionOnly: true,
    });
  }

  return {
    GET: (request: Request, context: RouteParams) =>
      forwardRead(request, context, "GET"),
    DELETE: (request: Request, context: RouteParams) =>
      forwardRead(request, context, "DELETE"),
    POST: (request: Request, context: RouteParams) =>
      forwardWrite(request, context, "POST"),
    PUT: (request: Request, context: RouteParams) =>
      forwardWrite(request, context, "PUT"),
    PATCH: (request: Request, context: RouteParams) =>
      forwardWrite(request, context, "PATCH"),
  };
}
