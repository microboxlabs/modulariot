"use client";

import { useMemo } from "react";
import useSWR, { mutate } from "swr";
import {
  deleteForJson,
  getJson,
  sendEmpty,
  sendJson,
} from "../data/json-client";
import { withCustomRoles } from "./team-model";
import type {
  AccessCatalog,
  BaseRole,
  Binding,
  BindingRequest,
  CreatedInvitation,
  CreatedKey,
  CreatedServiceAccount,
  CustomRole,
  CustomRoleDeleted,
  CustomRoleRequest,
  Invitation,
  InviteRequest,
  KeyRequest,
  MyAccess,
  ServiceAccount,
  ServiceAccountRequest,
  Team,
  TeamMember,
  TeamRequest,
  TeamView,
  AcceptedInvitation,
} from "./team.types";

const TEAM = "/app/api/team";
export const membersKey = `${TEAM}/members`;
export const invitationsKey = `${TEAM}/invitations`;
const teamsKey = `${TEAM}/teams`;
const bindingsKey = `${TEAM}/bindings`;
const serviceAccountsKey = `${TEAM}/service-accounts`;
const customRolesKey = `${TEAM}/custom-roles`;
const CATALOG = "/app/api/access/catalog";
const MY_ACCESS = "/app/api/me/access";

export function useTeam() {
  return useSWR<TeamView>(membersKey, getJson);
}

/** The pending invitations' emails, lower-cased. */
export async function pendingInvitationEmails(): Promise<Set<string>> {
  const invitations = await getJson<Invitation[]>(invitationsKey);
  return new Set(
    invitations.filter((i) => !i.expired).map((i) => i.email.toLowerCase())
  );
}

export function useInvitations(enabled: boolean) {
  return useSWR<Invitation[]>(enabled ? invitationsKey : null, getJson);
}

export function useTeams(enabled: boolean) {
  return useSWR<Team[]>(enabled ? teamsKey : null, getJson);
}

export function useBindings(enabled: boolean) {
  return useSWR<Binding[]>(enabled ? bindingsKey : null, getJson);
}

export function useServiceAccounts(enabled: boolean) {
  return useSWR<ServiceAccount[]>(enabled ? serviceAccountsKey : null, getJson);
}

/** The organization's custom roles, with how many principals hold each. */
export function useCustomRoles() {
  return useSWR<CustomRole[]>(customRolesKey, getJson, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
}

/** Management applies to the root organization even when a sub-account is active. */
export function useCustomRoleManagement() {
  return useSWR<{ canManage: boolean; access: MyAccess }>(
    `${customRolesKey}/management`,
    getJson
  );
}

/** Team records and bindings belong to the root, so their affordances use root permissions. */
export function useTeamAccess() {
  const { data, error, isLoading } = useCustomRoleManagement();
  const access = data?.access;
  const can = (permission: string) =>
    !error && (access?.permissions.includes(permission) ?? false);
  return { access, accessError: error, accessLoading: isLoading, can };
}

/**
 * The module roles and permissions of the modulith, plus the active
 * organization's custom roles, so every role picker offers both.
 */
export function useAccessCatalog() {
  const catalog = useSWR<AccessCatalog>(CATALOG, getJson, {
    revalidateOnFocus: false,
  });
  const custom = useCustomRoles();
  // Nothing until both are loaded: an editor that opened without the custom
  // roles would save a member's roles without the custom ones they hold.
  const data = useMemo(
    () =>
      catalog.data && custom.data && !custom.error
        ? withCustomRoles(catalog.data, custom.data)
        : undefined,
    [catalog.data, custom.data, custom.error]
  );
  return {
    ...catalog,
    data,
    moduleCatalog: catalog.data,
    error: catalog.error ?? custom.error,
  };
}

export function createCustomRole(request: CustomRoleRequest) {
  return sendJson<CustomRole>("POST", customRolesKey, request);
}

export function updateCustomRole(id: string, request: CustomRoleRequest) {
  return sendJson<CustomRole>(
    "PUT",
    `${customRolesKey}/${encodeURIComponent(id)}`,
    request
  );
}

/** Deletes the role and every binding that names it; answers what was removed. */
export function deleteCustomRole(id: string) {
  return deleteForJson<CustomRoleDeleted>(
    `${customRolesKey}/${encodeURIComponent(id)}`
  );
}

/** Reloads members, teams, bindings, service accounts and custom roles after a role changed. */
export function refreshTeamData() {
  return mutate(
    (key) =>
      typeof key === "string" && (key.startsWith(TEAM) || key === MY_ACCESS)
  );
}

/** The caller's permissions in the active organization. */
export function useMyAccess() {
  const { data, error } = useSWR<MyAccess>(MY_ACCESS, getJson);
  const can = (permission: string) =>
    data?.permissions.includes(permission) ?? false;
  return { access: data, accessError: error, can };
}

export function setBaseRole(userId: string, baseRole: BaseRole) {
  return sendJson<TeamMember>(
    "PATCH",
    `${TEAM}/members/${encodeURIComponent(userId)}`,
    { baseRole }
  );
}

export function setRoles(userId: string, roles: string[]) {
  return sendJson<TeamMember>(
    "PUT",
    `${TEAM}/members/${encodeURIComponent(userId)}/roles`,
    { roles }
  );
}

export function removeMember(userId: string) {
  return sendEmpty("DELETE", `${TEAM}/members/${encodeURIComponent(userId)}`);
}

export function invite(request: InviteRequest) {
  return sendJson<CreatedInvitation[]>("POST", invitationsKey, request);
}

export function resendInvitation(id: string, lang: string) {
  return sendJson<CreatedInvitation>(
    "POST",
    `${invitationsKey}/${encodeURIComponent(id)}/resend?lang=${encodeURIComponent(lang)}`,
    {}
  );
}

export function revokeInvitation(id: string) {
  return sendEmpty("DELETE", `${invitationsKey}/${encodeURIComponent(id)}`);
}

export function createTeam(request: TeamRequest) {
  return sendJson<Team>("POST", teamsKey, request);
}

export function updateTeam(id: string, request: TeamRequest) {
  return sendJson<Team>(
    "PATCH",
    `${teamsKey}/${encodeURIComponent(id)}`,
    request
  );
}

export function deleteTeam(id: string) {
  return sendEmpty("DELETE", `${teamsKey}/${encodeURIComponent(id)}`);
}

export function setTeamMembers(id: string, userIds: string[]) {
  return sendJson<Team>(
    "PUT",
    `${teamsKey}/${encodeURIComponent(id)}/members`,
    { userIds }
  );
}

export function createBinding(request: BindingRequest) {
  return sendJson<Binding>("POST", bindingsKey, request);
}

export function deleteBinding(id: string) {
  return sendEmpty("DELETE", `${bindingsKey}/${encodeURIComponent(id)}`);
}

export function createServiceAccount(request: ServiceAccountRequest) {
  return sendJson<CreatedServiceAccount>("POST", serviceAccountsKey, request);
}

export function deleteServiceAccount(id: string) {
  return sendEmpty("DELETE", `${serviceAccountsKey}/${encodeURIComponent(id)}`);
}

export function setServiceAccountRoles(id: string, roles: string[]) {
  return sendJson<ServiceAccount>(
    "PUT",
    `${serviceAccountsKey}/${encodeURIComponent(id)}/roles`,
    { roles }
  );
}

/** Links the OAuth credential whose token the account's keys are exchanged for; null unlinks. */
export function setServiceAccountTokenCredential(
  id: string,
  credentialRef: string | null
) {
  return sendJson<ServiceAccount>(
    "PUT",
    `${serviceAccountsKey}/${encodeURIComponent(id)}/token-credential`,
    { credentialRef }
  );
}

export function createKey(accountId: string, request: KeyRequest) {
  return sendJson<CreatedKey>(
    "POST",
    `${serviceAccountsKey}/${encodeURIComponent(accountId)}/keys`,
    request
  );
}

export function revokeKey(accountId: string, id: string) {
  return sendEmpty(
    "DELETE",
    `${serviceAccountsKey}/${encodeURIComponent(accountId)}/keys/${encodeURIComponent(id)}`
  );
}

/** Replaces the team's organization-wide roles. Sub-account bindings stay. */
export function setTeamRoles(teamId: string, roles: string[]) {
  return sendJson<Team>(
    "PUT",
    `${teamsKey}/${encodeURIComponent(teamId)}/roles`,
    { roles }
  );
}

/** Adds every member of the organization's Alfresco group. */
export function acceptInvitation(token: string) {
  return sendJson<AcceptedInvitation>(
    "POST",
    "/app/api/me/invitations/accept",
    { token }
  );
}

/** Accepts one of the signed-in user's pending invitations. */
export function acceptInvitationById(id: string) {
  return sendJson<AcceptedInvitation>(
    "POST",
    `/app/api/me/invitations/${encodeURIComponent(id)}/accept`,
    {}
  );
}

/** Makes the organization the active one, so the app opens in it. */
export function switchOrganization(slug: string) {
  return sendJson<unknown>("POST", "/app/api/user/active-org", { slug });
}
