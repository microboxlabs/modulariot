package com.microboxlabs.miot.core.auth;

import jakarta.enterprise.context.RequestScoped;

/**
 * Holds the resolved tenant for the current request.
 * Resolved from JWT claims (Auth0 / Entra ID).
 */
@RequestScoped
public class TenantContext {

    private String tenantCode;
    private Long tenantId;

    public String getTenantCode() {
        return tenantCode;
    }

    public void setTenantCode(String tenantCode) {
        this.tenantCode = tenantCode;
    }

    public Long getTenantId() {
        return tenantId;
    }

    public void setTenantId(Long tenantId) {
        this.tenantId = tenantId;
    }
}
