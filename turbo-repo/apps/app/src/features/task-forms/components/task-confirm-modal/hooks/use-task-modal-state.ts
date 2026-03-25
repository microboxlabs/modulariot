import { useState, useEffect } from "react";
import { SelectConfig } from "../task-confirm-modal.types";

function getDefaultValues(defaultValue: string | string[]): string[] {
  if (Array.isArray(defaultValue)) {
    return defaultValue;
  }
  return defaultValue ? [defaultValue] : [];
}

export interface TaskModalState {
  selectedValues: string[];
  setSelectedValues: (values: string[]) => void;
  comments: string;
  setComments: (comments: string) => void;
  resetState: () => void;
}

export function useTaskModalState(
  openModal: boolean,
  selectConfig: SelectConfig | null
): TaskModalState {
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [comments, setComments] = useState("");

  // Initialize selected values when modal opens or config changes
  useEffect(() => {
    if (openModal && selectConfig) {
      if (selectedValues.length === 0) {
        const defaultValues = getDefaultValues(selectConfig.defaultValue);
        setSelectedValues(defaultValues);
      }
    }
  }, [openModal, selectConfig, selectedValues.length]);

  const resetState = () => {
    setSelectedValues([]);
    setComments("");
  };

  return {
    selectedValues,
    setSelectedValues,
    comments,
    setComments,
    resetState,
  };
}
