import "server-only";
import { Button, Dropdown, DropdownItem } from "flowbite-react";
import {
  HiOutlineArrowRight,
  HiOutlineArrowLeft,
  HiCheck,
  HiOutlineHand,
  HiTrash,
} from "react-icons/hi";
import { TaskActionsProps } from "./task-actions.types";
import { getDictionary } from "@/features/i18n/i18n.service";
import VerticalDotsIcon from "@/features/icons/vertical-dots";

export default async function TaskActions({
  taskType,
  lang,
}: TaskActionsProps) {
  const [dict] = await getDictionary(lang);
  switch (taskType) {
    case "wfship:missionControlTripInitTask":
      return (
        <div className="flex gap-2">
          <Button size="md" color="blue">
            {dict("pages.shippingDetailsTaskForm.output.normalInitiation")}
            <HiOutlineArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <Dropdown
            label={<VerticalDotsIcon />}
            arrowIcon={false}
            inline
            theme={{
              inlineWrapper:
                "cursor-pointer justify-center rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white",
            }}
          >
            <DropdownItem className="flex gap-1">
              <HiCheck />
              {dict(
                "pages.shippingDetailsTaskForm.output.initiationWithObjections",
              )}
            </DropdownItem>
            <DropdownItem className="flex gap-1">
              <HiOutlineHand />
              {dict("pages.shippingDetailsTaskForm.output.requiresOverlord")}
            </DropdownItem>
            <DropdownItem className="flex gap-1">
              <HiOutlineArrowLeft />
              {dict("pages.shippingDetailsTaskForm.output.canceled")}
            </DropdownItem>
            <DropdownItem className="flex gap-1">
              <HiTrash />
              {dict("pages.shippingDetailsTaskForm.output.annulled")}
            </DropdownItem>
          </Dropdown>
        </div>
      );
    default:
      return (
        <div className="">
          <Button size="md" color="blue">
            Choose plan
            <HiOutlineArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      );
  }
}
