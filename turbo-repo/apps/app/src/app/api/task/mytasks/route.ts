import "server-only";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
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

  const url = new URL(req.url);

  const columns = url.searchParams.getAll("columns");
  const from = url.searchParams.get("from");
  const size = url.searchParams.get("size");
  const show_finished = url.searchParams.get("showFinished") === "true";
  const serviceCode = url.searchParams.get("service");
  const licensePlate = url.searchParams.get("licensePlate");
  const driverId = url.searchParams.get("driverId");
  const carrierId = url.searchParams.get("carrierId");
  const carrierName = url.searchParams.get("carrierName");
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
      origin: origin ? origin.toUpperCase() : undefined,
      destination: destination ? destination.toUpperCase() : undefined,
      clientAbbreviation: customer ? customer : undefined,
      originIsSitrans: originType ? originType === "INTERNAL" : undefined,
      editable: editable ? editable === "true" : undefined,
      orderBy: orderBy ?? undefined,
      order: order ?? undefined,
      date_range_from: date_range_from ?? undefined,
      date_range_to: date_range_to ?? undefined,
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
