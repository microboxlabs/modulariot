"use client";

import useSWRMutation from "swr/mutation";
import { useState } from "react";
import { Button, Modal, TextInput, Alert, ModalFooter, ModalBody, ModalHeader } from "flowbite-react";
import { Trash2, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";

export type DangerZoneProps = {
  entityType: string;
  entityName: string;
  entityId: string;
  title?: string;
  description?: string;
  buttonText?: string;
  confirmationText?: string;
  url: string;
  deleter: (url: string) => Promise<void>;
  redirect: string;
  disabled?: boolean;
}

export function DangerZone({
  entityType,
  entityName,
  entityId,
  title,
  description,
  buttonText,
  confirmationText,
  url,
  deleter,
  redirect,
  disabled = false,
}: DangerZoneProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [internalIsDeleting, setInternalIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { trigger, error: deleteError, isMutating } = useSWRMutation(url, deleter);

  const isDeleting = isMutating ?? internalIsDeleting;
  const finalTitle = title ?? `Delete ${entityType}`;
  const finalDescription = description ?? `Once you delete ${entityType.toLowerCase()}, there is no going back. Please be certain.`;
  const finalButtonText = buttonText ?? `Delete ${entityType}`;
  const finalConfirmationText = confirmationText ?? entityName;

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
    setConfirmText("");
    setError("");
  };

  const handleDelete = async () => {
    if (confirmText !== finalConfirmationText) {
      setError(`Please type "${finalConfirmationText}" to confirm`);
      return;
    }

    if (isMutating === undefined) {
      setInternalIsDeleting(true);
    }
    setError("");

    try {
      await trigger();
      setShowDeleteModal(false);
      router.push(redirect);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(`Failed to delete ${entityType.toLowerCase()}`);
      setError(error.message);
    } 
    // finally {
    //   if (externalIsDeleting === undefined) {
    //     setInternalIsDeleting(false);
    //   }
    // }
  };

  const handleModalClose = () => {
    if (!isDeleting) {
      setShowDeleteModal(false);
      setConfirmText("");
      setError("");
    }
  };

  return (
    <>
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <AlertTriangle className="h-6 w-6 text-red-500" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-red-800 dark:text-red-400">
              {finalTitle}
            </h3>
            <p className="mt-2 text-sm text-red-700 dark:text-red-300">
              {finalDescription}
            </p>
            <div className="mt-4">
              <Button
                color="red"
                outline
                onClick={handleDeleteClick}
                disabled={disabled || isDeleting}
                className="flex items-center space-x-2 hover:cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
                <span>{finalButtonText}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Modal show={showDeleteModal} onClose={handleModalClose}>
        <ModalHeader>{finalTitle}</ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div className="flex items-center space-x-3 rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
              <AlertTriangle className="h-6 w-6 text-red-500" />
              <div>
                <p className="font-semibold text-red-800 dark:text-red-400">
                  This action cannot be undone
                </p>
                <p className="text-sm text-red-700 dark:text-red-300">
                  This will permanently delete the {entityType.toLowerCase()} and all associated data.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Type <span className="font-bold">{finalConfirmationText}</span> to confirm:
              </label>
              <TextInput
                type="text"
                value={confirmText}
                onChange={(e: any) => setConfirmText(e.target.value)}
                placeholder={finalConfirmationText}
                className="mt-1"
                disabled={isDeleting}
              />
            </div>

            {error && (
              <Alert color="failure" className="mt-4">
                {error}
              </Alert>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            color="failure"
            onClick={handleDelete}
            disabled={confirmText !== finalConfirmationText || isDeleting}
          >
            {isDeleting ? `Deleting...` : finalButtonText}
          </Button>
          <Button 
            color="gray" 
            onClick={handleModalClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}