package com.microboxlabs.miot.core.api.dto;

/**
 * A top-level organization. {@code tenantClientId} is the Auth0 client id its data is stored under; without it a new
 * M2M application is created. {@code taxId} and {@code alfrescoGroupId} are optional; the Alfresco group receives the
 * organization's members for BPM tasks and documents.
 */
public record CreateRootOrganizationRequest(
        String slug,
        String name,
        String displayName,
        String tenantClientId,
        String taxId,
        String alfrescoGroupId) {
}
