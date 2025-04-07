"use client";

import { Button, Label, Modal, Select, Textarea } from "flowbite-react";
import {
  ErrorWithAlfrescoError,
  TaskConfirmModalProps,
} from "./task-confirm-modal.types";
import {
  I18nRecord,
  PropsWithI18nDict,
} from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { taskNextAction } from "../../services/client-form.service";
import { useRouter } from "next/navigation";
import KanbanMove from "@/features/icons/kanban-move";
import { ErrorAlert } from "../error-alert";
import {
  OUTCOME_REDIRECT_TO_MISSION_CONTROL,
  OUTCOME_RETURN_TO_TRANSPORT_VALIDATION,
} from "../../services/form.service";
import { useState } from "react";
export default function TaskConfirmModal({
  openModal,
  setOpenModal,
  outcome,
  outcomeLabel,
  taskId,
  taskType,
  dict,
  commentsFieldEnabled = false,
  extraData,
}: PropsWithI18nDict<TaskConfirmModalProps>) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<ErrorWithAlfrescoError | undefined>();
  const router = useRouter();
  const [comments, setComments] = useState("");
  const [reason, setReason] = useState(
    taskType === "wfship:sovosDigitalSignature" &&
      outcome === OUTCOME_REDIRECT_TO_MISSION_CONTROL
      ? "FINGERPRINT_DEVICES_TECH_ISSUES"
      : taskType === "wfship:missionControlTripInitTask" &&
          outcome === OUTCOME_REDIRECT_TO_MISSION_CONTROL
        ? "NO_GPS_VALIDATION"
        : "",
  );

  async function handleConfirm() {
    try {
      setIsProcessing(true);
      const formData = new FormData();
      formData.append("taskId", taskId);
      formData.append("transitionId", outcome!);
      formData.append("comments", comments);
      formData.append("reason", reason);
      formData.append("reasonId", taskType ?? "");
      if (extraData) {
        Object.entries(extraData).forEach(([key, value]) => {
          formData.append(key, value);
        });
      }
      const response = await taskNextAction({}, formData);
      if (response.success) {
        setIsProcessing(false);
        setOpenModal(false);
        router.push(`/shipping`);
        return;
      }
      setIsProcessing(false);
    } catch (error) {
      setIsProcessing(false);
      setError(error as ErrorWithAlfrescoError);
    }
  }

  async function onClose() {
    setIsProcessing(false);
    setError(undefined);
    setOpenModal(false);
  }

  return (
    <Modal dismissible show={openModal} onClose={onClose} size="4xl">
      <form onSubmit={handleConfirm}>
        <Modal.Header className="border-none">
          <div className="flex flex-col items-start">
            <h2 className="text-base font-semibold">
              {(dict.modal as I18nRecord).title as string}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {(dict.modal as I18nRecord).subtitle as string}
            </p>
          </div>
        </Modal.Header>
        <Modal.Body>
          <div className="flex flex-col">
            {taskType === "wfship:sovosDigitalSignature" &&
              outcome === OUTCOME_REDIRECT_TO_MISSION_CONTROL && (
                <>
                  <Label className="mt-4">
                    {(dict.modal as I18nRecord).title2 as string}
                  </Label>
                  <Select
                    /* className="w-full bg-white dark:bg-gray-800 rounded-md" */
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  >
                    <option value="FINGERPRINT_DEVICES_TECH_ISSUES">
                      {(dict.modal as I18nRecord).reason1 as string}
                    </option>
                    <option value="COMPUTER_TECH_ISSUES">
                      {(dict.modal as I18nRecord).reason2 as string}
                    </option>
                    <option value="DRIVER_FINGERPRINT_NOT_RECOGNIZED">
                      {(dict.modal as I18nRecord).reason3 as string}
                    </option>
                    <option value="DISPATCHER_NOT_ENROLLED">
                      {(dict.modal as I18nRecord).reason4 as string}
                    </option>
                    <option value="DISPATCHER_FINGERPRINT_NOT_RECOGNIZED">
                      {(dict.modal as I18nRecord).reason5 as string}
                    </option>
                    <option value="AUTHORIZED_BY_TRANSPORT_OVERLORD">
                      {(dict.modal as I18nRecord).reason6 as string}
                    </option>
                    <option value="OTHER">
                      {(dict.modal as I18nRecord).reason7 as string}
                    </option>
                  </Select>
                </>
              )}
            {taskType === "wfship:missionControlTripInitTask" &&
              outcome === OUTCOME_RETURN_TO_TRANSPORT_VALIDATION && (
                <>
                  <Label className="mt-4">
                    {(dict.modal as I18nRecord).title2 as string}
                  </Label>
                  <Select
                    /* className="w-full bg-white dark:bg-gray-800 rounded-md" */
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  >
                    <option value="NO_GPS_VALIDATION">
                      {
                        (dict.modal as I18nRecord)
                          .missionControlTripInitTaskReason1 as string
                      }
                    </option>
                    <option value="NO_DOCUMENT_CONSOLIDATION">
                      {
                        (dict.modal as I18nRecord)
                          .missionControlTripInitTaskReason2 as string
                      }
                    </option>
                    <option value="NO_CLIENT_SYSTEM_VALIDATION">
                      {
                        (dict.modal as I18nRecord)
                          .missionControlTripInitTaskReason3 as string
                      }
                    </option>
                    <option value="OTHER">
                      {
                        (dict.modal as I18nRecord)
                          .missionControlTripInitTaskReason4 as string
                      }
                    </option>
                  </Select>
                </>
              )}

            <div className="flex items-center justify-center mt-4">
              {!commentsFieldEnabled && <KanbanMove />}
            </div>
            {commentsFieldEnabled && (
              <div className="flex-1 flex flex-col gap-y-2">
                <Label htmlFor="comments">{tr("modal.reason", dict)}:</Label>
                <Textarea
                  id="comments"
                  name="comments"
                  required
                  rows={8}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                />
              </div>
            )}
          </div>
          <div className="mt-4 px-6 space-y-2">
            {error && <ErrorAlert error={error} />}
          </div>
        </Modal.Body>
        <Modal.Footer className=" border-none">
          <Button
            className="ml-auto mt-[-41px]"
            isProcessing={isProcessing}
            color="blue"
            onClick={handleConfirm}
          >
            {tr("modal.confirm", dict, { outcome: outcomeLabel ?? "outcome" })}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
