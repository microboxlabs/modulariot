"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "flowbite-react";
import GpsProviderRequestForm from "./gps-provider-request-form";
import GpsProviderRequestItem from "./gps-provider-request-item";
import type { GpsProviderRequest } from "./gps-provider-request.types";

function generateId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export default function GpsProvidersSettingsContent() {
  const searchParams = useSearchParams();
  const organizationQuery = (searchParams.get("organizationName") ?? "")
    .trim()
    .toLowerCase();
  const providerValues = (searchParams.get("provider") ?? "")
    .split(",")
    .filter(Boolean);
  const statusValues = (searchParams.get("status") ?? "")
    .split(",")
    .filter(Boolean);
  // The sort toggle only ever writes "asc" or "desc" (or clears the param);
  // anything else (unset) falls back to the newest-first default.
  const sortDir = searchParams.get("sort") === "asc" ? "asc" : "desc";

  const [requests, setRequests] = useState<GpsProviderRequest[]>([]);
  const [showForm, setShowForm] = useState(false);

  const addRequest = (data: {
    providerId: string;
    providerName: string;
    organizationName: string;
  }) => {
    setRequests((prev) => [
      ...prev,
      {
        id: generateId(),
        providerId: data.providerId,
        providerName: data.providerName,
        organizationName: data.organizationName,
        status: "pending",
        requestedAt: new Date().toISOString(),
      },
    ]);
    setShowForm(false);
  };

  const visibleRequests = useMemo(() => {
    const filtered = requests.filter((request) => {
      if (
        organizationQuery &&
        !request.organizationName.toLowerCase().includes(organizationQuery)
      ) {
        return false;
      }
      if (
        providerValues.length > 0 &&
        !providerValues.includes(request.providerId)
      ) {
        return false;
      }
      if (statusValues.length > 0 && !statusValues.includes(request.status)) {
        return false;
      }
      return true;
    });

    const sorted = [...filtered].sort(
      (a, b) =>
        new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime()
    );
    return sortDir === "desc" ? sorted.reverse() : sorted;
  }, [requests, organizationQuery, providerValues, statusValues, sortDir]);

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4">
      <div className="max-w-3xl mx-auto flex flex-col gap-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Request permission to connect the GPS data sources for your fleet.
        </p>

        {!showForm && (
          <Button
            color="blue"
            className="w-full"
            onClick={() => setShowForm(true)}
          >
            Add GPS provider
          </Button>
        )}

        {showForm && (
          <GpsProviderRequestForm
            onCancel={() => setShowForm(false)}
            onSubmit={addRequest}
          />
        )}

        {visibleRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 py-8 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {requests.length === 0
                ? "No GPS provider requests yet."
                : "No GPS provider requests match your filters."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {visibleRequests.map((request) => (
              <GpsProviderRequestItem key={request.id} request={request} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
