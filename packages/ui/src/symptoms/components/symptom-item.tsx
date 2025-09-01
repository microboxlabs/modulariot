"use client";

import { TableRow, TableCell, Button } from "flowbite-react";
import ConditionIcon from "./condition-icon";
import { Conditions, type TableItemType } from "../types/table-item.type";
import { HiArrowRight } from "react-icons/hi";
import Link from "next/link";

export default function SymptomItem({
  data,
  compact = false,
}: {
  data: TableItemType;
  compact?: boolean;
}) {
  if (!compact) {
    return (
      <TableRow
        className={`dark:bg-slate-800 text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700
        ${Conditions[data.condition as keyof typeof Conditions]?.bgColor}`}
      >
        <TableCell className=" whitespace-nowrap font-medium text-slate-900 dark:text-white">
          <div className="flex items-center gap-2">
            <ConditionIcon
              condition={data.condition}
              size="h-7 w-7"
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
        {/* <TableCell
          className={`text-xs text-nowrap ${Conditions[data.condition as keyof typeof Conditions]?.textColor}`}
        >
          
          {data.status}
        </TableCell> */}
        <TableCell
          className={`text-xs text-nowrap ${Conditions[data.condition as keyof typeof Conditions]?.textColor}`}
        >
          <div className="flex items-center gap-2">
            {data.last_assigned_to ? (
              <Link
                href={`/symptoms/map-view/${data.id}?tripId=${data.trip}&assetId=${data.licensePlate}`}
              >
                <Button
                  className="h-8 flex justify-center items-center !text-xs"
                  color="light"
                >
                  <div className="flex items-center gap-2">
                    <p>
                        { data.last_assigned_to }
                    </p>
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
                    <p>diagnose</p>
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
      className={`dark:bg-slate-800 text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700
      ${Conditions[data.condition as keyof typeof Conditions]?.bgColor}`}
    >
      <TableCell className=" whitespace-nowrap font-medium text-slate-900 dark:text-white">
        <div className="flex items-center gap-2">
          <ConditionIcon
            condition={data.condition}
            size="h-7 w-7"
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
