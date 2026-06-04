"use client";

import type { ReactNode } from "react";
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Button,
} from "flowbite-react";
import { HiExclamation, HiInformationCircle, HiCheck } from "react-icons/hi";

export type ConfirmationModalVariant =
  | "danger"
  | "warning"
  | "info"
  | "success";

export type ConfirmationModalProps = Readonly<{
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal closes (cancel or backdrop click) */
  onClose: () => void;
  /** Callback when confirm button is clicked */
  onConfirm: () => void;
  /** Modal title */
  title: string;
  /** Modal description/subtitle */
  description?: ReactNode;
  /** Optional children for additional content */
  children?: ReactNode;
  /** Confirm button label */
  confirmLabel?: string;
  /** Whether an action is processing (disables buttons) */
  isProcessing?: boolean;
  /** Visual variant that determines icon */
  variant?: ConfirmationModalVariant;
  /** Modal size */
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";
  /** Whether to show the icon */
  showIcon?: boolean;
}>;

const variantConfig: Record<
  ConfirmationModalVariant,
  {
    icon: typeof HiExclamation;
  }
> = {
  danger: {
    icon: HiExclamation,
  },
  warning: {
    icon: HiExclamation,
  },
  info: {
    icon: HiInformationCircle,
  },
  success: {
    icon: HiCheck,
  },
};

/**
 * Standardized confirmation dialog. Domain-agnostic: callers pass the title,
 * description, and labels (translated host-side). Use for any action that needs
 * user confirmation — delete operations, irreversible changes, etc.
 */
export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  children,
  confirmLabel = "Confirmar",
  isProcessing = false,
  variant = "danger",
  size = "md",
  showIcon = true,
}: ConfirmationModalProps) {
  const config = variantConfig[variant];
  const IconComponent = config.icon;

  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <Modal dismissible show={isOpen} onClose={onClose} size={size}>
      <ModalHeader className="border-none">
        <div className="flex items-center gap-3">
          {showIcon && (
            <IconComponent className="w-5 h-5 text-gray-500 dark:text-gray-400 shrink-0" />
          )}
          <h2 className="text-base font-semibold">{title}</h2>
        </div>
      </ModalHeader>
      <ModalBody>
        <div className="flex flex-col">
          {description && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {description}
            </p>
          )}
          {children}
        </div>
      </ModalBody>
      <ModalFooter className="border-none justify-end">
        <Button color="blue" onClick={handleConfirm} disabled={isProcessing}>
          {confirmLabel}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
