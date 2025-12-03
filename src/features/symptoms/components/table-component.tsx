import { Pagination } from "flowbite-react";
import TableItem from "./table-item";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useSymptomsTable } from "@/features/common/providers/client-api.provider";
import EmptyTable from "./empty-table";
import CustomTable from "@/features/common/components/custom-table/custom-table";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

const pageSize = 10;

export default function SymptomsTable({
  dict,
  compact = false,
}: {
  dict: I18nRecord;
  compact?: boolean;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const searchParams = useSearchParams();

  const { tableData, loading, error } = useSymptomsTable({
    page: currentPage,
    pageSize,
    icu_code: searchParams.get("icu_code") || "",
    trip_id: searchParams.get("trip_id") || "",
    asset_id: searchParams.get("asset_id") || "",
    driver_id: searchParams.get("driver_id") || "",
    carrier_id: searchParams.get("carrier_id") || "",
    origin: searchParams.get("origin") || "",
    destination: searchParams.get("destination") || "",
    symptom_name: searchParams.get("symptom_name") || "",
    date_range: {
      from: searchParams.get("date_from") || "",
      to: searchParams.get("date_to") || "",
    },
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
    const totalPages = Math.ceil(
      (tableData?.pagination.totalRecords || 0) / pageSize
    );
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const totalPages = Math.ceil(
    (tableData?.pagination.totalRecords || 0) / pageSize
  );

  const startItem = tableData?.pagination.currentPage
    ? (tableData?.pagination.currentPage - 1) * pageSize + 1
    : 0;

  const endItem = tableData?.pagination.currentPage
    ? Math.min(
        tableData?.pagination.currentPage * pageSize,
        tableData?.pagination.totalRecords || 0
      )
    : 0;

  if (tableData?.data.length === 0) {
    return <EmptyTable dict={dict} />;
  }

  const header = !compact
    ? [
        (dict.symptoms as I18nRecord).condition as string,
        (dict.symptoms as I18nRecord).symptom as string,
        (dict.symptoms as I18nRecord).active_time as string,
        (dict.symptoms as I18nRecord).trip as string,
        (dict.symptoms as I18nRecord).driver as string,
        (dict.symptoms as I18nRecord).creation_date as string,
        "",
      ]
    : [
        (dict.symptoms as I18nRecord).condition as string,
        (dict.symptoms as I18nRecord).creation_date as string,
        "",
      ];

  const content = [
    ...(tableData && tableData.data
      ? tableData.data.map((item, index) => (
          <TableItem key={index} data={item} dict={dict} compact={compact} />
        ))
      : []),
  ];

  console.log(tableData);

  return (
    <div className="flex flex-col flex-grow">
      <div className="h-10 bg-gray-50 dark:bg-gray-700 shadow-md rounded-lg w-full border-2 border-gray-300 dark:border-gray-600 flex flex-col flex-grow overflow-y-auto">
        <CustomTable content={content} header={header} hoverable={true} />
      </div>
      {!compact && (
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-500">
            {tableData && totalPages > 0 ? (
              <>
                {(dict.symptoms as I18nRecord).showing as string}{" "}
                <span className="font-bold">
                  {startItem}-{endItem}
                </span>{" "}
                {(dict.symptoms as I18nRecord).of as string}{" "}
                <span className="font-bold">
                  {tableData?.pagination.totalRecords}
                </span>
              </>
            ) : (
              "No hay resultados"
            )}
          </p>
          {tableData && totalPages > 0 && (
            <Pagination
              layout="pagination"
              nextLabel=""
              previousLabel=""
              currentPage={tableData?.pagination.currentPage}
              totalPages={Math.max(1, totalPages)}
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
