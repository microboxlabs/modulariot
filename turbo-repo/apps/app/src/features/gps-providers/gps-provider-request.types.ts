export type GpsProviderRequestStatus = "pending" | "accepted" | "rejected";

export interface GpsProviderRequest {
  id: string;
  providerId: string;
  providerName: string;
  organizationName: string;
  status: GpsProviderRequestStatus;
  requestedAt: string;
}

export const STATUS_LABELS: Record<GpsProviderRequestStatus, string> = {
  pending: "Waiting for permission",
  accepted: "Accepted",
  rejected: "Rejected",
};

export function statusBadgeClassName(status: GpsProviderRequestStatus): string {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300";
    case "accepted":
      return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
    case "rejected":
      return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
  }
}
