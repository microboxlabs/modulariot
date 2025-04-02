import Image from "next/image";
import { Fragment } from "react";
import Link from "next/link";
import type { KanBanCardProps } from "./kanban-card.types";
import { PropsWithI18nDict } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import DepartureDateShip from "../departure-date-ship/departure-date-ship";
import DownloadSignedDocument from "../download-signed-document/download-signed-document";

export default function KanbanCard({
  task,
  table_name,
  dict,
}: PropsWithI18nDict<KanBanCardProps>) {
  const executionType =
    task.executionType === "T"
      ? "Troncal"
      : task.executionType === "F"
        ? "Faena"
        : task.executionType;

  return (
    <div
      key={task.id}
      className="mb-4 w-64 rounded-lg bg-white p-5 shadow dark:bg-gray-800 hover:shadow-lg"
    >
      <div className="flex items-center justify-between pb-4 cursor-pointer">
        <Link href={`/task/edit/${task.id}`}>
          <div className="text-base text-gray-900 dark:text-gray-200">
            <strong>
              {tr("card.service", dict)}: {task.name}
            </strong>
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
        <div className="pb-4 text-sm font-normal text-gray-700 dark:text-gray-400 flex">
          <div className="basis-1/2">
            {tr("card.origin", dict)}: <strong>{task.origin}</strong>
          </div>
          <div className="basis-1/2 text-right">
            {tr("card.destination", dict)}: <strong>{task.destination}</strong>
          </div>
          {/* {task.description} */}
        </div>
        <div className="pb-4 text-sm font-normal text-gray-700 dark:text-gray-400">
          {tr("card.clientCode", dict)}:{" "}
          <strong>{task.clientCode || "-"}</strong>
        </div>
        <div className="pb-4 text-sm font-normal text-gray-700 dark:text-gray-400">
          {tr("card.clientName", dict)}: <strong>{task.client || "-"}</strong>
          {/* {task.description} */}
        </div>
        <div className="pb-4 text-sm font-normal text-gray-700 dark:text-gray-400">
          {tr("card.serviceKind", dict)}:{" "}
          <strong>{task.serviceKind || "-"}</strong>
        </div>
        <div className="pb-4 text-sm font-normal text-gray-700 dark:text-gray-400">
          {tr("card.executionType", dict)}:{" "}
          <strong>{executionType || "-"}</strong>
        </div>
        <div className="flex justify-between">
          <div className="flex justify-start">
            {task.hoReference && (
              <DownloadSignedDocument documentId={task.hoReference} />
            )}
          </div>
          <div className="flex items-center justify-start">
            {task.members.map((member) => (
              <Fragment key={member.id}>
                <Link href="#" className="-mr-3">
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
            category={"departure"}
            date={
              (table_name == "tripInitiated"
                ? task.departureDate
                : task.expectedDepartureDate) ?? ""
            }
          />
        </div>
      </div>
    </div>
  );
}
