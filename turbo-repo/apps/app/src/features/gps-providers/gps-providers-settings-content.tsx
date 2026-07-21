"use client";

import { useMemo, useState } from "react";
import { Button } from "flowbite-react";
import { HiArrowDown, HiArrowUp } from "react-icons/hi2";
import { Pill } from "@/features/dashboard/dashlets/common/pill";
import GpsProviderRequestForm from "./gps-provider-request-form";
import GpsProviderRequestItem from "./gps-provider-request-item";
import type { GpsProviderRequest } from "./gps-provider-request.types";

function generateId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export default function GpsProvidersSettingsContent() {
  const [requests, setRequests] = useState<GpsProviderRequest[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

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

  const sortedRequests = useMemo(() => {
    const sorted = [...requests].sort(
      (a, b) =>
        new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime()
    );
    return sortDir === "desc" ? sorted.reverse() : sorted;
  }, [requests, sortDir]);

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4">
      <div className="max-w-3xl mx-auto flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Request permission to connect the GPS data sources for your
            fleet.
          </p>
          {!showForm && (
            <Button size="xs" color="blue" onClick={() => setShowForm(true)}>
              Add GPS provider
            </Button>
          )}
        </div>

        {showForm && (
          <GpsProviderRequestForm
            onCancel={() => setShowForm(false)}
            onSubmit={addRequest}
          />
        )}

        {requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 py-8 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No GPS provider requests yet.
            </p>
          </div>
        ) : (
          <>
            <div className="flex justify-end">
              <Pill
                label="Request date"
                active
                onClick={() =>
                  setSortDir((prev) => (prev === "desc" ? "asc" : "desc"))
                }
                icon={
                  sortDir === "asc" ? (
                    <HiArrowUp className="h-3 w-3" />
                  ) : (
                    <HiArrowDown className="h-3 w-3" />
                  )
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              {sortedRequests.map((request) => (
                <GpsProviderRequestItem key={request.id} request={request} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
