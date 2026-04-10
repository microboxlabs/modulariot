package com.microboxlabs.miot.core.api.dto;

import java.util.List;

/**
 * One entry in the caller's resolved organization scopes (returned by {@code GET /api/v1/me/scopes}).
 *
 * <p>For parent orgs, {@code taxId} is null and {@code effectiveTaxIds} is the union of all
 * active child orgs' tax ids. For child orgs, {@code taxId} is populated and
 * {@code effectiveTaxIds} is a single-element list (or empty when the child's tax id is null).
 *
 * <p>{@code modules} lists the enabled product module codes for this org
 * (FLEET_MANAGEMENT, DASHBOARDS, COLLABORATORS_MANAGEMENT, ...).
 * The frontend uses this instead of the legacy {@code requiredGroups} hardcoding.
 */
public record OrganizationScopeDto(
        Long organizationId,
        String slug,
        String displayName,
        String taxId,
        String role,
        boolean isParent,
        List<String> effectiveTaxIds,
        List<String> modules) {
}
