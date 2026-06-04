"use client";

import { useState, useCallback } from "react";
import { updateTaskProperties } from "@/features/task-forms/services/client-form.service";
import {
  EditableFieldState,
  UseEditableFieldReturn,
} from "./editable-field.types";

type UseEditableFieldProps = {
  taskId: string;
  fieldName: string;
  initialValue: string;
  onUpdate?: (newValue: string) => void;
  onSave?: (newValue: string) => Promise<void>;
  disabled?: boolean;
};

export function useEditableField({
  taskId,
  fieldName,
  initialValue,
  onUpdate,
  onSave,
  disabled = false,
}: UseEditableFieldProps): UseEditableFieldReturn {
  const [state, setState] = useState<EditableFieldState>("display");
  const [editValue, setEditValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const startEditing = useCallback(() => {
    if (disabled) return;
    setState("editing");
    setEditValue(initialValue);
    setError(null);
  }, [disabled, initialValue]);

  const cancelEditing = useCallback(() => {
    setState("display");
    setEditValue(initialValue);
    setError(null);
  }, [initialValue]);

  const saveValue = useCallback(async () => {
    if (editValue === initialValue) {
      setState("display");
      return;
    }

    setState("saving");
    setError(null);

    try {
      if (onSave) {
        await onSave(editValue);
      } else {
        const result = await updateTaskProperties(taskId, {
          [fieldName]: editValue,
        });

        if (!result.success) {
          setState("error");
          setError(result.error || "Failed to save changes");
          return;
        }
      }

      setState("display");
      onUpdate?.(editValue);
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  }, [taskId, fieldName, editValue, initialValue, onUpdate, onSave]);

  const handleMouseEnter = useCallback(() => {
    if (!disabled && state === "display") {
      setIsHovered(true);
    }
  }, [disabled, state]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        saveValue();
      } else if (e.key === "Escape") {
        cancelEditing();
      }
    },
    [saveValue, cancelEditing]
  );

  return {
    state,
    editValue,
    error,
    isHovered,
    startEditing,
    cancelEditing,
    saveValue,
    setEditValue,
    handleMouseEnter,
    handleMouseLeave,
    handleKeyDown,
  };
}
