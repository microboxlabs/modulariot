package com.microboxlabs.miot.core.alfresco.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Shape of a {@code /groups/{id}/members} entry. Alfresco returns a minimal
 * record here ({@code id}, {@code displayName}, {@code memberType}) — it does
 * NOT include the full person projection (no email, no firstName/lastName).
 *
 * <p>{@code memberType} is {@code "PERSON"} or {@code "GROUP"}. We filter to
 * people on the caller side; nested subgroups are intentionally ignored
 * (see plan: we don't model module entitlements as nested Alfresco groups).
 *
 * <p>Admin UI consumers that need the full person projection should resolve
 * each member's {@code id} against {@code /people/{id}} separately, or use
 * the richer entry on the {@code expanded} query param (not done here).
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record AlfrescoGroupMemberEntry(
        String id,
        String displayName,
        String memberType) {
}
