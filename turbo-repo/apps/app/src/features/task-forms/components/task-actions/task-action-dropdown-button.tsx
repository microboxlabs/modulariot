import { Button } from "flowbite-react";
import { HiChevronUp } from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import TaskActionButton from "../task-action-button/task-action-button";

interface TaskActionDropdownButtonProps {
  isOpen: boolean;
  dict: I18nRecord;
  labelKey?: string;
}

export function TaskActionDropdownButton({
  isOpen,
  dict,
  labelKey = "outcome.moreOptions",
}: TaskActionDropdownButtonProps) {
  return (
    // <Button
    //   color="alternative"
    //   theme={{
    //     base: twMerge(
    //       "relative",
    //       "flex items-center justify-center",
    //       "!rounded-lg !rounded-r-none !border-l-1",
    //       "text-center font-medium",
    //       "focus:outline-none focus:ring-4",
    //       "cursor-pointer",
    //       "h-10 transition-all duration-100 z-20",
    //       "gap-2 w-fit"
    //     ),
    //   }}
    // >
    //   <div className="flex items-center gap-2">
    //     <span className="lg:block hidden whitespace-nowrap">
    //       {tr(labelKey, dict)}
    //     </span>
    //     <HiChevronUp
    //       className={`w-5 h-5 transition-transform ease-in-out duration-300 ${isOpen ? "rotate-180" : ""}`}
    //     />
    //   </div>
    // </Button>
    <TaskActionButton label="pepe2" taskId="1" onClick={() => {}} />
  );
}
