package com.microboxlabs.miot.core.alfresco.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Alfresco person JSON shape as returned by {@code /people} and
 * {@code /groups/{id}/members} (when the member is a person).
 * Only the fields consumed by the admin UI are declared — extras
 * are ignored.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record AlfrescoPersonEntry(
        String id,
        String firstName,
        String lastName,
        String displayName,
        String email) {
}
