import {
  Table,
  TableBody,
  TableHead,
  TableHeadCell,
  Pagination,
} from "flowbite-react";
import TableItem from "./table-item";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useSymptomsTable } from "@/features/common/providers/client-api.provider";
import "./style/orbitation.css";
import Image from "next/image";
import blue_pin from "@assets/pin/blue_pin.svg";
import black_code from "@assets/icons/map/conditions_separated/codigo_negro.svg";
import compromised_code from "@assets/icons/map/conditions_separated/comprometida.svg";
import critical_code from "@assets/icons/map/conditions_separated/critica.svg";
import observation_code from "@assets/icons/map/conditions_separated/observacion.svg";
import treatment_code from "@assets/icons/map/conditions_separated/tratamiento.svg";
import stable_code from "@assets/icons/map/conditions_separated/estable.svg";

export default function SymptomsTable({
  dict,
  currentPage,
  pageSize,
  searchTerm,
  setCurrentPage,
  compact = false,
  condition,
}: {
  dict: I18nRecord;
  currentPage: number;
  pageSize: number;
  searchTerm: string;
  setCurrentPage: (page: number) => void;
  compact?: boolean;
  condition: string;
}) {
  const { tableData, loading, error } = useSymptomsTable({
    page: currentPage,
    pageSize,
    search: searchTerm,
    condition,
  });

  if (loading) {
    return (
      <div className="flex flex-col flex-grow">
        <div className="h-10 bg-gray-200 dark:bg-gray-800  rounded-lg w-full flex flex-col flex-grow overflow-y-auto animate-pulse" />
        {!compact && (
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-200 bg-gray-200 dark:text-gray-800 dark:bg-gray-800 rounded-md animate-pulse">
              Mostrando 0-0 de 0
            </p>
            <div className="h-10 w-20 bg-gray-200 dark:bg-gray-800 rounded-md animate-pulse mt-1 mb-1"></div>
          </div>
        )}
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-red-500">Error: {error.message}</div>;
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(
      Math.max(1, Math.min(page, tableData?.pagination.totalPages || 0)),
    );
  };

  const startItem = tableData?.pagination.currentPage
    ? (tableData?.pagination.currentPage - 1) * pageSize + 1
    : 0;

  const endItem = tableData?.pagination.currentPage
    ? Math.min(
        tableData?.pagination.currentPage * pageSize,
        tableData?.pagination.totalPages,
      )
    : 0;

  if (tableData?.data.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center w-full h-full">
        <div className="relative flex flex-col justify-center items-center">
          <div className="border-2 border-gray-300 dark:border-gray-600 rounded-full h-[320px] w-[320px] flex justify-center items-center">
            <div className="border-2 border-gray-300 dark:border-gray-600 rounded-full h-[230px] w-[230px] flex justify-center items-center">
              <div className="border-2 border-gray-300 dark:border-gray-600 rounded-full h-[150px] w-[150px] flex justify-center items-center">
                <div className="absolute h-20 w-20 bg-gray-100 dark:bg-gray-700 rounded-full flex justify-center items-center">
                  <Image
                    src={blue_pin}
                    alt="Orbitation"
                    width={50}
                    height={50}
                    quality={100}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="h-10 w-10 absolute orbiting-icon flex justify-center items-center orbit-1 rounded-full">
            <Image
              src={black_code}
              alt="Orbitation"
              width={50}
              height={50}
              unoptimized
              quality={100}
              className="dark:invert"
            />
          </div>
          <div className="h-10 w-10 absolute orbiting-icon flex justify-center items-center orbit-2 rounded-full">
            <Image
              src={compromised_code}
              alt="Orbitation"
              width={50}
              height={50}
              unoptimized
              quality={100}
              className="dark:invert"
            />
          </div>
          <div className="h-10 w-10 absolute orbiting-icon flex justify-center items-center orbit-3 rounded-full">
            <Image
              src={critical_code}
              alt="Orbitation"
              width={50}
              height={50}
              unoptimized
              quality={100}
              className="dark:invert"
            />
          </div>
          <div className="h-10 w-10 absolute orbiting-icon flex justify-center items-center orbit-4 rounded-full">
            <Image
              src={observation_code}
              alt="Orbitation"
              width={50}
              height={50}
              unoptimized
              quality={100}
              className="dark:invert"
            />
          </div>
          <div className="h-10 w-10 absolute orbiting-icon flex justify-center items-center orbit-5 rounded-full">
            <Image
              src={treatment_code}
              alt="Orbitation"
              width={50}
              height={50}
              unoptimized
              quality={100}
              className="dark:invert"
            />
          </div>
          <div className="h-10 w-10 absolute orbiting-icon flex justify-center items-center orbit-6 rounded-full">
            <Image
              src={stable_code}
              alt="Orbitation"
              width={50}
              height={50}
              quality={100}
              className="dark:invert"
            />
          </div>
        </div>
        <p className="text-lg text-gray-500 mt-10">
          {(dict.symptoms as I18nRecord).no_active_conditions as string}
        </p>
        <p className="text-sm font-light text-gray-400">
          {(dict.symptoms as I18nRecord).normal_operation as string}
        </p>
        <p className="text-sm font-light text-gray-400">
          {(dict.symptoms as I18nRecord).check_later as string}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-grow">
      <div className="h-10 p- bg-gray-50 dark:bg-gray-700 shadow-md rounded-lg w-full border-2 border-gray-300 dark:border-gray-600 flex flex-col flex-grow overflow-y-auto">
        <Table
          striped
          hoverable={compact}
          theme={{
            body: {
              cell: {
                base: "px-6 py-1 group-first/body:group-first/row:first:rounded-tl-lg group-first/body:group-first/row:last:rounded-tr-lg group-last/body:group-last/row:first:rounded-bl-none group-last/body:group-last/row:last:rounded-br-none",
              },
            },
          }}
        >
          {!compact ? (
            <TableHead>
              <TableHeadCell className="whitespace-nowrap">
                {(dict.symptoms as I18nRecord).condition as string}
              </TableHeadCell>
              <TableHeadCell className="whitespace-nowrap">
                {(dict.symptoms as I18nRecord).symptom as string}
              </TableHeadCell>
              <TableHeadCell className="whitespace-nowrap">
                {(dict.symptoms as I18nRecord).active_time as string}
              </TableHeadCell>
              <TableHeadCell className="whitespace-nowrap">
                {(dict.symptoms as I18nRecord).trip as string}
              </TableHeadCell>
              <TableHeadCell className="whitespace-nowrap">
                {(dict.symptoms as I18nRecord).driver as string}
              </TableHeadCell>
              <TableHeadCell className="whitespace-nowrap">
                {(dict.symptoms as I18nRecord).departure_date as string}
              </TableHeadCell>
              {/* <TableHeadCell className="whitespace-nowrap">
                {(dict.symptoms as I18nRecord).state as string}
              </TableHeadCell> */}
            </TableHead>
          ) : (
            <TableHead>
              <TableHeadCell className="whitespace-nowrap">
                {(dict.symptoms as I18nRecord).condition as string}
              </TableHeadCell>
              <TableHeadCell className="whitespace-nowrap">
                {(dict.symptoms as I18nRecord).departure_date as string}
              </TableHeadCell>
            </TableHead>
          )}

          <TableBody>
            {tableData?.data.map((item, index) => (
              <TableItem
                key={index}
                data={item}
                dict={dict}
                compact={compact}
              />
            ))}
          </TableBody>
        </Table>
      </div>
      {!compact && (
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-500">
            {tableData && tableData?.pagination.totalPages > 0 ? (
              <>
                {(dict.symptoms as I18nRecord).showing as string}{" "}
                <span className="font-bold">
                  {startItem}-{endItem}
                </span>{" "}
                {(dict.symptoms as I18nRecord).of as string}{" "}
                <span className="font-bold">
                  {tableData?.pagination.totalPages}
                </span>
              </>
            ) : (
              "No hay resultados"
            )}
          </p>
          {tableData && tableData?.pagination.totalPages > 0 && (
            <Pagination
              layout="pagination"
              nextLabel=""
              previousLabel=""
              currentPage={tableData?.pagination.currentPage}
              totalPages={Math.max(1, tableData?.pagination.totalPages)}
              showIcons={true}
              onPageChange={handlePageChange}
              theme={{
                pages: {
                  base: "mt-1 mb-1 inline-flex items-center -space-x-px",
                  selector: {
                    active: "bg-blue-100 text-blue-500",
                  },
                },
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
