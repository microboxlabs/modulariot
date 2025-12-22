import {
  Table,
  TableHead,
  TableBody,
  TableHeadCell,
  TableCell,
  TableRow,
} from "flowbite-react";
import React from "react";

type Style = {
  headClassName?: string;
  bodyClassName?: string;
  rootClassName?: string;
  containerClassName?: string;
  stripped?: boolean;
  innerScroll?: boolean;
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
    containerClassName: "flex-1 min-h-0 overflow-y-auto",
    stripped: true,
    innerScroll: true, // This allows the item to scroll only the body
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
        <TableRow key={`row-${index}`} className="bg-white dark:bg-gray-800">
          {getListOrElement(item, false)}
        </TableRow>
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
    <div className={` ${style.containerClassName}`}>
      <style>
        {`
          .row td {
        padding-top:10px;
        padding-bottom:10px;
        }

        .row td:first-child {
            padding-left:10px;
        }
        .row td:last-child {
            padding-right:10px;
        }
        `}
      </style>
      <Table
        striped={style.stripped}
        hoverable={hoverable}
        theme={{
          root: {
            base: `w-full text-left text-sm text-gray-500 dark:text-gray-400 ${style.rootClassName}`,
            shadow: "",
            wrapper: "relative",
          },
          head: {
            base: `group/head text-xs uppercase text-gray-700 dark:text-gray-400 ${style.innerScroll ? "sticky top-0 bottom-0" : ""} z-10`,
            cell: {
              base: `bg-gray-50 px-6 py-3 dark:bg-gray-700 py-2  ${style.innerScroll ? "sticky top-0" : ""} ${style.headClassName}`,
            },
          },
          body: {
            base: "group/body rounded-lg",
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
        <TableHead>
          <TableRow>{head}</TableRow>
        </TableHead>
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
          <TableCell key={`cell-${index}`} className="whitespace-nowrap">
            {cell}
          </TableCell>
        );
      }
    });
  } else {
    return item;
  }
}
