"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  TextInput,
} from "flowbite-react";
import { HiOutlineLocationMarker, HiSearch } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { useTripsPermission } from "../monitors/monitors-api";
import {
  LOCATION_WRITE,
  geofenceLabel,
  linkGeofence,
  useGeofences,
  useLocations,
  type Geofence,
  type TripLocation,
} from "./locations-api";

function GeofenceModal({
  location,
  onClose,
  d,
}: Readonly<{
  location: TripLocation | null;
  onClose: () => void;
  d: I18nRecord;
}>) {
  const [q, setQ] = useState("");
  const { data, isLoading, error: searchError } = useGeofences(q);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = async (geofenceId: number | null) => {
    if (!location) return;
    setBusy(true);
    setError(null);
    try {
      await linkGeofence(location.id, geofenceId);
      setQ("");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    if (!busy) onClose();
  };

  const geofences = data ?? [];
  return (
    <Modal show={location !== null} onClose={close} size="lg">
      <ModalHeader>
        {tr("chooseGeofence", d, { name: location?.name ?? "" })}
      </ModalHeader>
      <ModalBody>
        <div className="flex flex-col gap-3">
          <TextInput
            icon={HiSearch}
            placeholder={tr("searchGeofence", d)}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {isLoading && (
            <p className="text-sm text-gray-500">{tr("loading", d)}</p>
          )}
          {data && geofences.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tr("noGeofences", d)}
            </p>
          )}
          <ul className="max-h-80 divide-y divide-gray-200 overflow-y-auto rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
            {geofences.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => choose(g.id)}
                  className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800 ${
                    g.id === location?.geofenceId
                      ? "bg-blue-50 dark:bg-gray-800"
                      : ""
                  }`}
                >
                  <span className="text-gray-900 dark:text-white">
                    {g.name ?? `#${g.id}`}
                  </span>
                  <span className="font-mono text-xs text-gray-400">
                    {g.code}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {(error || searchError) && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error || searchError.message}
            </p>
          )}
        </div>
      </ModalBody>
      <ModalFooter className="justify-between">
        <Button
          color="light"
          disabled={busy || location?.geofenceId == null}
          onClick={() => choose(null)}
        >
          {tr("removeGeofence", d)}
        </Button>
        <Button color="gray" disabled={busy} onClick={close}>
          {tr("cancel", d)}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

/** The organization's trip locations and the GPS geofence each one points at. */
/** The locations matching `q`, only those without a geofence when `onlyMissing`; the page holds both filters. */
export default function LocationsPanel({
  q = "",
  onlyMissing = false,
  d,
}: Readonly<{ q?: string; onlyMissing?: boolean; d: I18nRecord }>) {
  const { data, error, isLoading } = useLocations(q);
  const known: Geofence[] = useGeofences("").data ?? [];
  const canEdit = useTripsPermission(LOCATION_WRITE);
  const [editing, setEditing] = useState<TripLocation | null>(null);

  const all = data ?? [];
  const shown = onlyMissing ? all.filter((l) => l.geofenceId == null) : all;
  const missing = all.filter((l) => l.geofenceId == null).length;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {tr("title", d)}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr("description", d)}
          </p>
        </div>
        {missing > 0 && (
          <Badge color="warning" className="self-start">
            {tr("missingCount", d, { count: String(missing) })}
          </Badge>
        )}
      </div>

      {isLoading && <p className="text-sm text-gray-500">{tr("loading", d)}</p>}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {error.message}
        </p>
      )}
      {data && shown.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-10 text-center dark:border-gray-700">
          <HiOutlineLocationMarker className="h-6 w-6 text-gray-400" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr("empty", d)}
          </p>
        </div>
      )}

      {shown.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3">{tr("location", d)}</th>
                <th className="px-4 py-3">{tr("code", d)}</th>
                <th className="px-4 py-3">{tr("type", d)}</th>
                <th className="px-4 py-3">{tr("geofence", d)}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((l) => (
                <tr
                  key={l.id}
                  className="border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
                >
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                    {l.name}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {l.externalCode}
                  </td>
                  <td className="px-4 py-3">
                    {trDynamic(l.type, d.types as I18nRecord)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {l.geofenceId == null ? (
                        <Badge color="warning">{tr("noGeofence", d)}</Badge>
                      ) : (
                        <span>{geofenceLabel(l.geofenceId, known)}</span>
                      )}
                      {canEdit && (
                        <Button
                          size="xs"
                          color="light"
                          onClick={() => setEditing(l)}
                        >
                          {l.geofenceId == null
                            ? tr("assign", d)
                            : tr("change", d)}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <GeofenceModal
          location={editing}
          onClose={() => setEditing(null)}
          d={d}
        />
      )}
    </section>
  );
}
