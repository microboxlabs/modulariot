"use client";

import { Button, Modal, ModalBody } from "flowbite-react";
import { HiOutlineExclamationCircle } from "react-icons/hi";
import { type ReactNode } from "react";
import { createPortal } from "react-dom";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  /** Can include JSX for highlighting specific text */
  description: ReactNode;
  confirmText?: string;
  cancelText?: string;
  /** Defaults to "red" for destructive actions */
  confirmColor?: "red" | "blue" | "green";
}

/**
 * Compact confirmation modal for destructive or important actions
 * No header X button - uses Cancel button for dismissal
 * Uses portal to escape draggable containers
 */
export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmColor = "red",
}: ConfirmModalProps) {
  const handleConfirm = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onConfirm();
    onClose();
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onClose();
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  if (!isOpen) return null;

  const modalContent = (
    <Modal show={isOpen} size="sm" onClose={onClose} popup dismissible={false}>
      <ModalBody
        className="no-drag pt-6"
        onClick={handleContainerClick}
        onMouseDown={handleMouseDown}
      >
        <div className="text-center">
          <HiOutlineExclamationCircle className="mx-auto mb-3 h-10 w-10 text-gray-400 dark:text-gray-500" />
          <h3 className="mb-2 text-base font-semibold text-gray-900 dark:text-white">
            {title}
          </h3>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            {description}
          </p>
          <div className="flex justify-center gap-3">
            <Button
              size="sm"
              color={confirmColor}
              onClick={handleConfirm}
              onMouseDown={handleMouseDown}
              className="no-drag"
            >
              {confirmText}
            </Button>
            <Button
              size="sm"
              color="gray"
              onClick={handleCancel}
              onMouseDown={handleMouseDown}
              className="no-drag"
            >
              {cancelText}
            </Button>
          </div>
        </div>
      </ModalBody>
    </Modal>
  );

  // Use portal to render modal at document body level, escaping any draggable containers
  if (typeof document !== "undefined") {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
}
