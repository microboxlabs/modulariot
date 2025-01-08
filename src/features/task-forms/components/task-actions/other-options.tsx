import { Dropdown, DropdownItem } from "flowbite-react";

export default function OtherOptions() {
  return <Dropdown
    label="Otras opciones"
    arrowIcon={false}
    className="flex gap-1 "
    inline
    theme={{
      inlineWrapper:
        "h-5 w-full sm:w-1/2 cursor-pointer justify-center rounded px-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700",
    }}
  >
    <DropdownItem
      className="flex gap-1"
      onClick={() => {
        handleSelection(
          OUTCOME_INITIATED_WITHOUT_SOVOS_SIGNATURE,
          (dict.outcome as I18nRecord)
            .initiatedWithoutSovosSignature as string,
        );
      }}
    >
      <HiCheck />
      {
        (dict.outcome as I18nRecord)
          .initiatedWithoutSovosSignature as string
      }
    </DropdownItem>
    <DropdownItem
      className="flex gap-1"
      onClick={() => {
        handleSelection(
          OUTCOME_INITIATION_WITH_OBJECTIONS,
          (dict.outcome as I18nRecord)
            .initiationWithObjections as string,
        );
      }}
    >
      <HiCheck />
      {(dict.outcome as I18nRecord).initiationWithObjections as string}
    </DropdownItem>
    <DropdownItem
      className="flex gap-1"
      onClick={() => {
        handleSelection(
          OUTCOME_OVERLORD_REQUIRED,
          (dict.outcome as I18nRecord).requiresOverlord as string,
        );
      }}
    >
      <HiOutlineHand />
      {(dict.outcome as I18nRecord).requiresOverlord as string}
    </DropdownItem>
    <DropdownItem
      className="flex gap-1"
      onClick={() => {
        handleSelection(
          OUTCOME_CANCELED,
          (dict.outcome as I18nRecord).canceled as string,
        );
      }}
    >
      <HiOutlineArrowLeft />
      {(dict.outcome as I18nRecord).canceled as string}
    </DropdownItem>
    <DropdownItem
      className="flex gap-1"
      onClick={() => {
        handleSelection(
          OUTCOME_ANNULLED,
          (dict.outcome as I18nRecord).annulled as string,
        );
      }}
    >
      <HiTrash />
      {(dict.outcome as I18nRecord).annulled as string}
    </DropdownItem>
  </Dropdown>
