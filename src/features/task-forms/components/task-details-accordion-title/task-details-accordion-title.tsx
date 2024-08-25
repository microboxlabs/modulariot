import "server-only";
import { AccordionTitle } from "flowbite-react";

export default function TaskDetailsAccordionTitle({ title }: { title: string }) {
  return (
    <AccordionTitle theme={{
      base:  "flex w-full items-center justify-between px-5 py-4 text-left font-medium text-gray-500 last:rounded-b-lg dark:text-gray-400",
    }}>
      {title}
    </AccordionTitle>
  )
}