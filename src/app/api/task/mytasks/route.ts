import "server-only";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import {
  getFinishedWorkflows,
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
  const originIsSitrans = url.searchParams.get("originIsSitrans");
  let data: Record<string, KanbanBoard> = {};
  let total = 0;

  const options = {
    from: from ? parseInt(from) : 0,
    size: size ? parseInt(size) : 10,
    filter: {
      mintralKey: serviceCode ? `v${serviceCode}` : undefined,
      licensePlate: licensePlate ? licensePlate.toUpperCase() : undefined,
      driverId: driverId ? driverId : undefined,
      carrierId: carrierId ? carrierId : undefined,
      carrierName: carrierName ? carrierName : undefined,
      origin: origin ? origin.toUpperCase() : undefined,
      destination: destination ? destination.toUpperCase() : undefined,
      clientAbbreviation: customer ? customer : undefined,
      originIsSitrans: originIsSitrans ? originIsSitrans : undefined,
    },
  };

  try {
    let taskResponses: FastTasksResponse[] | FinishedWorkflowsResponse[];
    if (show_finished) {
      taskResponses = (await Promise.all([
        ...columns.map((column) => {
          return getFinishedWorkflows(session, {
            from: from ? parseInt(from) : 0,
            size: size ? parseInt(size) : 10,
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
              originIsSitrans: originIsSitrans ? originIsSitrans : undefined,
            },
          });
        }),
        /* getFinishedWorkflows(session, {
          from: from ? parseInt(from) : 0,
          size: size ? parseInt(size) : 10,
          //definitionKey: "shippingCoordinatorProcess",
          filter: {
            mintralKey: serviceCode ? `v${serviceCode}` : undefined,
            licensePlate: licensePlate ? licensePlate.toUpperCase() : undefined,
            driverId: driverId ? driverId : undefined,
            carrierId: carrierId ? carrierId : undefined,
            carrierName: carrierName ? carrierName : undefined,
            origin: origin ? origin.toUpperCase() : undefined,
            destination: destination ? destination.toUpperCase() : undefined,
            clientAbbreviation: customer ? customer : undefined,
          },
        }).then((res) => ({
          tasks: res.workflows,
          total: res.total,
        })), */
      ])) as FinishedWorkflowsResponse[];
    } else {
      taskResponses = (await Promise.all([
        ...columns.map((column) => {
          return getUserTasks(session, column, options);
        }),
      ])) as FastTasksResponse[];
    }

    taskResponses.forEach((tasks) => {
      toShippingKanban(tasks, data);
      total += tasks.total;
    });

    return NextResponse.json({
      total,
      data,
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
