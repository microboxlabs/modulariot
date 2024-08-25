import "server-only";
import { AccordionTitle } from "flowbite-react";

export default function TaskDetailsAccordionTitle({
  title,
}: {
  title: string;
}) {
  return (
    <AccordionTitle
      theme={{
        base: "flex w-full items-center justify-between px-5 py-4 text-left font-medium text-blue-600 last:rounded-b-lg dark:text-gray-400",
        open: {
          on: "bg-gray-100 text-blue-600 dark:bg-gray-800 dark:text-white",
        },
      }}
    >
      {title}
    </AccordionTitle>
  );
}
