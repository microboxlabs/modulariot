"use client";

import useSWR from "swr";
import { getJson, sendEmpty, sendJson } from "../data/json-client";
import type {
  AccessCatalog,
  BaseRole,
  CreatedInvitation,
  Invitation,
  InviteRequest,
  MyAccess,
  TeamMember,
  TeamView,
  AcceptedInvitation,
} from "./team.types";

const TEAM = "/app/api/team";
export const membersKey = `${TEAM}/members`;
export const invitationsKey = `${TEAM}/invitations`;
const CATALOG = "/app/api/access/catalog";
const MY_ACCESS = "/app/api/me/access";

export function useTeam() {
  return useSWR<TeamView>(membersKey, getJson);
}

export function useInvitations(enabled: boolean) {
  return useSWR<Invitation[]>(enabled ? invitationsKey : null, getJson);
}

export function useAccessCatalog() {
  return useSWR<AccessCatalog>(CATALOG, getJson, { revalidateOnFocus: false });
}

/** The caller's permissions in the active organization. */
export function useMyAccess() {
  const { data } = useSWR<MyAccess>(MY_ACCESS, getJson, {
    revalidateOnFocus: false,
  });
  const can = (permission: string) =>
    data?.permissions.includes(permission) ?? false;
  return { access: data, can };
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

export function resendInvitation(id: string) {
  return sendJson<CreatedInvitation>(
    "POST",
    `${invitationsKey}/${encodeURIComponent(id)}/resend`,
    {}
  );
}

export function revokeInvitation(id: string) {
  return sendEmpty("DELETE", `${invitationsKey}/${encodeURIComponent(id)}`);
}

export function acceptInvitation(token: string) {
  return sendJson<AcceptedInvitation>(
    "POST",
    "/app/api/me/invitations/accept",
    { token }
  );
}

/** Makes the organization the active one, so the app opens in it. */
export function switchOrganization(slug: string) {
  return sendJson<unknown>("POST", "/app/api/user/active-org", { slug });
}
