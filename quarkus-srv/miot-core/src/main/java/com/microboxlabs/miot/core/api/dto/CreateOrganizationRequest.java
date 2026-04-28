package com.microboxlabs.miot.core.api.dto;

/**
 * Request body for {@code POST /api/v1/orgs/{parentSlug}/children}.
 *
 * <ul>
 *   <li>{@code slug} — URL-friendly identifier, unique across all orgs.</li>
 *   <li>{@code name} — internal name (required).</li>
 *   <li>{@code displayName} — human label shown in the UI; defaults to {@code name} if blank.</li>
 *   <li>{@code taxId} — national tax id, normalized by the active
 *       {@code TaxIdValidator}. Required for child sub-accounts since the
 *       whole point of a sub-account is to scope pgrest queries to a
 *       specific {@code cust_account}.</li>
 *   <li>{@code alfrescoGroupId} — optional override. When null, the server
 *       derives {@code GROUP_<uppercase-slug>} and creates it in Alfresco.</li>
 * </ul>
 */
public record CreateOrganizationRequest(
        String slug,
        String name,
        String displayName,
        String taxId,
        String alfrescoGroupId) {
}
