package com.microboxlabs.miot.core.auth;

import jakarta.enterprise.context.RequestScoped;
import java.util.List;

/**
 * Holds the resolved tenant for the current request.
 * Populated by TenantRequestFilter from JWT claims or dev header.
 */
@RequestScoped
public class TenantContext {

    private String clientId;
    private String tenantCode;
    private Long tenantId;
    /**
     * Effective client IDs for read-scoped queries.
     * For child orgs: single element [own clientId].
     * For parent orgs: [own clientId] + all direct children clientIds.
     * Falls back to [clientId] when not explicitly set.
     */
    private List<String> effectiveClientIds;

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

    public List<String> getEffectiveClientIds() {
        return effectiveClientIds != null ? effectiveClientIds : List.of(clientId);
    }

    public void setEffectiveClientIds(List<String> effectiveClientIds) {
        this.effectiveClientIds = effectiveClientIds;
    }
}
