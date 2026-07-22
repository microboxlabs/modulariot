import { CustomBadge } from "@/features/common/components/custom-badge";
import {
  STATUS_LABELS,
  statusBadgeClassName,
  type GpsProviderRequest,
} from "./gps-provider-request.types";

function formatRequestedAt(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function GpsProviderRequestItem({
  request,
}: Readonly<{ request: GpsProviderRequest }>) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-medium text-gray-700 dark:text-white truncate">
          {request.providerName}
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500 truncate">
          {request.organizationName}
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {formatRequestedAt(request.requestedAt)}
        </span>
        <CustomBadge
          text={STATUS_LABELS[request.status]}
          className={statusBadgeClassName(request.status)}
        />
      </div>
    </div>
  );
}
