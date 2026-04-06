package com.microboxlabs.miot.core.alfresco;

import io.smallrye.mutiny.Uni;

/**
 * Checks user membership and roles in Alfresco groups/sites.
 * Alfresco is the source of truth for organization membership and permissions.
 *
 * personId  — Alfresco person ID, typically the user's email address
 * groupId   — Alfresco group ID (e.g., "GROUP_acme") or site shortname (e.g., "acme-logistics")
 *
 * Site roles: SITE_MANAGER, SITE_COLLABORATOR, SITE_CONTRIBUTOR, SITE_CONSUMER
 * Group roles: GROUP_ADMIN, GROUP_MEMBER
 */
public interface IAlfrescoMembershipClient {

    Uni<Boolean> isMember(String personId, String groupId);

    Uni<String> getRole(String personId, String groupId);
}
