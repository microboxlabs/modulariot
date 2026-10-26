package com.microboxlabs.miot.core.content;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.time.OffsetDateTime;

/**
 * A stored file. Modules keep its {@code id}, never its URL. {@code owner} names the record that uses it
 * ({@code trips:delivery_proof:<id>}); content without an owner is deleted after a grace period.
 */
public record Content(
        String id,
        String tenantCode,
        @JsonIgnore String contentUrl,
        String name,
        String mimetype,
        long size,
        String sha256,
        String owner,
        OffsetDateTime createdAt,
        String createdBy) {
}
