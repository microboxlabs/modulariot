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
import {
  OUTCOME_ANNULLED,
  OUTCOME_CANCELED,
  OUTCOME_INITIATION_WITH_OBJECTIONS,
  OUTCOME_NORMAL_INITIATION,
  OUTCOME_OVERLORD_REQUIRED,
  OUTCOME_INITIATED_WITHOUT_SOVOS_SIGNATURE,
} from "../../services/form.service";
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

  const isCommentsFieldEnabled = (outcome: TaskOutcome) => {
    return outcome !== OUTCOME_NORMAL_INITIATION;
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
            className="flex gap-1"
            inline
            theme={{
              inlineWrapper:
                "cursor-pointer justify-center rounded px-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white",
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

          <TaskConfirmModal
            commentsFieldEnabled={isCommentsFieldEnabled(outcome!)}
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
