import { NextResponse } from "next/server";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";
import { relayToStreamhubModulith } from "@/app/api/utils/streamhub-modulith-proxy";

export const dynamic = "force-dynamic";

const ID = /^[0-9a-f-]{36}$/i;
// Matches the upstream HTTP request limit; ContentService also checks the file's own limit.
const MAX_REQUEST_BYTES = 40 * 1024 * 1024;

async function proofForm(request: Request): Promise<FormData | Response> {
  const tooLarge = () =>
    NextResponse.json({ error: "Upload is too large" }, { status: 413 });
  if (Number(request.headers.get("content-length")) > MAX_REQUEST_BYTES)
    return tooLarge();
  let bytes = 0;
  try {
    const body = request.body?.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          bytes += chunk.byteLength;
          if (bytes > MAX_REQUEST_BYTES) throw new Error("Upload is too large");
          controller.enqueue(chunk);
        },
      })
    );
    return await new Response(body, { headers: request.headers }).formData();
  } catch {
    return bytes > MAX_REQUEST_BYTES
      ? tooLarge()
      : NextResponse.json(
          { error: "Invalid multipart upload" },
          { status: 400 }
        );
  }
}

/** Uploads a delivery's proof (multipart: `file`, `kind`) for `?trip=…&delivery=…` of the active organization. */
export async function POST(request: Request) {
  const query = new URL(request.url).searchParams;
  const trip = query.get("trip") ?? "";
  const delivery = query.get("delivery") ?? "";
  if (!ID.test(trip) || !ID.test(delivery)) {
    return NextResponse.json(
      { error: "Invalid trip or delivery" },
      { status: 400 }
    );
  }
  const scope = await resolveTenantScope();
  if (!scope.resolved) return scope.response;
  const form = await proofForm(request);
  if (form instanceof Response) return form;
  const org = encodeURIComponent(scope.scope.activeOrg.slug);
  return relayToStreamhubModulith(
    `/api/v1/orgs/${org}/trips/${trip}/deliveries/${delivery}/proofs`,
    { method: "POST", body: form }
  );
}
