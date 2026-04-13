package com.microboxlabs.miot.core.api.dto;

/**
 * Request body for {@code PATCH /api/v1/orgs/{slug}}.
 *
 * <p>Null fields are left unchanged. A blank string means "clear this
 * field" (only valid for {@code displayName} and {@code taxId}; the
 * slug and name are immutable — rename the org by creating a new one).
 */
public record PatchOrganizationRequest(
        String displayName,
        String taxId) {
}
