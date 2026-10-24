import { NextResponse } from "next/server";
import { forwardToStreamhubModulith } from "@/app/api/utils/streamhub-modulith-proxy";

/**
 * /api/admin/platform/whatsapp-templates/... — the WhatsApp templates on
 * Meta of the platform's WhatsApp connection. Proxies to
 * `/api/v1/platform/whatsapp-templates/...` on the modulith that serves the
 * conversations, which requires platform ownership. Always with the user's
 * session: the ownership check reads the token's email.
 */
interface RouteParams {
  params: Promise<{ path?: string[] }>;
}

const SEGMENT = /^[A-Za-z0-9._-]+$/;
const BASE = "/api/v1/platform/whatsapp-templates";

async function upstreamPath(
  request: Request,
  { params }: RouteParams
): Promise<string | null> {
  const path = (await params).path ?? [];
  if (!path.every((s) => SEGMENT.test(s) && s !== "." && s !== "..")) {
    return null;
  }
  const suffix = path.length ? `/${path.join("/")}` : "";
  return `${BASE}${suffix}${new URL(request.url).search}`;
}

const badPath = () =>
  NextResponse.json({ error: "Invalid path" }, { status: 400 });

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
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
  }
  return forwardToStreamhubModulith(path, { method, body, sessionOnly: true });
}

export const GET = (request: Request, context: RouteParams) =>
  forwardRead(request, context, "GET");
export const DELETE = (request: Request, context: RouteParams) =>
  forwardRead(request, context, "DELETE");
export const POST = (request: Request, context: RouteParams) =>
  forwardWrite(request, context, "POST");
export const PUT = (request: Request, context: RouteParams) =>
  forwardWrite(request, context, "PUT");
export const PATCH = (request: Request, context: RouteParams) =>
  forwardWrite(request, context, "PATCH");
