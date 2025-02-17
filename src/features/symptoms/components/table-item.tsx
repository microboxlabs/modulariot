"use client";

import { TableRow, TableCell, Button } from "flowbite-react";
import ConditionIcon from "./condition-icon";
import { Conditions, TableItemType } from "./table-item.type";
import { HiArrowRight } from "react-icons/hi";
import { useRouter } from "next/navigation";

export default function TableItem({ 
  data, 
  dict,
}: { 
  data: TableItemType;
  dict: any;
}) {
  const router = useRouter();

  return (
    <TableRow
      className={`dark:border-gray-700 dark:bg-gray-800 text-gray-900 dark:text-white 
        ${Conditions[data.condition as keyof typeof Conditions].bgColor} !border-0`}
    >
      <TableCell className=" whitespace-nowrap font-medium text-gray-900 dark:text-white">
        <div className="flex justify-center items-center gap-2">
          <ConditionIcon condition={data.condition} />
          <p
            className={`${Conditions[data.condition as keyof typeof Conditions].textColor}`}
          >
            {data.licensePlate}
          </p>
        </div>
      </TableCell>
      <TableCell
        className={`${Conditions[data.condition as keyof typeof Conditions].textColor}`}
      >
        {data.time} {dict.symptoms.sec}.
      </TableCell>
      <TableCell
        className={`${Conditions[data.condition as keyof typeof Conditions].textColor}`}
      >
        {data.trip}
      </TableCell>
      <TableCell
        className={`${Conditions[data.condition as keyof typeof Conditions].textColor}`}
      >
        {data.driver}
      </TableCell>
      <TableCell
        className={`${Conditions[data.condition as keyof typeof Conditions].textColor}`}
      >
        {data.date}
      </TableCell>
      <TableCell
        className={`${Conditions[data.condition as keyof typeof Conditions].textColor}`}
      >
        {data.service}
      </TableCell>
      <TableCell
        className={`${Conditions[data.condition as keyof typeof Conditions].textColor}`}
      >
        {dict.symptoms[data.alertType as keyof typeof dict.symptoms]}
      </TableCell>
      <TableCell
        className={`${Conditions[data.condition as keyof typeof Conditions].textColor}`}
      >
        <div className="flex items-center gap-2">
          {data.status != null ? (
            <p className=" bg-gray-200 dark:bg-gray-700 dark:border dark:border-white rounded-md p-2 text-gray-900 dark:text-white">
              {data.status}
            </p>
          ) : (
            <Button 
              color="blue" 
              onClick={() => router.push("/symptoms/map-view")}
            >
              <p>{dict.symptoms.diagnose}</p>
              <HiArrowRight className="w-5 h-5 ml-2" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
