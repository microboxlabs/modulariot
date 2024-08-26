"use client";
import { Button, Dropdown, DropdownItem } from "flowbite-react";
import {
  HiOutlineArrowRight,
  HiOutlineArrowLeft,
  HiCheck,
  HiOutlineHand,
  HiTrash,
} from "react-icons/hi";
import { TaskActionsProps } from "./task-actions.types";
import VerticalDotsIcon from "@/features/icons/vertical-dots";
import TaskActionButton from "../task-action-button/task-action-button";
import { OUTCOME_NORMAL_INITIATION } from "../../services/form.service";
import TaskConfirmModal from "../task-confirm-modal/task-confirm-modal";
import {
  I18nRecord,
  PropsWithI18nDict,
} from "@/features/i18n/i18n.service.types";
import { useState } from "react";
import { TaskOutcome } from "../../services/form.service.types";

export default function TaskActions({
  taskId,
  taskType,
  dict,
}: PropsWithI18nDict<TaskActionsProps>) {
  const [openModal, setOpenModal] = useState(false);
  const [outcome, setOutcome] = useState<TaskOutcome | undefined>();
  const [outcomeLabel, setOutcomeLabel] = useState<string | undefined>();

  const handleSelection = (outcome: TaskOutcome, outcomeLabel: string) => {
    setOutcome(outcome);
    setOutcomeLabel(outcomeLabel);
    setOpenModal(true);
  };

  switch (taskType) {
    case "wfship:missionControlTripInitTask":
      return (
        <div className="flex gap-2">
          <TaskActionButton
            label={(dict.outcome as I18nRecord).normalInitiation as string}
            taskId={taskId}
            transitionId={OUTCOME_NORMAL_INITIATION}
            onClick={() =>
              handleSelection(
                OUTCOME_NORMAL_INITIATION,
                (dict.outcome as I18nRecord).normalInitiation as string,
              )
            }
          />
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
              {(dict.outcome as I18nRecord).initiationWithObjections as string}
            </DropdownItem>
            <DropdownItem className="flex gap-1">
              <HiOutlineHand />
              {(dict.outcome as I18nRecord).requiresOverlord as string}
            </DropdownItem>
            <DropdownItem className="flex gap-1">
              <HiOutlineArrowLeft />
              {(dict.outcome as I18nRecord).canceled as string}
            </DropdownItem>
            <DropdownItem className="flex gap-1">
              <HiTrash />
              {(dict.outcome as I18nRecord).annulled as string}
            </DropdownItem>
          </Dropdown>

          <TaskConfirmModal
            dict={dict}
            taskId={taskId}
            outcome={outcome!}
            outcomeLabel={outcomeLabel!}
            openModal={openModal}
            setOpenModal={setOpenModal}
          />
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
