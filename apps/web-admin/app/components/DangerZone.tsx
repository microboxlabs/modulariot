"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Button, Modal, TextInput, Alert, ModalFooter, ModalBody, ModalHeader } from "flowbite-react";
import { Trash2, AlertTriangle } from "lucide-react";

export default function DangerZone() {
  const params = useParams();
  const orgId = params.orgId as string;
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleDeleteOrg = async () => {
    if (confirmText !== "DELETE") {
      setError("Please type DELETE to confirm");
      return;
    }

    setIsDeleting(true);
    setError("");

    try {
      // TODO: Implement DELETE /api/org/[orgId] API call
      const response = await fetch(`/api/organizations/${orgId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete organization");
      }

      // TODO: Redirect to organization list after successful deletion
      window.location.href = "/org";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete organization");
    } finally {
      setIsDeleting(false);
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
              Danger Zone
            </h3>
            <p className="mt-2 text-sm text-red-700 dark:text-red-300">
              Once you delete an organization, there is no going back. Please be certain.
            </p>
            <div className="mt-4">
              <Button
                color="red"
                outline
                onClick={() => setShowDeleteModal(true)}
                className="flex items-center space-x-2 hover:cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete Organization</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Modal show={showDeleteModal} onClose={() => setShowDeleteModal(false)}>
        <ModalHeader>Delete Organization</ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div className="flex items-center space-x-3 rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
              <AlertTriangle className="h-6 w-6 text-red-500" />
              <div>
                <p className="font-semibold text-red-800 dark:text-red-400">
                  This action cannot be undone
                </p>
                <p className="text-sm text-red-700 dark:text-red-300">
                  This will permanently delete the organization and all associated data.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Type <span className="font-bold">DELETE</span> to confirm:
              </label>
              <TextInput
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                className="mt-1"
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
            onClick={handleDeleteOrg}
            disabled={confirmText !== "DELETE" || isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete Organization"}
          </Button>
          <Button color="gray" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}