import {
  Table,
  TableBody,
  TableHead,
  TableHeadCell,
  Pagination,
} from "flowbite-react";
import { useSymptomsTable } from "../hooks/use-symptoms-table";
import TableItem from "./table-item";

export default function SymptomsTable({
  dict,
  currentPage,
  pageSize,
  searchTerm,
  setCurrentPage,
  compact = false,
}: {
  dict: any;
  currentPage: number;
  pageSize: number;
  searchTerm: string;
  setCurrentPage: (page: number) => void;
  compact?: boolean;
}) {
  const { tableData, loading, error } = useSymptomsTable({
    page: currentPage,
    pageSize,
    search: searchTerm,
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
            <div className="h-10 w-20 bg-gray-200 dark:bg-gray-800 rounded-md animate-pulse mt-2"></div>
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

  return (
    <div className="flex flex-col flex-grow">
      <div className="h-10 p- bg-gray-50 dark:bg-gray-700 shadow-md rounded-lg w-full border-2 border-gray-300 dark:border-gray-600 flex flex-col flex-grow overflow-y-auto">
        <Table
          striped
          theme={{
            body: {
              cell: {
                base: "px-6 py-2 group-first/body:group-first/row:first:rounded-tl-lg group-first/body:group-first/row:last:rounded-tr-lg group-last/body:group-last/row:first:rounded-bl-none group-last/body:group-last/row:last:rounded-br-none",
              },
            },
          }}
        >
          {!compact ? (
            <TableHead>
              <TableHeadCell>{dict.symptoms.condition}</TableHeadCell>
              <TableHeadCell>{dict.symptoms.active_time}</TableHeadCell>
              <TableHeadCell>{dict.symptoms.trip}</TableHeadCell>
              <TableHeadCell>{dict.symptoms.driver}</TableHeadCell>
              <TableHeadCell>{dict.symptoms.departure_date}</TableHeadCell>
              <TableHeadCell>{dict.symptoms.service}</TableHeadCell>
              <TableHeadCell>{dict.symptoms.alert_type}</TableHeadCell>
              <TableHeadCell>{dict.symptoms.state}</TableHeadCell>
            </TableHead>
          ) : (
            <TableHead>
              <TableHeadCell>{dict.symptoms.condition}</TableHeadCell>
              <TableHeadCell>{dict.symptoms.departure_date}</TableHeadCell>
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
                {dict.symptoms.showing}{" "}
                <span className="font-bold">
                  {startItem}-{endItem}
                </span>{" "}
                {dict.symptoms.of}{" "}
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
