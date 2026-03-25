import { Prisma } from "@modulariot/db";
import { buildIncludeQuery } from "./fetcher";

export const endpointOrgs = (options?: Prisma.OrganizationInclude) => `/api/organizations${buildIncludeQuery(options)}`;

export const endpointOrg = (orgId: string, options?: Prisma.OrganizationInclude) => `${endpointOrgs()}/${orgId}${buildIncludeQuery(options)}`;

export const endpointOrgProjects = (orgId: string) => `${endpointOrg(orgId)}/projects`;

export const endpointOrgProject = (orgId: string, projectId: string) => `${endpointOrgProjects(orgId)}/${projectId}`;

export const endpointOrgProjectRestart = (orgId: string, projectId: string) => `${endpointOrgProject(orgId, projectId)}/restart`;

export const endpointOrgProjectCredentials = (orgId: string, projectId: string) => `${endpointOrgProject(orgId, projectId)}/credentials`;

export const endpointOrgProjectPause = (orgId: string, projectId: string) => `${endpointOrgProject(orgId, projectId)}/pause`;
