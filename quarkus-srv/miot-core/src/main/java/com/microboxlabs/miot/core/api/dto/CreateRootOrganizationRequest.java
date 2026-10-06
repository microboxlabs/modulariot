package com.microboxlabs.miot.core.api.dto;

/**
 * A top-level organization. {@code tenantClientId} is the client id its data is stored under; {@code taxId},
 * {@code alfrescoGroupId} and {@code membershipSource} (ALFRESCO or NATIVE) are optional.
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
