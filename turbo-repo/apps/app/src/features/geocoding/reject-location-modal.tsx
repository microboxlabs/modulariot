"use client";

import { useState } from "react";
import {
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Textarea,
} from "flowbite-react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { rejectLocation, type PlacedLocation } from "./review-api";

/** Marks a location as one that cannot be located, with why. */
export default function RejectLocationModal({
  location,
  onClose,
  d,
}: Readonly<{ location: PlacedLocation; onClose: () => void; d: I18nRecord }>) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reject = async () => {
    setBusy(true);
    setError(null);
    try {
      await rejectLocation(location.id, note);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    if (!busy) onClose();
  };

  return (
    <Modal show onClose={close} size="md">
      <ModalHeader>
        {tr("reject.title", d, { name: location.name })}
      </ModalHeader>
      <ModalBody>
        <div className="flex flex-col gap-2">
          <label
            htmlFor="reject-note"
            className="text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {tr("reject.note", d)}
          </label>
          <Textarea
            id="reject-note"
            rows={3}
            maxLength={255}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
      </ModalBody>
      <ModalFooter className="justify-end">
        <Button color="alternative" disabled={busy} onClick={close}>
          {tr("cancel", d)}
        </Button>
        <Button color="red" disabled={busy} onClick={reject}>
          {tr("reject.confirm", d)}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
