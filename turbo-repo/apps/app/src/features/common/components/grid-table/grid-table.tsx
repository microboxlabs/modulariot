import React from "react";

type Style = {
  gridTemplateColumns?: string;
  minWidth?: string;
};

export default function GridTable({
  header,
  content,
  style: { gridTemplateColumns, minWidth } = {},
}: {
  header: string[] | React.ReactElement[];
  content: string[] | React.ReactElement[];
  style: Style;
}) {
  const columnsCount = header.length;
  const fixed_header = list_or_element(
    header,
    gridTemplateColumns || "",
    columnsCount,
    true
  );
  const fixed_content = list_or_element(
    content,
    gridTemplateColumns || "",
    columnsCount,
    false
  );

  return (
    <div
      className="grid gap-y-2 overflow-x-auto"
      style={{
        gridTemplateColumns:
          gridTemplateColumns || `repeat(${columnsCount}, 1fr)`,
        minWidth,
      }}
    >
      {/* header */}
      {fixed_header}

      {/*fixed_content*/}
      {fixed_content}
    </div>
  );
}

function list_or_element(
  list_or_element: string[] | React.ReactElement[],
  gridTemplateColumns: string,
  columnsCount: number,
  header = false
) {
  if (list_or_element instanceof Array) {
    if (header) {
      return list_or_element.map((item, index) => {
        if (item instanceof Object) return item;

        return (
          <div
            className={`font-medium text-gray-700 dark:text-gray-200 bg-gray-transparent dark:bg-gray-transparent pt-2 px-4 ${index === 0 ? "rounded-l-lg" : index === list_or_element.length - 1 ? "rounded-r-lg" : ""}`}
            key={index}
          >
            {item}
          </div>
        );
      });
    }

    return list_or_element.map((item, index) => {
      if (item instanceof Object) {
        // If it's a React element (like TaskListElement), render it directly
        // The element should return the correct number of grid items
        return <React.Fragment key={index}>{item}</React.Fragment>;
      } else {
        // If it's a string, wrap it in a single grid item
        return (
          <div
            className="py-2 px-4 bg-gray-200 dark:bg-gray-800 hover:bg-blue-300 dark:hover:bg-blue-900 ring-0 ring-blue-500 active:ring-2 rounded-lg transition-all duration-200 cursor-pointer"
            key={index}
          >
            <p className="text-lg whitespace-nowrap">{item}</p>
          </div>
        );
      }
    });
  } else {
    return <React.Fragment>{list_or_element}</React.Fragment>;
  }
}
