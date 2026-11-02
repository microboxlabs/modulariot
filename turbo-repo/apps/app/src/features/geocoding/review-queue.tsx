"use client";

import { useState } from "react";
import { Alert, Badge, Button, Spinner } from "flowbite-react";
import { HiOutlineCheckCircle } from "react-icons/hi";
import CatalogTable from "@/features/common/components/catalog-table";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { useTripsPermission } from "@/features/trips/monitors/monitors-api";
import { LOCATION_WRITE } from "@/features/trips/locations/locations-api";
import PlaceLocationModal from "./place-location-modal";
import RejectLocationModal from "./reject-location-modal";
import { reviewNote } from "./review-note";
import { useReviewQueue, type PlacedLocation } from "./review-api";

type Action = { kind: "place" | "reject"; location: PlacedLocation };

function districtLine(l: PlacedLocation) {
  return [l.district, l.districtCode, l.country].filter(Boolean).join(" · ");
}

function ReviewRow({
  l,
  canEdit,
  d,
  onAction,
}: Readonly<{
  l: PlacedLocation;
  canEdit: boolean;
  d: I18nRecord;
  onAction: (action: Action) => void;
}>) {
  return (
    <tr className="border-t border-gray-200 dark:border-gray-700">
      <td className="px-4 py-2.5">
        <div className="font-medium text-gray-900 dark:text-white">
          {l.name}
        </div>
        <div className="font-mono text-gray-400">{l.externalCode}</div>
      </td>
      <td className="px-4 py-2.5">
        <div>{l.address ?? "—"}</div>
        <div className="text-gray-400">{districtLine(l)}</div>
      </td>
      <td className="px-4 py-2.5">
        <Badge color="warning" className="w-fit whitespace-normal">
          {l.resolutionNote
            ? reviewNote(l.resolutionNote, d.notes as I18nRecord | undefined)
            : tr("noReason", d)}
        </Badge>
      </td>
      <td className="px-4 py-2.5">
        {trDynamic(l.type, d.types as I18nRecord)}
      </td>
      <td className="px-4 py-2.5">
        {canEdit && (
          <div className="flex justify-end gap-2">
            <Button
              size="xs"
              color="blue"
              onClick={() => onAction({ kind: "place", location: l })}
            >
              {tr("placeAction", d)}
            </Button>
            <Button
              size="xs"
              color="light"
              onClick={() => onAction({ kind: "reject", location: l })}
            >
              {tr("rejectAction", d)}
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}

/** Locations the resolver could not place, with the reason, to place by hand or reject. */
export default function ReviewQueue({
  q = "",
  d,
}: Readonly<{ q?: string; d: I18nRecord }>) {
  const { data, error, isLoading } = useReviewQueue();
  const canEdit = useTripsPermission(LOCATION_WRITE);
  const [action, setAction] = useState<Action | null>(null);
  const needle = q.trim().toLowerCase();
  const shown = (data ?? []).filter(
    (l) =>
      !needle ||
      [l.name, l.externalCode, l.address].some((v) =>
        v?.toLowerCase().includes(needle)
      )
  );

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {tr("title", d)}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr("description", d)}
          </p>
        </div>
        {data && data.length > 0 && (
          <Badge color="warning" className="shrink-0">
            {tr("count", d, { count: String(data.length) })}
          </Badge>
        )}
      </div>

      {error && (
        <Alert color="failure">
          <span className="text-sm">{error.message}</span>
        </Alert>
      )}
      {isLoading && (
        <div className="flex justify-center py-10">
          <Spinner aria-label={tr("loading", d)} />
        </div>
      )}
      {data && shown.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-10 text-center dark:border-gray-700">
          <HiOutlineCheckCircle className="h-6 w-6 text-green-500" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {data.length === 0 ? tr("empty", d) : tr("noMatches", d)}
          </p>
        </div>
      )}
      {shown.length > 0 && (
        <CatalogTable
          columns={[
            tr("location", d),
            tr("address", d),
            tr("reason", d),
            tr("type", d),
            "",
          ]}
        >
          {shown.map((l) => (
            <ReviewRow
              key={l.id}
              l={l}
              canEdit={canEdit}
              d={d}
              onAction={setAction}
            />
          ))}
        </CatalogTable>
      )}

      {action?.kind === "place" && (
        <PlaceLocationModal
          location={action.location}
          onClose={() => setAction(null)}
          d={d}
        />
      )}
      {action?.kind === "reject" && (
        <RejectLocationModal
          location={action.location}
          onClose={() => setAction(null)}
          d={d}
        />
      )}
    </section>
  );
}
