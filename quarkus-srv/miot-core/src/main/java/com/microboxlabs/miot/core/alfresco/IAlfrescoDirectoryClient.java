package com.microboxlabs.miot.core.alfresco;

import io.smallrye.mutiny.Uni;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

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

    /** Every person in the group, nested groups included, read page by page. */
    default Uni<List<AlfrescoPerson>> listAllGroupMembers(String groupId) {
        return allPages(groupId, 0, new ArrayList<>());
    }

    private Uni<List<AlfrescoPerson>> allPages(String groupId, int skip, List<AlfrescoPerson> acc) {
        int page = 50;
        return listGroupMembers(groupId, page, skip).flatMap(people -> {
            acc.addAll(people);
            return people.size() < page ? Uni.createFrom().item(acc) : allPages(groupId, skip + page, acc);
        });
    }

    /**
     * The ids of the people who are members of the group themselves, not through a subgroup. Null when this
     * directory cannot tell.
     */
    default Uni<Set<String>> listDirectMemberIds(String groupId) {
        return Uni.createFrom().nullItem();
    }

    /**
     * Resolve a person's authoritative role in an Alfresco site.
     *
     * @return an Alfresco role such as {@code SiteManager}, or {@code null}
     *         when the person is not a member
     */
    Uni<String> getSiteRole(String personId, String siteId);

    /**
     * Search the Alfresco people directory by a free-text query.
     * Implementations should match against firstName, lastName, email and id.
     */
    Uni<List<AlfrescoPerson>> searchPeople(String query, int maxItems);
}
