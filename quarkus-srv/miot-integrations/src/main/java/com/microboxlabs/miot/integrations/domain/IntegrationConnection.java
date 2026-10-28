package com.microboxlabs.miot.integrations.domain;

import java.net.URI;
import java.time.OffsetDateTime;
import java.util.Map;

public record IntegrationConnection(
        String id,
        String tenantCode,
        String name,
        ProviderType providerType,
        URI baseUrl,
        String credentialProfileId,
        ConnectionStatus status,
        OffsetDateTime lastTestedAt,
        Boolean lastTestResult,
        Map<String, Object> metadata,
        /** The template this connection is an instance of, or {@code null} for an ad-hoc connection. */
        String templateId) {

    /** The id of a connection being tested before it is saved. */
    public static final String DRAFT_ID = "draft";

    /** Whether this is a connection being tested before it is saved. */
    public boolean isDraft() {
        return DRAFT_ID.equals(id);
    }

    /** Back-compat: connections not created from a template carry no {@code templateId}. */
    public IntegrationConnection(
            String id,
            String tenantCode,
            String name,
            ProviderType providerType,
            URI baseUrl,
            String credentialProfileId,
            ConnectionStatus status,
            OffsetDateTime lastTestedAt,
            Boolean lastTestResult,
            Map<String, Object> metadata) {
        this(id, tenantCode, name, providerType, baseUrl, credentialProfileId,
                status, lastTestedAt, lastTestResult, metadata, null);
    }
}
