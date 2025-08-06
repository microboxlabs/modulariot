import Image from "next/image";
import { Fragment } from "react";
import Link from "next/link";
import type { KanBanCardProps } from "./kanban-card.types";
import { PropsWithI18nDict } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import DepartureDateShip from "../departure-date-ship/departure-date-ship";
import DownloadSignedDocument from "../download-signed-document/download-signed-document";
import { Tooltip } from "flowbite-react";
//import { FaCheck } from "react-icons/fa";
//import { TbExclamationMark } from "react-icons/tb";
//import { GoX } from "react-icons/go";
//import { KanbanBoardTask } from "../../types/common.types";

/* function formatDate(date: string) {
  if (!date) return "";
  if (date.includes("T")) {
    return date.split("T")[0].replaceAll("-", "/");
  }
  if (date.includes(" ")) {
    return date.split(" ")[0].replaceAll("-", "/");
  }
  return date.replaceAll("-", "/");
} */

/* const ValidationIcon = ({ task }: { task: KanbanBoardTask }) => {
  let status = "approved";

  if (task.departureDate === null) {
    status = "not_approved";
  }

  switch (status) {
    case "approved":
      return (
        <div className="w-5 h-5 text-white bg-green-500 border border-gray-400 rounded-full flex items-center justify-center p-1">
          <FaCheck className="w-full h-full" />
        </div>
      );
    case "alert":
      return (
        <div className="w-5 h-5 text-white bg-yellow-300 border border-gray-400 rounded-full flex items-center justify-center">
          <TbExclamationMark className="w-full h-full" />
        </div>
      );
    case "not_approved":
      return (
        <div className="w-5 h-5 text-white bg-red-500 border border-gray-400 rounded-full flex items-center justify-center">
          <GoX className="w-full h-full" />
        </div>
      );
    case "pending":
    default:
      return (
        <div className="w-5 h-5 bg-white border border-gray-400 rounded-full flex-shrink-0" />
      );
  }
}; */

export default function KanbanCard({
  task,
  table_name,
  compactKanbanView,
  dict,
  showFinishedTasks,
}: PropsWithI18nDict<KanBanCardProps>) {
  /*  const executionType =
    task.executionType === "T"
      ? "Troncal"
      : task.executionType === "F"
        ? "Faena"
        : task.executionType; */

  return (
    <div
      key={task.id}
      className={`relative rounded-lg hover:shadow-lg overflow-hidden ${
        compactKanbanView ? "p-1 " : "p-5 w-full"
      }
      ${task.mintral_priorityCode === "UR" ? "bg-purple-100 dark:bg-indigo-800 shadow" : "bg-white shadow dark:bg-gray-800"}
      ${!task.isEditable && !showFinishedTasks ? "opacity-60 grayscale cursor-not-allowed" : "hover:shadow-lg cursor-pointer"}
      `}
    >
      <div className="absolute inset-0 bg-gradient-to-r bg-gray-200 dark:bg-gray-700 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-1000 ease-out pointer-events-none" />
      <div className="relative z-10">
        {task.executionType === "F" && !compactKanbanView && (
          <div className="relative cursor-pointer">
            <div className="absolute inline-flex items-center justify-center w-6 h-6 text-xs font-bold text-white bg-red-500 border-white rounded-full -top-2 -end-2 dark:border-gray-900">
              F
            </div>
          </div>
        )}
        <div className="flex items-center justify-between cursor-pointer">
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
                    {task.executionType === "F" && (
                      <span className="inline-flex items-center justify-center w-5 h-5 ms-2 text-xs font-semibold text-white bg-red-500 rounded-full">
                        F
                      </span>
                    )}
                  </div>
                  {/* <div className="flex justify-end gap-2">
                  <DepartureDateShip
                    dict={dict}
                    table_name={table_name}
                    date={
                      task.departureDate ?? task.expectedDepartureDate ?? ""
                    }
                    compact={true}
                  />
                  {task.hoReference && (
                    <DownloadSignedDocument documentId={task.hoReference} />
                  )}
                </div> */}
                </div>
              ) : (
                <strong>
                  {tr("card.service", dict)}: {task.name}
                </strong>
              )}
            </div>
          </Link>
          {/* <EditCardModal /> */}
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
              {/* <div className="pb-4 text-sm font-normal text-gray-700 dark:text-gray-400">
              {tr("card.serviceKind", dict)}:{" "}
              <strong>{task.serviceKind || "-"}</strong>
            </div> */}
              {/* {task.executionType !== "F" && (
              <div className="pb-4 text-sm font-normal text-gray-700 dark:text-gray-400">
                {tr("card.executionType", dict)}:{" "}
                <strong>{executionType || "-"}</strong>
              </div>
            )} */}
              <div className="flex justify-between">
                <div className="flex justify-start">
                  {task.hoReference && (
                    <DownloadSignedDocument documentId={task.hoReference} />
                  )}
                </div>
                <div className="flex items-center justify-start">
                  {task.members.map((member) => (
                    <Fragment key={member.id}>
                      <Link href="#" className="-mr-3" prefetch={false}>
                        <Image
                          alt={member.name}
                          height={28}
                          src={`/app/images/users/${member.avatar}`}
                          width={28}
                          className="rounded-full border-2 border-white dark:border-gray-800"
                        />
                      </Link>
                      <div className="invisible absolute z-50 inline-block rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white opacity-0 shadow-sm transition-opacity duration-300 dark:bg-gray-700">
                        {member.name}
                      </div>
                    </Fragment>
                  ))}
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
