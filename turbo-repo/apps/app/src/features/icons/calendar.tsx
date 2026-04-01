import { ComponentProps } from "react";
import { HiOutlineCalendar } from "react-icons/hi";

export default function CalendarIcon(props: Readonly<ComponentProps<"svg">>) {
  return (
    <HiOutlineCalendar className="w-5 h-5 text-gray-800 dark:text-white" {...props} />
  );
}
