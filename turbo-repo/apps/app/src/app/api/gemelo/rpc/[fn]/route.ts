import "server-only";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import {
  golRpc,
  golRpcPost,
  GolApiError,
  GOL_RPC_CARRIER_FILTERABLE,
} from "@/features/common/providers/gol-api/gol-api.provider";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";
import { isCarrierOrg, requireCarrierData } from "@/app/api/utils/carrier-scope";

/**
 * Proxy autenticado hacia el Gemelo Digital (solo funciones de la allowlist).
 * El navegador nunca habla directo con la fuente del gemelo.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fn: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { fn } = await params;
  const search = new URLSearchParams(req.nextUrl.searchParams);

  // PT3: para una org carrier el tenant se INYECTA server-side (se ignora
  // cualquier p_carrier_rut del navegador). Fns sin filtro imponible ⇒ 403
  // (fail-closed, diseno_pt1_portal §F.3).
  const scopeResult = await resolveTenantScope();
  if (scopeResult.resolved && isCarrierOrg(scopeResult.scope)) {
    const guard = requireCarrierData(scopeResult.scope);
    if (guard) return guard;
    if (!GOL_RPC_CARRIER_FILTERABLE.has(fn)) {
      return NextResponse.json(
        { error: "Function not tenant-filtered yet for carrier organizations" },
        { status: 403 }
      );
    }
    search.set("p_carrier_rut", scopeResult.scope.effectiveTaxIds[0]);
  }

  try {
    const data = await golRpc(fn, search);
    return NextResponse.json(data);
  } catch (e) {
    const status = e instanceof GolApiError ? e.status : 502;
    const message = e instanceof Error ? e.message : "gemelo unavailable";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ fn: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { fn } = await params;

  // PT3: escrituras del gemelo (zonas/simulación) aún sin tenant ⇒ 403 para
  // orgs carrier (fail-closed hasta que cada una gane scope propio).
  const scopeResult = await resolveTenantScope();
  if (scopeResult.resolved && isCarrierOrg(scopeResult.scope)) {
    return NextResponse.json(
      { error: "Gemelo write operations are not tenant-scoped yet" },
      { status: 403 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const data = await golRpcPost(fn, body);
    return NextResponse.json(data);
  } catch (e) {
    const status = e instanceof GolApiError ? e.status : 502;
    const message = e instanceof Error ? e.message : "gemelo unavailable";
    return NextResponse.json({ error: message }, { status });
  }
}
