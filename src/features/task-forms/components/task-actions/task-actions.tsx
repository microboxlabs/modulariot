"use client";
import { Button } from "flowbite-react";
import {
  HiOutlineArrowLeft,
  HiTrash,
  HiOutlineArrowRight,
  HiCheck,
} from "react-icons/hi";
import { TaskActionsProps } from "./task-actions.types";
import TaskActionButton from "../task-action-button/task-action-button";
import {
  OUTCOME_CONFIRM_ARRIVAL_TO_DESTINATION,
  OUTCOME_CONFIRM_DELIVERY,
  OUTCOME_CONFIRM_DEPARTURE_TO_DESTINATION,
  OUTCOME_MONITORING_FINALIZATION,
  OUTCOME_NORMAL_INITIATION,
  OUTCOME_CONFIRM_MONITORING_FINALIZATION,
  OUTCOME_REDIRECT_TO_MISSION_CONTROL,
  TYPE_WFSHIP_CONFIRM_DELIVERY,
  TYPE_WFSHIP_CONFIRM_TRIP_DESTINATION_ARRIVAL,
  TYPE_WFSHIP_CONFIRM_TRIP_DESTINATION_DEPARTURE,
  TYPE_WFSHIP_MONITORING_IN_COURSE_TRIP,
  TYPE_WFSHIP_CONFIRM_MONITORING_FINALIZATION,
  TYPE_WFSHIP_OVERLORD_TRIP_INIT_TASK,
  OUTCOME_OVERLORD_AUTHORIZED_WITHOUT_GPS,
  OUTCOME_OVERLORD_CANCELED,
  OUTCOME_OVERLORD_ANULLED,
  OUTCOME_OVERLORD_AUTHORIZED_WITH_REPAIRS,
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
import CanceledAnnulledEndOptions from "./canceled-annulled-end-options";
import CanceledAnnulledAndOptions from "./canceled-annulled-and-options";
import { GroupAllowed } from "@/features/common/components/group-allowed/group-allowed";
import { useUserGroups } from "@/features/common/providers/client-api.provider";
export default function TaskActions({
  taskId,
  taskType,
  dict,
  fluid = false,
  extraData,
}: PropsWithI18nDict<TaskActionsProps>) {
  const [openModal, setOpenModal] = useState(false);
  const [outcome, setOutcome] = useState<TaskOutcome | undefined>();
  const [outcomeLabel, setOutcomeLabel] = useState<string | undefined>();
  const { data: userGroups } = useUserGroups();

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
      outcome !== OUTCOME_MONITORING_FINALIZATION &&
      outcome !== OUTCOME_CONFIRM_MONITORING_FINALIZATION &&
      outcome !== OUTCOME_REDIRECT_TO_MISSION_CONTROL &&
      outcome !== OUTCOME_OVERLORD_AUTHORIZED_WITH_REPAIRS
    );
  };

  switch (taskType) {
    case "wfship:missionControlTripInitTask":
      return (
        <div className="flex flex-col-reverse lg:flex-row w-full gap-2 items-center">
          <GroupAllowed
            notAllowedTo={["GROUP_MINTRAL_REVISOR"]}
            userGroups={userGroups}
          >
            <Button.Group className="w-full">
              <OtherOptions dict={dict} handleSelection={handleSelection} />
              <TaskActionButton
                fluid={fluid}
                label={(dict.outcome as I18nRecord).continue as string}
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
              taskType={taskType}
              outcome={outcome!}
              outcomeLabel={outcomeLabel!}
              openModal={openModal}
              setOpenModal={setOpenModal}
              extraData={extraData}
            />
          </GroupAllowed>
        </div>
      );
    case TYPE_WFSHIP_OVERLORD_TRIP_INIT_TASK:
      return (
        <div className="flex flex-col-reverse lg:flex-row w-full gap-2 items-center">
          <GroupAllowed
            notAllowedTo={["GROUP_MINTRAL_REVISOR"]}
            userGroups={userGroups}
          >
            <Button.Group className="w-full">
              <CanceledAnnulledAndOptions
                dict={dict}
                handleSelection={handleSelection}
                otherOptions={[
                  {
                    id: OUTCOME_REDIRECT_TO_MISSION_CONTROL,
                    label: (dict.outcome as I18nRecord)
                      .redirectToMissionControl as string,
                    icon: HiOutlineArrowRight,
                  },
                  {
                    id: OUTCOME_OVERLORD_AUTHORIZED_WITHOUT_GPS, //OUTCOME_OVERLORD_AUTHORIZED_WITH_REPAIRS,
                    label: (dict.outcome as I18nRecord)
                      .authorizedWithoutGPS as string, //.authorizedWithRepairs as string,
                    icon: HiCheck,
                  },
                  {
                    id: OUTCOME_OVERLORD_CANCELED,
                    label: (dict.outcome as I18nRecord).canceled as string,
                    icon: HiOutlineArrowLeft,
                  },
                  {
                    id: OUTCOME_OVERLORD_ANULLED,
                    label: (dict.outcome as I18nRecord).annulled as string,
                    icon: HiTrash,
                  },
                ]}
              />
              <TaskActionButton
                fluid={fluid}
                label={(dict.outcome as I18nRecord).continue as string}
                taskId={taskId}
                transitionId={OUTCOME_OVERLORD_AUTHORIZED_WITH_REPAIRS}
                onClick={() =>
                  handleSelection(
                    OUTCOME_OVERLORD_AUTHORIZED_WITH_REPAIRS,
                    (dict.outcome as I18nRecord)
                      .authorizedWithRepairs as string,
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
          </GroupAllowed>
        </div>
      );

    case TYPE_WFSHIP_MONITORING_IN_COURSE_TRIP:
      return (
        <div className="flex flex-col-reverse lg:flex-row w-full gap-2 items-center">
          <GroupAllowed
            notAllowedTo={["GROUP_MINTRAL_REVISOR"]}
            userGroups={userGroups}
          >
            <Button.Group className="w-full">
              <CanceledAnnulledOptions
                dict={dict}
                handleSelection={handleSelection}
              />
              <TaskActionButton
                fluid={fluid}
                label={(dict.outcome as I18nRecord).continue as string}
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
          </GroupAllowed>
        </div>
      );

    case TYPE_WFSHIP_CONFIRM_TRIP_DESTINATION_ARRIVAL:
      return (
        <div className="flex flex-col-reverse lg:flex-row w-full gap-2 items-center">
          <GroupAllowed
            notAllowedTo={["GROUP_MINTRAL_REVISOR"]}
            userGroups={userGroups}
          >
            <Button.Group className="w-full">
              <CanceledAnnulledEndOptions
                dict={dict}
                handleSelection={handleSelection}
              />
              <TaskActionButton
                fluid={fluid}
                label={(dict.outcome as I18nRecord).continue as string}
                taskId={taskId}
                transitionId={OUTCOME_CONFIRM_DELIVERY}
                onClick={() =>
                  handleSelection(
                    OUTCOME_CONFIRM_DELIVERY,
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
          </GroupAllowed>
        </div>
      );
    case TYPE_WFSHIP_CONFIRM_DELIVERY:
      return (
        <div className="flex flex-col-reverse lg:flex-row w-full gap-2 items-center">
          <GroupAllowed
            notAllowedTo={["GROUP_MINTRAL_REVISOR"]}
            userGroups={userGroups}
          >
            <Button.Group className="w-full">
              <CanceledAnnulledEndOptions
                dict={dict}
                handleSelection={handleSelection}
              />
              <TaskActionButton
                fluid={fluid}
                label={(dict.outcome as I18nRecord).continue as string}
                taskId={taskId}
                transitionId={OUTCOME_CONFIRM_DEPARTURE_TO_DESTINATION}
                onClick={() =>
                  handleSelection(
                    OUTCOME_CONFIRM_DEPARTURE_TO_DESTINATION,
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
          </GroupAllowed>
        </div>
      );
    case TYPE_WFSHIP_CONFIRM_TRIP_DESTINATION_DEPARTURE:
      return (
        <div className="flex flex-col-reverse lg:flex-row w-full gap-2 items-center">
          <GroupAllowed
            notAllowedTo={["GROUP_MINTRAL_REVISOR"]}
            userGroups={userGroups}
          >
            <Button.Group className="w-full">
              <CanceledAnnulledOptions
                dict={dict}
                handleSelection={handleSelection}
              />
              <TaskActionButton
                fluid={fluid}
                label={(dict.outcome as I18nRecord).continue as string}
                taskId={taskId}
                transitionId={OUTCOME_CONFIRM_MONITORING_FINALIZATION}
                onClick={() =>
                  handleSelection(
                    OUTCOME_CONFIRM_MONITORING_FINALIZATION,
                    (dict.outcome as I18nRecord)
                      .confirmMonitoringFinalization as string,
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
          </GroupAllowed>
        </div>
      );
    case TYPE_WFSHIP_CONFIRM_MONITORING_FINALIZATION:
      return (
        <div className="flex flex-col-reverse lg:flex-row w-full gap-2 items-center">
          <GroupAllowed
            notAllowedTo={["GROUP_MINTRAL_REVISOR"]}
            userGroups={userGroups}
          >
            <Button.Group className="w-full">
              <CanceledAnnulledOptions
                dict={dict}
                handleSelection={handleSelection}
              />
              <TaskActionButton
                fluid={fluid}
                label={(dict.outcome as I18nRecord).continue as string}
                taskId={taskId}
                transitionId={OUTCOME_MONITORING_FINALIZATION}
                onClick={() =>
                  handleSelection(
                    OUTCOME_MONITORING_FINALIZATION,
                    (dict.outcome as I18nRecord)
                      .monitoringFinalization as string,
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
          </GroupAllowed>
        </div>
      );
    default:
      return null;
  }
}
