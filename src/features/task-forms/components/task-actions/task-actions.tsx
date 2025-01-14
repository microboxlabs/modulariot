"use client";
import { Button } from "flowbite-react";
import { HiOutlineArrowRight } from "react-icons/hi";
import { TaskActionsProps } from "./task-actions.types";
import TaskActionButton from "../task-action-button/task-action-button";
import {
  OUTCOME_INITIATED_WITHOUT_SOVOS_SIGNATURE,
  OUTCOME_NORMAL_INITIATION,
} from "../../services/form.service";
import TaskConfirmModal from "../task-confirm-modal/task-confirm-modal";
import {
  I18nRecord,
  PropsWithI18nDict,
} from "@/features/i18n/i18n.service.types";
import { useState } from "react";
import { TaskOutcome } from "../../services/form.service.types";
import OtherOptions from "./other-options";

export default function TaskActions({
  taskId,
  taskType,
  dict,
  fluid = false,
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
        <div className="flex flex-col-reverse lg:flex-row w-full gap-2 items-center">
          <Button.Group className="w-full">
            <OtherOptions dict={dict} handleSelection={handleSelection} />
            <TaskActionButton
              fluid={fluid}
              label={
                (dict.outcome as I18nRecord)
                  .initiatedWithoutSovosSignature as string
              }
              taskId={taskId}
              transitionId={OUTCOME_INITIATED_WITHOUT_SOVOS_SIGNATURE}
              onClick={() =>
                handleSelection(
                  OUTCOME_INITIATED_WITHOUT_SOVOS_SIGNATURE,
                  (dict.outcome as I18nRecord)
                    .initiatedWithoutSovosSignature as string,
                )
              }
            />
          </Button.Group>

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
