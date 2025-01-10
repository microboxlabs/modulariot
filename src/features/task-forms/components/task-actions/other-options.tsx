import { Dropdown, DropdownItem } from "flowbite-react";
import {
  HiCheck,
  HiOutlineHand,
  HiOutlineArrowLeft,
  HiTrash,
} from "react-icons/hi";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import {
  OUTCOME_NORMAL_INITIATION,
  OUTCOME_INITIATION_WITH_OBJECTIONS,
  OUTCOME_OVERLORD_REQUIRED,
  OUTCOME_CANCELED,
  OUTCOME_ANNULLED,
} from "../../services/form.service";
import { OtherOptionsProps } from "./other-options.types";

export default function OtherOptions({
  dict,
  handleSelection,
}: OtherOptionsProps) {
  const other_options = [
    {
      id: OUTCOME_NORMAL_INITIATION,
      label: (dict.outcome as I18nRecord).normalInitiation as string,
      icon: HiCheck,
    },
    // This was commented since its something that might change in the future
    /*
    {
      id: OUTCOME_INITIATED_WITHOUT_SOVOS_SIGNATURE,
      label: (dict.outcome as I18nRecord)
        .initiatedWithoutSovosSignature as string,
      icon: HiCheck,
    },
    */
    {
      id: OUTCOME_INITIATION_WITH_OBJECTIONS,
      label: (dict.outcome as I18nRecord).initiationWithObjections as string,
      icon: HiCheck,
    },
    {
      id: OUTCOME_OVERLORD_REQUIRED,
      label: (dict.outcome as I18nRecord).requiresOverlord as string,
      icon: HiOutlineHand,
    },
    {
      id: OUTCOME_CANCELED,
      label: (dict.outcome as I18nRecord).canceled as string,
      icon: HiOutlineArrowLeft,
    },
    {
      id: OUTCOME_ANNULLED,
      label: (dict.outcome as I18nRecord).annulled as string,
      icon: HiTrash,
    },
  ];

  return (
    <Dropdown
      size="md"
      label="Otras opciones"
      className="flex gap-1 "
      inline
      theme={{
        inlineWrapper:
          "flex flex-row-reverse items-center justify-center h-10 w-full lg:w-1/2 cursor-pointer rounded px-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700",
        content: "w-full py-1",
        arrowIcon: "mr-2 h-5 w-5",
      }}
    >
      {other_options.map(({ id, label, icon: Icon }) => (
        <DropdownItem
          key={id}
          className="flex gap-1 w-full"
          onClick={() => handleSelection(id, label)}
        >
          <Icon />
          {label}
        </DropdownItem>
      ))}
    </Dropdown>
  );
}
