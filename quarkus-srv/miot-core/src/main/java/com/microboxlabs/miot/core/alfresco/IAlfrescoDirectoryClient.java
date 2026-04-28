package com.microboxlabs.miot.core.alfresco;

import io.smallrye.mutiny.Uni;
import java.util.List;

/**
 * Read-only directory operations against Alfresco: listing group members
 * and searching the people directory. Complements
 * {@link IAlfrescoMembershipClient}, which handles per-user membership
 * and role checks.
 *
 * Write operations (create group, add/remove member) live on
 * {@link IAlfrescoGroupAdminClient}.
 */
public interface IAlfrescoDirectoryClient {

    /**
     * List members of an Alfresco group or site.
     *
     * @param groupId   Alfresco group ID (e.g. "GROUP_acme") or site shortname
     * @param maxItems  page size; implementations should cap at a reasonable maximum
     * @param skipCount pagination offset
     */
    Uni<List<AlfrescoPerson>> listGroupMembers(String groupId, int maxItems, int skipCount);

    /**
     * Search the Alfresco people directory by a free-text query.
     * Implementations should match against firstName, lastName, email and id.
     */
    Uni<List<AlfrescoPerson>> searchPeople(String query, int maxItems);
}
