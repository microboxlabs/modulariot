package com.microboxlabs.miot.core.api.dto;

import java.time.Instant;
import java.util.List;

/** Organization configuration for automatic multimedia review approval. */
public record ContentReviewPermissionDto(
        boolean enabled,
        String permissionCode,
        String roleCode,
        String alfrescoGroupId,
        List<String> assigneeIds,
        String projectionStatus,
        String projectionError,
        Instant projectedAt) {
}
