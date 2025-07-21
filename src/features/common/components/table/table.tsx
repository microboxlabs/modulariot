import { Table } from "flowbite-react";
import React from "react";

export default function CustomTable({
  children,
  isLoading,
  data,
  no_data_message,
  error,
  headers,
  data_count,
}: {
  children: React.ReactNode;
  data: any;
  no_data_message: string;
  isLoading: boolean;
  error: any;
  headers: string[];
  data_count: number;
}) {
  return (
    <div
      className={`flex-1 w-0 min-w-full overflow-x-auto h-full transition-all duration-300 `}
    >
      <div className="h-full w-full flex flex-col">
        <Table
          hoverable
          striped
          theme={{
            root: {
              base: "w-full text-left text-sm text-gray-500 dark:text-gray-400",
              shadow:
                "absolute left-0 top-0 -z-10 h-full w-full rounded-md bg-white drop-shadow-md dark:bg-black",
              wrapper: "relative",
            },
            body: {
              base: "group/body",
              cell: {
                base: "px-6 py-1",
              },
            },
            head: {
              base: "group/head text-xs uppercase text-gray-700 dark:text-gray-400",
              cell: {
                base: "bg-gray-50 px-6 py-3 dark:bg-gray-600",
              },
            },
            row: {
              base: "group/row",
              hovered: "hover:bg-gray-50 dark:hover:bg-gray-600",
              striped:
                "odd:bg-white even:bg-gray-50 odd:dark:bg-gray-800 even:dark:bg-gray-700",
            },
          }}
        >
          <Table.Head>
            {headers.map((header, index) => (
              <Table.HeadCell key={index} className="whitespace-nowrap">
                {header}
              </Table.HeadCell>
            ))}
          </Table.Head>
          {data && data_count > 0 && !isLoading && !error && (
            <Table.Body>{children}</Table.Body>
          )}
        </Table>
        {data && data_count === 0 && !isLoading && !error && (
          <div className="flex justify-center items-center h-full w-full text-gray-500">
            {no_data_message}
          </div>
        )}
        {isLoading && !error && (
          <div className="w-full h-full flex flex-grow bg-gray-300 dark:bg-gray-600 animate-pulse"></div>
        )}
        {error && (
          <div className="flex justify-center items-center h-full w-full text-red-500">
            Error: {error.message}
          </div>
        )}
      </div>
    </div>
  );
}
