package com.microboxlabs.miot.fleet.resources.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.OffsetDateTime;

/** Upsert body for a resource attribute (accreditation, certification, insurance, license). */
public record AttributeRequest(
        String resourceType,
        String resourceId,
        String attributeType,
        String attributeKey,
        String attributeValue,
        JsonNode context,
        OffsetDateTime validFrom,
        OffsetDateTime validUntil,
        String sourceSystem) {

    public static AttributeRequest empty() {
        return new AttributeRequest(null, null, null, null, null, null, null, null, null);
    }
}
