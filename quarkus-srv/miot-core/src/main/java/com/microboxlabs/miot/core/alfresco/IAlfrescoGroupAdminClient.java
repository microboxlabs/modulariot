package com.microboxlabs.miot.core.alfresco;

import io.smallrye.mutiny.Uni;

/**
 * Write-side Alfresco admin operations: create groups, mutate group
 * membership. Kept separate from {@link IAlfrescoDirectoryClient} so
 * read-only code paths can depend on the narrower surface.
 *
 * <p>Methods are intentionally imperative and side-effecting; callers
 * that need post-write verification should compose with
 * {@code IAlfrescoDirectoryClient}.
 */
public interface IAlfrescoGroupAdminClient {

    /**
     * Create a new Alfresco authority group. {@code groupId} should
     * follow the {@code GROUP_<UPPERCASE_SLUG>} convention.
     *
     * @return the created group's id (echoed back from Alfresco)
     */
    Uni<String> createGroup(String groupId, String displayName);

    /**
     * Add a person to a group. Idempotent at the API level — Alfresco
     * returns 409 if the person is already a member; implementations
     * should translate that into a successful no-op.
     */
    Uni<Void> addGroupMember(String groupId, String personId);

    /**
     * Remove a person from a group. 404 on a non-member is translated
     * into a successful no-op.
     */
    Uni<Void> removeGroupMember(String groupId, String personId);
}
