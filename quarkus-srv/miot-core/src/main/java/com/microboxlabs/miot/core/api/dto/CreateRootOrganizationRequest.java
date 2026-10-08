package com.microboxlabs.miot.core.api.dto;

/**
 * A top-level organization. {@code tenantClientId} is the Auth0 client id its data is stored under; without it a new
 * M2M application is created. {@code taxId}, {@code alfrescoGroupId} and {@code membershipSource} (ALFRESCO or
 * NATIVE) are optional.
 */
public record CreateRootOrganizationRequest(
        String slug,
        String name,
        String displayName,
        String tenantClientId,
        String taxId,
        String alfrescoGroupId,
        String membershipSource) {
}
