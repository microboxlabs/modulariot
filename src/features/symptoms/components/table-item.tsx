"use client";

import { TableRow, TableCell, Button } from "flowbite-react";
import ConditionIcon from "./condition-icon";
import { Conditions, TableItemType } from "./table-item.type";
import { HiArrowRight } from "react-icons/hi";
import Link from "next/link";

export default function TableItem({
  data,
  dict,
  compact = false,
}: {
  data: TableItemType;
  dict: any;
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
            <ConditionIcon condition={data.condition} size="h-8 w-8" />
            <p
              className={`text-xs ${Conditions[data.condition as keyof typeof Conditions]?.textColor}`}
            >
              {data.licensePlate}
            </p>
          </div>
        </TableCell>
        <TableCell
          className={`text-xs ${Conditions[data.condition as keyof typeof Conditions]?.textColor}`}
        >
          {data.time} {dict.symptoms.sec}.
        </TableCell>
        <TableCell
          className={`text-xs ${Conditions[data.condition as keyof typeof Conditions]?.textColor}`}
        >
          {data.trip}
        </TableCell>
        <TableCell
          className={`text-xs ${Conditions[data.condition as keyof typeof Conditions]?.textColor}`}
        >
          {data.driver}
        </TableCell>
        <TableCell
          className={`text-xs ${Conditions[data.condition as keyof typeof Conditions]?.textColor}`}
        >
          {new Date(data.date).toLocaleString()}
        </TableCell>
        <TableCell
          className={`text-xs ${Conditions[data.condition as keyof typeof Conditions]?.textColor}`}
        >
          {data.service}
        </TableCell>
        <TableCell
          className={`text-xs ${Conditions[data.condition as keyof typeof Conditions]?.textColor}`}
        >
          {/* {dict.symptoms[data.alertType as keyof typeof dict.symptoms]} */}
          {data.alertType}
        </TableCell>
        <TableCell
          className={`text-xs ${Conditions[data.condition as keyof typeof Conditions]?.textColor}`}
        >
          <div className="flex items-center gap-2">
            {data.status ? (
              <p className=" bg-gray-200 dark:bg-gray-700 dark:border dark:border-white rounded-md p-2 text-gray-900 dark:text-white">
                {data.status}
              </p>
            ) : (
              <Link
                href={`/symptoms/map-view/${data.id}?tripId=${data.trip}&assetId=${data.licensePlate}`}
              >
                <Button
                  className="h-8 flex justify-center items-center !text-xs"
                  color="blue"
                  /* onClick={() => router.push("/symptoms/map-view")} */
                >
                  <div className="flex items-center gap-2">
                    <p>{dict?.symptoms?.diagnose}</p>
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
          <ConditionIcon condition={data.condition} size="h-8 w-8" />
          <p
            className={`text-xs ${Conditions[data.condition as keyof typeof Conditions]?.textColor}`}
          >
            {data.licensePlate}
          </p>
        </div>
      </TableCell>
      <TableCell
        className={`text-xs ${Conditions[data.condition as keyof typeof Conditions]?.textColor}`}
      >
        {new Date(data.date).toLocaleString()}
      </TableCell>
    </TableRow>
  );
}
