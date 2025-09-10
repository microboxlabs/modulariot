import { Table, TableHead, TableBody, TableHeadCell } from "flowbite-react";
import React from "react";

type Style = {
  headClassName?: string;
  bodyClassName?: string;
  rootClassName?: string;
};

/**
 * # Custom Table
 *
 * Custom Table is a proxy based on the Flowbite Table component.
 *
 * The way of use is defining a content, that content contains everything, including the header, that should always be the first element.
 *
 * @param hoverable if the table should have hover effect
 * @param content the content of the table as a list of rows, where the first row is the head
 * @param scrollable if the table body should be scrollable with fixed header
 * @param maxHeight maximum height for the scrollable area (e.g., "400px", "50vh")
 */
export default function CustomTable({
  hoverable = false,
  content,
  header,
  style = {
    headClassName: "",
    bodyClassName: "",
    rootClassName: "",
  },
  isLoading = false,
  error = null,
  no_data_message = "",
}: {
  hoverable?: boolean;
  header: string[] | React.ReactElement;
  content: (string[] | React.ReactElement)[];
  style?: Style;
  isLoading?: boolean;
  error?: any;
  no_data_message?: string;
}) {
  // Setting header and body
  let head: React.ReactNode = getListOrElement(header, true);
  let body: React.ReactNode = content.map((item, index) => {
    if (Array.isArray(item)) {
      return (
        <Table.Row key={`row-${index}`} className="bg-white dark:bg-gray-800">
          {getListOrElement(item, false)}
        </Table.Row>
      );
    } else {
      return item;
    }
  });

  if (isLoading) {
    return (
      <div className="w-full h-full bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse" />
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex justify-center items-center text-center text-red-500">
        Error: {error.message}
      </div>
    );
  }

  if (content.length === 0 && no_data_message) {
    return (
      <div className="w-full h-full flex justify-center items-center text-center text-gray-500 dark:text-gray-400">
        {no_data_message}
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <Table
        striped
        hoverable={hoverable}
        style={{ borderSpacing: "0 8px" }}
        theme={{
          root: {
            base: "w-full text-left text-sm text-gray-500 dark:text-gray-400 border-separate",
            shadow: "",
            wrapper: "relative",
          },
          head: {
            base: "group/head text-xs uppercase text-gray-700 dark:text-gray-400 sticky top-0 z-10 bg-gray-50 dark:bg-gray-700",
            cell: {
              base: `bg-gray-50 px-6 py-3 dark:bg-gray-700 sticky top-0 ${style.headClassName}`,
            },
          },
          body: {
            base: "group/body",
            cell: {
              base: `px-6 py-1 ${style.bodyClassName}`,
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
        <TableHead>{head}</TableHead>
        <TableBody>{body}</TableBody>
      </Table>
    </div>
  );
}

// <div className="flex flex-col h-full overflow-hidden border border-gray-200 dark:border-gray-700 rounded-lg">

function getListOrElement(
  item: string[] | React.ReactElement,
  isHeader: boolean
) {
  if (Array.isArray(item)) {
    return item.map((cell, index) => {
      if (isHeader) {
        return (
          <TableHeadCell key={`head-${index}`} className="whitespace-nowrap">
            {cell}
          </TableHeadCell>
        );
      } else {
        return (
          <Table.Cell key={`cell-${index}`} className="whitespace-nowrap">
            {cell}
          </Table.Cell>
        );
      }
    });
  } else {
    return item;
  }
}
