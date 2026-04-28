package com.microboxlabs.miot.core.api.dto;

import com.microboxlabs.miot.core.model.Organization;

/**
 * Flat projection of an {@link Organization} row for write-side
 * responses ({@code POST /children}, {@code PATCH}, {@code DELETE}).
 * Distinct from {@link OrganizationScopeDto} which is specific to
 * {@code /me/scopes} and carries role / effectiveTaxIds / modules.
 */
public record OrganizationDto(
        Long id,
        String slug,
        String name,
        String displayName,
        String taxId,
        String alfrescoGroupId,
        String tenantClientId,
        Long parentId,
        boolean active) {

    public static OrganizationDto from(Organization org) {
        return new OrganizationDto(
                org.id,
                org.slug,
                org.name,
                org.displayName,
                org.taxId,
                org.alfrescoGroupId,
                org.tenantClientId,
                org.parent != null ? org.parent.id : null,
                org.active);
    }
}
