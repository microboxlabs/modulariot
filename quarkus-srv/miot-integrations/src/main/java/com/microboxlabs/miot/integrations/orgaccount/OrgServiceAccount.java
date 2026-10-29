package com.microboxlabs.miot.integrations.orgaccount;

import java.time.OffsetDateTime;

public record OrgServiceAccount(
        String tenantCode,
        String projectId,
        String accountId,
        String email,
        String uniqueId,
        boolean disabled,
        OffsetDateTime createdAt,
        String createdBy,
        OffsetDateTime updatedAt,
        String updatedBy) {
}
