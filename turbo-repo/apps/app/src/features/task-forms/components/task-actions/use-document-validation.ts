import { useGetNodeChildren } from "@/features/common/providers/client-api.provider";
import {
  TYPE_WFDELIVERY_CONFIRM_DELIVERY_TASK,
  TYPE_WFDELIVERY_RECEIVE_DELIVERY_TASK,
} from "../../services/form.service";
import {
  DeliveryProcessForms,
  PlanningProcessForms,
  ShippingCoordinatorProcessFormsV2,
} from "../../services/form.service.types";

type TaskType =
  | ShippingCoordinatorProcessFormsV2
  | DeliveryProcessForms
  | PlanningProcessForms;

type DocumentValidationResult = {
  isValid: boolean;
  hasPOD: boolean;
  hasPOLF: boolean;
  isLoading: boolean;
  requiredDocuments: string[];
};

function extractPackageId(bpmPackage: string | undefined): string | undefined {
  if (!bpmPackage) return undefined;
  const parts = bpmPackage.split("/");
  return parts.at(-1);
}

const TASK_TYPES_REQUIRING_VALIDATION = [
  TYPE_WFDELIVERY_CONFIRM_DELIVERY_TASK,
  TYPE_WFDELIVERY_RECEIVE_DELIVERY_TASK,
] as const;

// A delivery document can arrive classified either as PROOF_OF_DELIVERY or
// PROOF_OF_LOAD_RECEIPT, so both satisfy the document gate.
const ACCEPTED_POD_CONTENT_TYPES = new Set([
  "PROOF_OF_DELIVERY",
  "PROOF_OF_LOAD_RECEIPT",
]);

function requiresValidation(taskType: TaskType): boolean {
  return (TASK_TYPES_REQUIRING_VALIDATION as readonly string[]).includes(
    taskType
  );
}

export function useDocumentValidation(
  taskType: TaskType,
  bpmPackage: string | undefined
): DocumentValidationResult {
  const needsValidation = requiresValidation(taskType);
  const packageId = needsValidation
    ? extractPackageId(bpmPackage)
    : undefined;

  const { data, isLoading } = useGetNodeChildren(packageId);

  if (!needsValidation) {
    return {
      isValid: true,
      hasPOD: false,
      hasPOLF: false,
      isLoading: false,
      requiredDocuments: [],
    };
  }

  interface NodeEntry {
    entry: {
      properties?: Record<string, string>;
    };
  }

  const entries: NodeEntry[] = data?.data?.list?.entries || [];

  const hasPOD = entries.some((file) =>
    ACCEPTED_POD_CONTENT_TYPES.has(
      file.entry.properties?.["mintral:contentType"] ?? ""
    )
  );

  const hasPOLF = false;

  let isValid = false;
  const requiredDocuments: string[] = [];

  if (
    taskType === TYPE_WFDELIVERY_CONFIRM_DELIVERY_TASK ||
    taskType === TYPE_WFDELIVERY_RECEIVE_DELIVERY_TASK
  ) {
    isValid = hasPOD;
    if (!isValid) {
      requiredDocuments.push("PROOF_OF_DELIVERY");
    }
  }

  return {
    isValid,
    hasPOD,
    hasPOLF,
    isLoading,
    requiredDocuments,
  };
}
