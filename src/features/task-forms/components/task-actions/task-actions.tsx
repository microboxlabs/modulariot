"use client";
import { Button } from "flowbite-react";
import { HiOutlineArrowRight } from "react-icons/hi";
import { TaskActionsProps } from "./task-actions.types";
import TaskActionButton from "../task-action-button/task-action-button";
import {
  OUTCOME_CONFIRM_ARRIVAL_TO_DESTINATION,
  OUTCOME_CONFIRM_DELIVERY,
  OUTCOME_CONFIRM_DEPARTURE_TO_DESTINATION,
  OUTCOME_MONITORING_FINALIZATION,
  OUTCOME_NORMAL_INITIATION,
  TYPE_WFSHIP_CONFIRM_DELIVERY,
  TYPE_WFSHIP_CONFIRM_TRIP_DESTINATION_ARRIVAL,
  TYPE_WFSHIP_CONFIRM_TRIP_DESTINATION_DEPARTURE,
  TYPE_WFSHIP_MONITORING_IN_COURSE_TRIP,
} from "../../services/form.service";
import TaskConfirmModal from "../task-confirm-modal/task-confirm-modal";
import {
  I18nRecord,
  PropsWithI18nDict,
} from "@/features/i18n/i18n.service.types";
import { useState } from "react";
import { TaskOutcome } from "../../services/form.service.types";
import OtherOptions from "./other-options";
import CanceledAnnulledOptions from "./canceled-annulled-options";

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
    return (
      outcome !== OUTCOME_NORMAL_INITIATION &&
      outcome !== OUTCOME_CONFIRM_ARRIVAL_TO_DESTINATION &&
      outcome !== OUTCOME_CONFIRM_DEPARTURE_TO_DESTINATION &&
      outcome !== OUTCOME_CONFIRM_DELIVERY &&
      outcome !== OUTCOME_MONITORING_FINALIZATION
    );
  };

  switch (taskType) {
    case "wfship:missionControlTripInitTask":
      return (
        <div className="flex flex-col-reverse lg:flex-row w-full gap-2 items-center">
          <Button.Group className="w-full">
            <OtherOptions dict={dict} handleSelection={handleSelection} />
            <TaskActionButton
              fluid={fluid}
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
    case TYPE_WFSHIP_MONITORING_IN_COURSE_TRIP:
      return (
        <div className="flex flex-col-reverse lg:flex-row w-full gap-2 items-center">
          <Button.Group className="w-full">
            <CanceledAnnulledOptions
              dict={dict}
              handleSelection={handleSelection}
            />
            <TaskActionButton
              fluid={fluid}
              label={
                (dict.outcome as I18nRecord)
                  .confirmTripDestinationArrival as string
              }
              taskId={taskId}
              transitionId={OUTCOME_CONFIRM_ARRIVAL_TO_DESTINATION}
              onClick={() =>
                handleSelection(
                  OUTCOME_CONFIRM_ARRIVAL_TO_DESTINATION,
                  (dict.outcome as I18nRecord)
                    .confirmTripDestinationArrival as string,
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

    case TYPE_WFSHIP_CONFIRM_TRIP_DESTINATION_ARRIVAL:
      return (
        <div className="flex flex-col-reverse lg:flex-row w-full gap-2 items-center">
          <Button.Group className="w-full">
            <CanceledAnnulledOptions
              dict={dict}
              handleSelection={handleSelection}
            />
            <TaskActionButton
              fluid={fluid}
              label={
                (dict.outcome as I18nRecord)
                  .confirmTripDestinationDeparture as string
              }
              taskId={taskId}
              transitionId={OUTCOME_CONFIRM_DELIVERY}
              onClick={() =>
                handleSelection(
                  OUTCOME_CONFIRM_DELIVERY,
                  (dict.outcome as I18nRecord)
                    .confirmTripDestinationDeparture as string,
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
    case TYPE_WFSHIP_CONFIRM_TRIP_DESTINATION_DEPARTURE:
      return (
        <div className="flex flex-col-reverse lg:flex-row w-full gap-2 items-center">
          <Button.Group className="w-full">
            <CanceledAnnulledOptions
              dict={dict}
              handleSelection={handleSelection}
            />
            <TaskActionButton
              fluid={fluid}
              label={(dict.outcome as I18nRecord).confirmDelivery as string}
              taskId={taskId}
              transitionId={OUTCOME_CONFIRM_DEPARTURE_TO_DESTINATION}
              onClick={() =>
                handleSelection(
                  OUTCOME_CONFIRM_DEPARTURE_TO_DESTINATION,
                  (dict.outcome as I18nRecord).confirmDelivery as string,
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
    case TYPE_WFSHIP_CONFIRM_DELIVERY:
      return (
        <div className="flex flex-col-reverse lg:flex-row w-full gap-2 items-center">
          <Button.Group className="w-full">
            <CanceledAnnulledOptions
              dict={dict}
              handleSelection={handleSelection}
            />
            <TaskActionButton
              fluid={fluid}
              label={
                (dict.outcome as I18nRecord).monitoringFinalization as string
              }
              taskId={taskId}
              transitionId={OUTCOME_MONITORING_FINALIZATION}
              onClick={() =>
                handleSelection(
                  OUTCOME_MONITORING_FINALIZATION,
                  (dict.outcome as I18nRecord).monitoringFinalization as string,
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
