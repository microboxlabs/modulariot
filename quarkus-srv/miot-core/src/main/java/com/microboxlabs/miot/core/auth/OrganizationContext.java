package com.microboxlabs.miot.core.auth;

import jakarta.enterprise.context.RequestScoped;

/**
 * Holds the resolved organization for the current request.
 * Populated by OrganizationRequestFilter from the URL path ({organizationId}).
 * Only set for org-scoped endpoints: /api/v1/orgs/{organizationId}/...
 */
@RequestScoped
public class OrganizationContext {

    private String organizationId;
    private String userEmail;
    private String alfrescoRole;
    private String alfrescoGroupId;

    public boolean isResolved() {
        return organizationId != null;
    }

    public String getOrganizationId() {
        return organizationId;
    }

    public void setOrganizationId(String organizationId) {
        this.organizationId = organizationId;
    }

    public String getUserEmail() {
        return userEmail;
    }

    public void setUserEmail(String userEmail) {
        this.userEmail = userEmail;
    }

    public String getAlfrescoRole() {
        return alfrescoRole;
    }

    public void setAlfrescoRole(String alfrescoRole) {
        this.alfrescoRole = alfrescoRole;
    }

    /**
     * The org's Alfresco group, as stored on the organization — a site group
     * ({@code GROUP_site_<siteId>}) for orgs backed by a site, a plain group
     * otherwise, and null for orgs with no group at all. Carried here so a
     * handler that needs the site behind the org does not re-query it.
     */
    public String getAlfrescoGroupId() {
        return alfrescoGroupId;
    }

    public void setAlfrescoGroupId(String alfrescoGroupId) {
        this.alfrescoGroupId = alfrescoGroupId;
    }
}
