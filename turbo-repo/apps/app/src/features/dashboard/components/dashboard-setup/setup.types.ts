import type { PermissionAssignment } from "@microboxlabs/miot-dashboard-ui/react";

/** A role as the dashboard server names it. */
export type DashboardRole = PermissionAssignment["role"];

/**
 * The roles the setup offers: the dashboard server's own four, the same ones
 * the dashboard permissions have always had, from least to most.
 */
export type SetupRole = DashboardRole;

export const SETUP_ROLES: readonly SetupRole[] = [
  "Consumer",
  "Contributor",
  "Editor",
  "Coordinator",
];

/**
 * Who sees a dashboard or folder: everyone in the organization, or only who
 * its permissions name (plus its creator and the organization's owners).
 */
export type Visibility = "organization" | "restricted";

export type SetupStep = "permissions" | "tags" | "dashlet";

export const SETUP_STEPS: readonly SetupStep[] = [
  "permissions",
  "tags",
  "dashlet",
];
