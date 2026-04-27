package com.microboxlabs.miot.integrations.dto;

import java.util.Map;

public record CreateIntegrationOperationRequest(
        String name,
        String method,
        String path,
        Map<String, Object> requestSchema,
        Map<String, Object> responseSchema,
        boolean testOperation) {
}
