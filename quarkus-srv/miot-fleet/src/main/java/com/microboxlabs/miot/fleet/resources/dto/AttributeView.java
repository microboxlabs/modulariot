package com.microboxlabs.miot.fleet.resources.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.microboxlabs.miot.fleet.resources.domain.ResourceAttribute;
import java.time.OffsetDateTime;

/** A resource attribute as the API serves it. */
public record AttributeView(
        String id,
        String resourceType,
        String resourceId,
        String attributeType,
        String attributeKey,
        String attributeValue,
        JsonNode context,
        OffsetDateTime validFrom,
        OffsetDateTime validUntil,
        String sourceSystem,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {

    public static AttributeView of(ResourceAttribute a) {
        return new AttributeView(a.id(), a.resourceType(), a.resourceId(), a.attributeType(),
                a.attributeKey(), a.attributeValue(), Jsons.node(a.context()), a.validFrom(), a.validUntil(),
                a.sourceSystem(), a.createdAt(), a.updatedAt());
    }
}
