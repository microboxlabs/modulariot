package com.microboxlabs.miot.core.auth;

import jakarta.enterprise.context.RequestScoped;

/**
 * Holds the resolved tenant for the current request.
 * Populated by TenantRequestFilter from JWT claims or dev header.
 */
@RequestScoped
public class TenantContext {

    private String clientId;
    private String tenantCode;
    private Long tenantId;

    public String getClientId() {
        return clientId;
    }

    public void setClientId(String clientId) {
        this.clientId = clientId;
    }

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
