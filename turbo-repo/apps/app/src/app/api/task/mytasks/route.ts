import "server-only";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";
import { isCarrierOrg, requireCarrierData } from "@/app/api/utils/carrier-scope";
import {
  getFinishedWorkflows,
  getUnbookedTasks,
  getUserTasks,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { toShippingKanban } from "@/features/shipping/services/data.service";
import { KanbanBoard } from "@/features/shipping/types/common.types";
import {
  FinishedWorkflowsResponse,
  FastTasksResponse,
} from "@/features/common/providers/alfresco-api/alfresco-api.types";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({
      status: 401,
    });
  }

  // PT2: para orgs carrier el tenant se FUERZA desde el scope server-side —
  // el carrierId del query string del navegador se ignora (regla de oro §A.4).
  let carrierIdForzado: string | undefined;
  let carrierSupplierForzado: string | undefined;
  const scopeResult = await resolveTenantScope();
  if (scopeResult.resolved && isCarrierOrg(scopeResult.scope)) {
    const guard = requireCarrierData(scopeResult.scope);
    if (guard) return guard;
    // mintral_supplierId (RUT) es la variable indexada correcta, pero hoy no
    // viene poblada en todos los workflows; supplierName sí. Se fuerzan AMBOS
    // criterios de la org (OR no existe en el backend: se usa el que filtra).
    carrierSupplierForzado = scopeResult.scope.activeOrg.displayName ?? undefined;
    carrierIdForzado = undefined; // ver decisión tras verificación empírica
  }

  const url = new URL(req.url);

  const columns = url.searchParams.getAll("columns");
  const from = url.searchParams.get("from");
  const size = url.searchParams.get("size");
  const show_finished = url.searchParams.get("showFinished") === "true";
  const serviceCode = url.searchParams.get("service");
  const licensePlate = url.searchParams.get("licensePlate");
  const driverId = url.searchParams.get("driverId");
  const carrierId = carrierIdForzado ?? url.searchParams.get("carrierId");
  const carrierName = carrierIdForzado ? null : url.searchParams.get("carrierName");
  // supplierName SÍ filtra en ECM fast-tasks (ILIKE prefijo sobre
  // mintral_supplierName); carrierName es ignorado por el backend SQL.
  const supplierName = carrierSupplierForzado ?? url.searchParams.get("supplierName");
  const origin = url.searchParams.get("origin");
  const destination = url.searchParams.get("destination");
  const customer = url.searchParams.get("customer");
  const editable = url.searchParams.get("editable");
  const originType = url.searchParams.get("originType");
  const orderBy = url.searchParams.get("orderBy");
  const order = url.searchParams.get("order");
  const date_range_from = url.searchParams.get("date_range_from");
  const date_range_to = url.searchParams.get("date_range_to");
  const calendarId = url.searchParams.get("calendarId");
  const rawQ = url.searchParams.get("q");
  // Mintral service IDs are stored as `v<digits>`; a purely numeric typed
  // query won't prefix-match that column otherwise. Mirrors the `service=`
  // normalization a few lines down so the autocomplete and the structured
  // chip filter behave the same way for digit-only input.
  let q: string | undefined;
  if (rawQ) {
    q = /^\d+$/.test(rawQ) ? `v${rawQ}` : rawQ;
  }

  let data: Record<string, KanbanBoard> = {};
  let total = 0;

  const options = {
    from: from ? Number.parseInt(from) : 0,
    size: size ? Number.parseInt(size) : 10,
    filter: {
      mintralKey: serviceCode ? `v${serviceCode}` : undefined,
      licensePlate: licensePlate ? licensePlate.toUpperCase() : undefined,
      driverId: driverId ? driverId : undefined,
      carrierId: carrierId ? carrierId : undefined,
      carrierName: carrierName ? carrierName : undefined,
      supplierName: supplierName ? supplierName : undefined,
      origin: origin ? origin.toUpperCase() : undefined,
      destination: destination ? destination.toUpperCase() : undefined,
      clientAbbreviation: customer ? customer : undefined,
      originIsSitrans: originType ? originType === "INTERNAL" : undefined,
      editable: editable ? editable === "true" : undefined,
      orderBy: orderBy ?? undefined,
      order: order ?? undefined,
      date_range_from: date_range_from ?? undefined,
      date_range_to: date_range_to ?? undefined,
      q,
    },
  };

  try {
    let taskResponses: FastTasksResponse[] | FinishedWorkflowsResponse[];
    if (show_finished) {
      taskResponses = (await Promise.all([
        ...columns.map((column) => {
          return getFinishedWorkflows(session, {
            from: from ? Number.parseInt(from) : 0,
            size: size ? Number.parseInt(size) : 10,
            definitionKey: column,
            filter: {
              mintralKey: serviceCode ? `v${serviceCode}` : undefined,
              licensePlate: licensePlate
                ? licensePlate.toUpperCase()
                : undefined,
              driverId: driverId ? driverId : undefined,
              carrierId: carrierId ? carrierId : undefined,
              carrierName: carrierName ? carrierName : undefined,
      supplierName: supplierName ? supplierName : undefined,
              origin: origin ? origin.toUpperCase() : undefined,
              destination: destination ? destination.toUpperCase() : undefined,
              clientAbbreviation: customer ? customer : undefined,
              originIsSitrans: originType
                ? originType === "INTERNAL"
                : undefined,
              editable: editable ? editable === "true" : undefined,
              orderBy: orderBy ?? undefined,
              order: order ?? undefined,
              date_range_from: date_range_from ?? undefined,
              date_range_to: date_range_to ?? undefined,
              q,
            },
          });
        }),
      ])) as FinishedWorkflowsResponse[];
    } else if (calendarId) {
      // Single call with all definition keys so the backend can apply ORDER BY
      // globally across stages — required for the calendarPlanningPriority
      // preset to be correct on the planner sidebar (ecm-coordinator #238).
      // toShippingKanban below re-bins the flat response by taskFormKey, but
      // the orderedTasks accumulator preserves the global backend order for
      // consumers that rely on it.
      taskResponses = [
        await getUnbookedTasks(session, columns, options, calendarId),
      ] as FastTasksResponse[];
    } else {
      taskResponses = (await Promise.all([
        ...columns.map((column) => {
          return getUserTasks(session, column, options);
        }),
      ])) as FastTasksResponse[];
    }

    // When the proxy issues a single combined backend call (calendarId branch)
    // the response is already globally sorted; pass an accumulator so callers
    // that need that order can read it without re-flattening from the
    // board-binned data.
    const orderedTasks =
      calendarId && taskResponses.length === 1 ? [] : undefined;
    taskResponses.forEach((tasks) => {
      toShippingKanban(tasks, data, orderedTasks);
      total += tasks.total;
    });

    // Cinturón y tirantes del tenant (org carrier): el ECM filtra por ILIKE
    // prefijo sobre mintral_supplierName; aquí se exige prefijo estricto
    // normalizado de la org para descartar falsos positivos del prefijo.
    if (carrierSupplierForzado) {
      const objetivo = carrierSupplierForzado.trim().toUpperCase();
      for (const board of Object.values(data)) {
        board.tasks = board.tasks.filter((tk) => {
          const sup = (tk as unknown as { mintral_supplierName?: string })
            .mintral_supplierName;
          return (
            typeof sup === "string" &&
            sup.trim().toUpperCase().startsWith(objetivo)
          );
        });
      }
    }

    return NextResponse.json({
      total,
      data,
      ...(orderedTasks ? { orderedTasks } : {}),
    });
  } catch (e: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (e?.status === 401) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          status: 401,
        },
        {
          status: 401,
        }
      );
    }
    return NextResponse.json({
      total,
      data,
    });
  }
}
