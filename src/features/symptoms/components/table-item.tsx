import { TableRow, TableCell } from "flowbite-react";
import ConditionIcon from "./condition-icon";
import { Conditions, TableItemType } from "./table-item.type";

export default function TableItem({ data }: { data: TableItemType }) {
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
        {data.time}
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
        {data.alertType}
      </TableCell>
    </TableRow>
  );
}
