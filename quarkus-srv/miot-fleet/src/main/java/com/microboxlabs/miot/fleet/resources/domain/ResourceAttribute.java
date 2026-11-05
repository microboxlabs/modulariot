package com.microboxlabs.miot.fleet.resources.domain;

import java.time.OffsetDateTime;

/**
 * An attribute of a resource with validity: a site accreditation, a certification,
 * an insurance, a license. One per (resource, type, key); the feed upserts it.
 * Heir of ams.rd_resource_attributes.
 */
public record ResourceAttribute(
        String id,
        String tenantCode,
        String resourceType,
        String resourceId,
        String attributeType,
        String attributeKey,
        String attributeValue,
        String context,
        OffsetDateTime validFrom,
        OffsetDateTime validUntil,
        String sourceSystem,
        OffsetDateTime createdAt,
        String createdBy,
        OffsetDateTime updatedAt,
        String updatedBy) {

    public static final String SITE_ACCREDITATION = "SITE_ACCREDITATION";
    public static final String ACCREDITED = "ACCREDITED";
}
