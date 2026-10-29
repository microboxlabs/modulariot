"use client";

import { useState } from "react";
import {
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  TextInput,
} from "flowbite-react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import PointPicker from "./point-picker";
import {
  formatPoint,
  initialPoint,
  placeLocation,
  type ManualPoint,
  type PlacedLocation,
} from "./review-api";

interface Point {
  latitude: number;
  longitude: number;
}

/** The Plus Code when one is typed, else the point on the map, else null. */
export function manualPoint(
  plusCode: string,
  point: Point | null
): ManualPoint | null {
  const code = plusCode.trim();
  if (code) return { plusCode: code };
  return point;
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause);
}

/**
 * Sets a location's point by hand: a click on the map or a Plus Code. The
 * modulith checks it against the location's district, then creates the geofence.
 */
export default function PlaceLocationModal({
  location,
  onClose,
  d,
}: Readonly<{ location: PlacedLocation; onClose: () => void; d: I18nRecord }>) {
  const hasPoint = location.latitude !== null && location.longitude !== null;
  const [point, setPoint] = useState<Point | null>(
    hasPoint ? initialPoint(location) : null
  );
  const [plusCode, setPlusCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = manualPoint(plusCode, point);

  const save = async () => {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      await placeLocation(location.id, chosen);
      onClose();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    if (!busy) onClose();
  };
  const district = [location.district, location.districtCode]
    .filter(Boolean)
    .join(" · ");

  return (
    <Modal show onClose={close} size="4xl">
      <ModalHeader>{tr("place.title", d, { name: location.name })}</ModalHeader>
      <ModalBody>
        <div className="flex flex-col gap-3">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-gray-500 dark:text-gray-400">
              {tr("address", d)}
            </dt>
            <dd className="text-gray-900 dark:text-white">
              {location.address ?? "—"}
            </dd>
            <dt className="text-gray-500 dark:text-gray-400">
              {tr("district", d)}
            </dt>
            <dd className="text-gray-900 dark:text-white">{district || "—"}</dd>
            <dt className="text-gray-500 dark:text-gray-400">
              {tr("reason", d)}
            </dt>
            <dd className="text-amber-700 dark:text-amber-400">
              {location.resolutionNote ?? "—"}
            </dd>
          </dl>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr("place.help", d)}
          </p>
          <div className="h-80">
            <PointPicker
              center={initialPoint(location)}
              point={point}
              onPoint={setPoint}
              label={tr("place.map", d)}
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-1">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {tr("place.point", d)}
              </span>
              <p className="font-mono text-sm text-gray-900 dark:text-white">
                {point ? formatPoint(point) : tr("place.noPoint", d)}
              </p>
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label
                htmlFor="place-plus-code"
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {tr("place.plusCode", d)}
              </label>
              <TextInput
                id="place-plus-code"
                className="font-mono"
                placeholder="57R6+XQ Miraflores"
                value={plusCode}
                onChange={(e) => setPlusCode(e.target.value)}
              />
            </div>
          </div>
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
        <Button color="blue" disabled={busy || chosen === null} onClick={save}>
          {tr("place.save", d)}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
