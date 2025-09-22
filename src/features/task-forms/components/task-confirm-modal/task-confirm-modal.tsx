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
import BrandedMultiSelect from "./branded-multi-select";
import {
  OUTCOME_ASSIGN_DRIVER_V2,
  OUTCOME_OVERLORD_CANCELED_SOVOS_V2,
  OUTCOME_OVERLORD_REQUIRED_V2,
  OUTCOME_PREPARE_SERVICE_V2,
  OUTCOME_PRESENT_DRIVER_V2,
  OUTCOME_REDIRECT_TO_MISSION_CONTROL,
  OUTCOME_RETURN_TO_TRANSPORT_VALIDATION,
  SHIPPING_COORDINATOR_PROCESS_TASKS_V2,
  TYPE_WFDELIVERY_CONFIRM_DELIVERY_TASK,
  TYPE_WFSHIP2_MISSION_CONTROL_TASK,
} from "../../services/form.service";
import { useState, useMemo, useEffect } from "react";
import { ShippingCoordinatorProcessTaskV2 } from "../../services/form.service.types";

// Configuration for select options based on task type and outcome
type SelectOption = {
  value: string;
  labelKey: string;
  descriptionKey?: string; // Optional: supporting text key for branded multi-select
};

type SelectConfig = {
  options: SelectOption[];
  defaultValue: string | string[];
  multiSelect?: boolean; // Flag to enable multi-select mode
  triggerText?: string; // Text shown in collapsed multi-select state
};

type SelectOptionsConfig = {
  [taskType: string]: {
    [outcome: string]: SelectConfig;
  };
};

const SELECT_OPTIONS_CONFIG: SelectOptionsConfig = {
  [TYPE_WFDELIVERY_CONFIRM_DELIVERY_TASK]: {
    [OUTCOME_OVERLORD_CANCELED_SOVOS_V2]: {
      options: [
        { value: "NOT_VALID_DOCUMENT", labelKey: "PODReason1" },
        { value: "ID_RECEPTOR_MISSING", labelKey: "PODReason2" },
        { value: "INCOMPLETE_POD", labelKey: "PODReason3" },
        { value: "OTHER", labelKey: "PODReason4" },
      ],
      defaultValue: "NOT_VALID_DOCUMENT",
    },
  },
  "wfship:sovosDigitalSignature": {
    [OUTCOME_REDIRECT_TO_MISSION_CONTROL]: {
      options: [
        { value: "FINGERPRINT_DEVICES_TECH_ISSUES", labelKey: "reason1" },
        { value: "COMPUTER_TECH_ISSUES", labelKey: "reason2" },
        { value: "DRIVER_FINGERPRINT_NOT_RECOGNIZED", labelKey: "reason3" },
        { value: "DISPATCHER_NOT_ENROLLED", labelKey: "reason4" },
        { value: "DISPATCHER_FINGERPRINT_NOT_RECOGNIZED", labelKey: "reason5" },
        { value: "AUTHORIZED_BY_TRANSPORT_OVERLORD", labelKey: "reason6" },
        { value: "OTHER", labelKey: "reason7" },
      ],
      defaultValue: "FINGERPRINT_DEVICES_TECH_ISSUES",
    },
  },
  "wfship:missionControlTripInitTask": {
    [OUTCOME_RETURN_TO_TRANSPORT_VALIDATION]: {
      options: [
        {
          value: "NO_GPS_VALIDATION",
          labelKey: "missionControlTripInitTaskReason1",
        },
        {
          value: "NO_DOCUMENT_CONSOLIDATION",
          labelKey: "missionControlTripInitTaskReason2",
        },
        {
          value: "NO_CLIENT_SYSTEM_VALIDATION",
          labelKey: "missionControlTripInitTaskReason3",
        },
        { value: "OTHER", labelKey: "missionControlTripInitTaskReason4" },
      ],
      defaultValue: "NO_GPS_VALIDATION",
    },
  },
  [TYPE_WFSHIP2_MISSION_CONTROL_TASK]: {
    [OUTCOME_ASSIGN_DRIVER_V2]: {
      options: [
        {
          value: "NO_GPS_VALIDATION",
          labelKey: "missionControlTripInitTaskReason1",
        },
        {
          value: "NO_DOCUMENT_CONSOLIDATION",
          labelKey: "missionControlTripInitTaskReason2",
        },
        {
          value: "NO_CLIENT_SYSTEM_VALIDATION",
          labelKey: "missionControlTripInitTaskReason3",
        },
        { value: "OTHER", labelKey: "missionControlTripInitTaskReason4" },
      ],
      defaultValue: "NO_GPS_VALIDATION",
    },
    [OUTCOME_PRESENT_DRIVER_V2]: {
      options: [
        {
          value: "NO_GPS_VALIDATION",
          labelKey: "missionControlTripInitTaskReason1",
        },
        {
          value: "NO_DOCUMENT_CONSOLIDATION",
          labelKey: "missionControlTripInitTaskReason2",
        },
        {
          value: "NO_CLIENT_SYSTEM_VALIDATION",
          labelKey: "missionControlTripInitTaskReason3",
        },
        { value: "OTHER", labelKey: "missionControlTripInitTaskReason4" },
      ],
      defaultValue: "NO_GPS_VALIDATION",
    },
    [OUTCOME_OVERLORD_REQUIRED_V2]: {
      options: [
        {
          value: "NO_GPS_VALIDATION",
          labelKey: "missionControlTripInitTaskReason1",
        },
        {
          value: "NO_DOCUMENT_CONSOLIDATION",
          labelKey: "missionControlTripInitTaskReason2",
        },
        {
          value: "NO_CLIENT_SYSTEM_VALIDATION",
          labelKey: "missionControlTripInitTaskReason3",
        },
        { value: "OTHER", labelKey: "missionControlTripInitTaskReason4" },
      ],
      defaultValue: "NO_GPS_VALIDATION",
    },
    [OUTCOME_PREPARE_SERVICE_V2]: {
      multiSelect: true,
      triggerText: "Seleccionar motivos de rechazo",
      options: [
        // Image rejection reasons
        {
          value: "REJECTED_GUIDE",
          labelKey: "rejectedGuide",
          descriptionKey: "rejectedGuideDesc",
        },
        {
          value: "REJECTED_LEFT_SIDE",
          labelKey: "rejectedLeftSide",
          descriptionKey: "rejectedLeftSideDesc",
        },
        {
          value: "REJECTED_RIGHT_SIDE",
          labelKey: "rejectedRightSide",
          descriptionKey: "rejectedRightSideDesc",
        },
        {
          value: "REJECTED_FRONT",
          labelKey: "rejectedFront",
          descriptionKey: "rejectedFrontDesc",
        },
        {
          value: "REJECTED_BACK",
          labelKey: "rejectedBack",
          descriptionKey: "rejectedBackDesc",
        },
        // Technical reasons
        {
          value: "NO_GPS_VALIDATION",
          labelKey: "missionControlTripInitTaskReason1",
          descriptionKey: "noGpsValidationDesc",
        },
        {
          value: "NO_DOCUMENT_CONSOLIDATION",
          labelKey: "missionControlTripInitTaskReason2",
          descriptionKey: "noDocumentConsolidationDesc",
        },
        {
          value: "NO_CLIENT_SYSTEM_VALIDATION",
          labelKey: "missionControlTripInitTaskReason3",
          descriptionKey: "noClientSystemValidationDesc",
        },
        {
          value: "OTHER",
          labelKey: "missionControlTripInitTaskReason4",
          descriptionKey: "otherReasonDesc",
        },
      ],
      defaultValue: [],
    },
  },
};

// Utility function to get select configuration
function getSelectConfig(
  taskType?: string,
  outcome?: string
): SelectConfig | null {
  if (!taskType || !outcome) return null;
  return SELECT_OPTIONS_CONFIG[taskType]?.[outcome] || null;
}
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

  // Get select configuration based on current task type and outcome
  const selectConfig = useMemo(() => {
    return getSelectConfig(taskType, outcome);
  }, [taskType, outcome]);

  // Initialize reason state - can be string for single-select or string[] for multi-select
  const [reason, setReason] = useState<string | string[]>("");
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);

  // Update reason when selectConfig changes or modal opens
  useEffect(() => {
    if (openModal && selectConfig) {
      if (selectConfig.multiSelect) {
        // Multi-select mode: initialize selectedReasons array
        if (
          selectedReasons.length === 0 &&
          Array.isArray(selectConfig.defaultValue)
        ) {
          setSelectedReasons(selectConfig.defaultValue);
        }
      } else {
        // Single-select mode: initialize reason string
        if (!reason && typeof selectConfig.defaultValue === "string") {
          setReason(selectConfig.defaultValue);
        }
      }
    }
  }, [openModal, selectConfig, reason, selectedReasons]);

  async function handleConfirm() {
    try {
      setIsProcessing(true);
      const formData = new FormData();
      formData.append("taskId", taskId);
      formData.append("transitionId", outcome!);
      formData.append("comments", comments);
      formData.append("reasonId", taskType ?? "");

      // Handle both single and multi-select reasons
      if (selectConfig?.multiSelect) {
        // Multi-select mode: send array of reasons
        const defaultReasons = Array.isArray(selectConfig.defaultValue)
          ? selectConfig.defaultValue
          : [];
        const reasonsToSend =
          selectedReasons.length > 0 ? selectedReasons : defaultReasons;
        formData.append("reasons", JSON.stringify(reasonsToSend));
        formData.append("isMultiReason", "true");
      } else {
        // Single-select mode: send single reason
        let calculatedReason = typeof reason === "string" ? reason : "";
        if (
          calculatedReason === "" &&
          selectConfig &&
          typeof selectConfig.defaultValue === "string"
        ) {
          calculatedReason = selectConfig.defaultValue;
        }
        formData.append("reason", calculatedReason);
      }
      if (extraData) {
        Object.entries(extraData).forEach(([key, value]) => {
          formData.append(key, value as string);
        });
      }
      const response = await taskNextAction({}, formData);
      if (response.success) {
        setIsProcessing(false);
        setOpenModal(false);
        if (
          taskType &&
          SHIPPING_COORDINATOR_PROCESS_TASKS_V2.includes(
            taskType
              ?.replace("wfship2:", "")
              .replace("Task", "") as ShippingCoordinatorProcessTaskV2
          )
        ) {
          router.push(`/shipping`);
        } else if (taskType && taskType.startsWith("wfship2:")) {
          router.push(`/delivery`);
        } else {
          router.push(`/shipping`);
        }
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
    setReason(""); // Reset reason when modal closes
    setSelectedReasons([]); // Reset selected reasons when modal closes
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
            {selectConfig && (
              <>
                <Label className="mt-4">
                  {(dict.modal as I18nRecord).title2 as string}
                </Label>
                {selectConfig.multiSelect ? (
                  <BrandedMultiSelect
                    options={selectConfig.options}
                    selectedValues={selectedReasons}
                    onSelectionChange={setSelectedReasons}
                    triggerText={
                      selectConfig.triggerText || "Seleccionar opciones"
                    }
                    dict={dict}
                  />
                ) : (
                  <Select
                    value={typeof reason === "string" ? reason : ""}
                    onChange={(e) => setReason(e.target.value)}
                  >
                    {selectConfig.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {(dict.modal as I18nRecord)[option.labelKey] as string}
                      </option>
                    ))}
                  </Select>
                )}
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
            {tr("modal.confirm", dict, { outcome: outcomeLabel ?? "Next" })}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
