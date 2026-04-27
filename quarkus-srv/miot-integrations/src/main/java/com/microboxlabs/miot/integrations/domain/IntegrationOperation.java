package com.microboxlabs.miot.integrations.domain;

import java.util.Map;

public record IntegrationOperation(
        String id,
        String connectionId,
        String name,
        String method,
        String path,
        Map<String, Object> requestSchema,
        Map<String, Object> responseSchema,
        boolean testOperation) {
}
