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
}
