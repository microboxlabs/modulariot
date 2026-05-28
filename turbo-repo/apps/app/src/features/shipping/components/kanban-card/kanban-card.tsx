import Image from "next/image";
import Link from "next/link";
import type { KanBanCardProps } from "./kanban-card.types";
import { GroupAvatar } from "../group-avatar/group-avatar";
import { PropsWithI18nDict } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import DepartureDateShip from "../departure-date-ship/departure-date-ship";
import DownloadSignedDocument from "../download-signed-document/download-signed-document";
import { Tooltip } from "flowbite-react";
import { ServiceCategoryBadge } from "@/features/common/components/service-category-badge/service-category-badge";

export default function KanbanCard({
  task,
  table_name,
  compactKanbanView,
  dict,
  showFinishedTasks,
  isLoading = false,
}: PropsWithI18nDict<KanBanCardProps>) {
  let cursor = "hover:shadow-lg cursor-pointer";

  if (!task.isEditable && !showFinishedTasks) {
    cursor = "opacity-60 grayscale cursor-not-allowed";
  }
  if (isLoading) {
    cursor = "!cursor-wait";
  }

  // The service category badge replaces the "F" (faena) indicator when set.
  // While the category catalog is still loading the badge renders nothing, so
  // we suppress the "F" fallback whenever a category code is present at all.
  const hasServiceCategory = Boolean(task.mintral_serviceCategory);
  const showFaenaBadge = !hasServiceCategory && task.executionType === "F";

  return (
    <div
      key={task.id}
      className={`relative rounded-lg hover:shadow-lg overflow-hidden ${
        compactKanbanView ? "p-1 " : "p-5 w-full"
      }
      ${task.mintral_priorityCode === "UR" ? "bg-purple-100 dark:bg-indigo-800 shadow" : "bg-white shadow dark:bg-gray-700"}
      ${cursor}
      `}
    >
      <div className="absolute inset-0 bg-gradient-to-r bg-black/10 dark:bg-white/10 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-1000 ease-out pointer-events-none" />
      <div className="relative z-10">
        {!compactKanbanView && (hasServiceCategory || showFaenaBadge) && (
          <div className="relative">
            {hasServiceCategory ? (
              <ServiceCategoryBadge
                code={task.mintral_serviceCategory}
                variant="solid"
                className="absolute -top-2 -end-2 h-6 min-w-6 text-xs"
              />
            ) : (
              <div className="absolute inline-flex items-center justify-center w-6 h-6 text-xs font-bold text-white bg-red-500 border-white rounded-full -top-2 -end-2 dark:border-gray-900">
                F
              </div>
            )}
          </div>
        )}
        <div className="flex items-center justify-between">
          <Link href={`/task/edit/${task.id}`} className="w-full">
            <div className="text-base text-gray-900 dark:text-gray-200">
              {compactKanbanView ? (
                <div className="flex justify-between gap-2">
                  <div className="whitespace-nowrap flex items-center gap-2 pl-2 pr-2">
                    {/*  <ValidationIcon task={task} /> */}
                    <strong
                      className={
                        !showFinishedTasks && !task.isEditable
                          ? "text-gray-400"
                          : ""
                      }
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {task.name}
                    </strong>
                    {hasServiceCategory ? (
                      <ServiceCategoryBadge
                        code={task.mintral_serviceCategory}
                        variant="solid"
                        className="ms-2 h-5 min-w-5 text-xs border-0"
                      />
                    ) : (
                      showFaenaBadge && (
                        <span className="inline-flex items-center justify-center w-5 h-5 ms-2 text-xs font-semibold text-white bg-red-500 rounded-full">
                          F
                        </span>
                      )
                    )}
                  </div>
                </div>
              ) : (
                <strong>
                  {tr("card.service", dict)}: {task.name}
                </strong>
              )}
            </div>
          </Link>
        </div>
        <div className="flex flex-col">
          {task.attachment && (
            <div className="relative mb-3 aspect-video w-full">
              <Image alt="" fill src={task.attachment} className="rounded-lg" />
            </div>
          )}

          <div
            className={`text-sm font-normal text-gray-700 dark:text-gray-400 flex ${
              !compactKanbanView ? "pb-4" : ""
            }`}
          >
            {compactKanbanView ? (
              <></>
            ) : (
              <>
                <div className="basis-1/2">
                  {tr("card.origin", dict)}: <strong>{task.origin}</strong>
                </div>
                <div className="basis-1/2 text-right">
                  {tr("card.destination", dict)}:{" "}
                  <strong>{task.destination}</strong>
                </div>
              </>
            )}
          </div>
          {!compactKanbanView ? (
            <>
              {/*  <div className="pb-4 text-sm font-normal text-gray-700 dark:text-gray-400">
              {tr("card.clientCode", dict)}:{" "}
              <strong>{task.clientCode || "-"}</strong>
            </div> */}
              <div className="pb-4 text-sm font-normal text-gray-700 dark:text-gray-400">
                {tr("card.clientName", dict)}:{" "}
                <strong>{task.client || "-"}</strong>
                {/* {task.description} */}
              </div>
              {/* <div className="pb-4 text-sm font-normal text-gray-700 dark:text-gray-400">
              {tr("card.serviceKind", dict)}:{" "}
              <strong>{task.serviceKind || "-"}</strong>
            </div> */}
              <div className="pb-4 text-sm font-normal text-gray-700 dark:text-gray-400">
                {tr("card.truckLicensePlate", dict)}:{" "}
                <strong>{task.mintral_truckLicensePlate || "-"}</strong>
              </div>
              <div className="pb-4 text-sm font-normal text-gray-700 dark:text-gray-400">
                <Tooltip
                  style="auto"
                  content={task.mintral_supplierName || "-"}
                  placement="top"
                >
                  <strong>
                    {task?.mintral_supplierName
                      ? task?.mintral_supplierName?.substring(0, 21) +
                        (task?.mintral_supplierName?.length &&
                        task?.mintral_supplierName?.length > 21
                          ? "..."
                          : "")
                      : tr("card.withoutDriver", dict)}
                  </strong>
                </Tooltip>
              </div>
              <div className="flex justify-between">
                <div className="flex justify-start">
                  {task.hoReference && (
                    <DownloadSignedDocument
                      documentId={task.hoReference}
                      name={task.name}
                    />
                  )}
                </div>
                <div className="flex items-center justify-start">
                  <GroupAvatar group={task.candidateGroup} />
                </div>
                <DepartureDateShip
                  dict={dict}
                  table_name={table_name}
                  date={task.departureDate ?? task.expectedDepartureDate ?? ""}
                />
              </div>
            </>
          ) : (
            <></>
          )}
        </div>
      </div>
    </div>
  );
}
