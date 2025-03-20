"use client";

import { TableRow, TableCell, Button } from "flowbite-react";
import ConditionIcon from "./condition-icon";
import { Conditions, TableItemType } from "./table-item.type";
import { HiArrowRight } from "react-icons/hi";
import Link from "next/link";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
export default function TableItem({
  data,
  dict,
  compact = false,
}: {
  data: TableItemType;
  dict: I18nRecord;
  compact?: boolean;
}) {
  if (!compact) {
    return (
      <TableRow
        className={`dark:bg-gray-800 text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700
        ${Conditions[data.condition as keyof typeof Conditions]?.bgColor}`}
      >
        <TableCell className=" whitespace-nowrap font-medium text-gray-900 dark:text-white">
          <div className="flex items-center gap-2">
            <ConditionIcon
              condition={data.condition}
              size="h-7 w-7"
              dict={dict}
            />
            <p
              className={`text-xs text-nowrap ${Conditions[data.condition as keyof typeof Conditions]?.textColor}`}
            >
              {data.licensePlate}
            </p>
          </div>
        </TableCell>
        <TableCell
          className={`text-xs text-nowrap ${Conditions[data.condition as keyof typeof Conditions]?.textColor}`}
        >
          {data.alertType}
        </TableCell>
        <TableCell
          className={`text-xs text-nowrap ${Conditions[data.condition as keyof typeof Conditions]?.textColor}`}
        >
          {data.time} {/* {(dict.symptoms as I18nRecord).sec as string}. */}
        </TableCell>
        <TableCell
          className={`text-xs text-nowrap ${Conditions[data.condition as keyof typeof Conditions]?.textColor}`}
        >
          {data.trip}
        </TableCell>
        <TableCell
          className={`text-xs text-nowrap ${Conditions[data.condition as keyof typeof Conditions]?.textColor}`}
        >
          {data.driver}
        </TableCell>
        <TableCell
          className={`text-xs text-nowrap ${Conditions[data.condition as keyof typeof Conditions]?.textColor}`}
        >
          {new Date(data.date).toLocaleString()}
        </TableCell>
        <TableCell
          className={`text-xs text-nowrap ${Conditions[data.condition as keyof typeof Conditions]?.textColor}`}
        >
          {/* {dict.symptoms[data.alertType as keyof typeof dict.symptoms]} */}
          {data.status}
        </TableCell>
        <TableCell
          className={`text-xs text-nowrap ${Conditions[data.condition as keyof typeof Conditions]?.textColor}`}
        >
          <div className="flex items-center gap-2">
            {data.status ? (
              <Link
                href={`/symptoms/map-view/${data.id}?tripId=${data.trip}&assetId=${data.licensePlate}`}
              >
                <Button
                  className="h-8 flex justify-center items-center !text-xs"
                  color="blue"
                >
                  <div className="flex items-center gap-2">
                    <p>{data.status}</p>
                    <HiArrowRight className="w-4 h-4" />
                  </div>
                </Button>
              </Link>
            ) : (
              <Link
                href={`/symptoms/map-view/${data.id}?tripId=${data.trip}&assetId=${data.licensePlate}`}
              >
                <Button
                  className="h-8 flex justify-center items-center !text-xs"
                  color="blue"
                >
                  <div className="flex items-center gap-2">
                    <p>{(dict.symptoms as I18nRecord).diagnose as string}</p>
                    <HiArrowRight className="w-4 h-4" />
                  </div>
                </Button>
              </Link>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow
      className={`dark:border-gray-700 dark:bg-gray-800 text-gray-900 dark:text-white 
    ${Conditions[data.condition as keyof typeof Conditions].bgColor} !border-0`}
    >
      <TableCell className=" whitespace-nowrap font-medium text-gray-900 dark:text-white">
        <div className="flex items-center gap-2">
          <ConditionIcon
            condition={data.condition}
            size="h-7 w-7"
            dict={dict}
          />
          <p
            className={`text-xs text-nowrap ${Conditions[data.condition as keyof typeof Conditions]?.textColor}`}
          >
            <Link
              href={`/symptoms/map-view/${data.id}?tripId=${data.trip}&assetId=${data.licensePlate}`}
            >
              {data.licensePlate}
            </Link>
          </p>
        </div>
      </TableCell>
      <TableCell
        className={`text-xs text-nowrap ${Conditions[data.condition as keyof typeof Conditions]?.textColor}`}
      >
        {new Date(data.date).toLocaleString()}
      </TableCell>
    </TableRow>
  );
}
