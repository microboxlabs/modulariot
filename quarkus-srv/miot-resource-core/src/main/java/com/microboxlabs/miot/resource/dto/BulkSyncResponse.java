package com.microboxlabs.miot.resource.dto;

import java.util.List;

public record BulkSyncResponse(
    int created,
    int updated,
    int skipped,
    List<BulkSyncError> errors
) {
    public record BulkSyncError(
        String externalId,
        String message
    ) {}
}
