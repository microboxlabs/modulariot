package com.microboxlabs.miot.resource.dto;

import java.util.List;
import java.util.Map;

public record BulkSyncRequest(
    String sourceSystem,
    List<BulkSyncEntity> entities
) {
    public record BulkSyncEntity(
        String externalId,
        Map<String, Object> fields,
        Map<String, Object> sourceMetadata,
        Map<String, Object> aspectProperties
    ) {}
}
