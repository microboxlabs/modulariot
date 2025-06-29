import { Prisma } from "@modulariot/db";
import { buildIncludeQuery } from "./fetcher";

export const endpointOrgs = () => `/api/organizations`;

export const endpointOrg = (orgId: string, options?: Prisma.OrganizationInclude) => `/api/organizations/${orgId}${buildIncludeQuery(options)}`;

export const endpointOrgProjects = (orgId: string) => `/api/organizations/${orgId}/projects`;

export const endpointOrgProject = (orgId: string, projectId: string) => `/api/organizations/${orgId}/projects/${projectId}`;

export const endpointOrgProjectCredentials = (orgId: string, projectId: string) => `/api/organizations/${orgId}/projects/${projectId}/credentials`;

export const endpointOrgProjectRestart = (orgId: string, projectId: string) => `/api/organizations/${orgId}/projects/${projectId}/restart`;

export const endpointOrgProjectPause = (orgId: string, projectId: string) => `/api/organizations/${orgId}/projects/${projectId}/pause`;