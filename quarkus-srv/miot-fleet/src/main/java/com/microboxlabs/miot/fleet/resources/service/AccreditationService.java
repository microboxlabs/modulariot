package com.microboxlabs.miot.fleet.resources.service;

import com.microboxlabs.miot.fleet.resources.domain.ResourceAttribute;
import com.microboxlabs.miot.fleet.resources.dto.AttributeRequest;
import com.microboxlabs.miot.fleet.resources.store.AccreditationStore;
import com.microboxlabs.miot.fleet.resources.store.ResourceStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

/** Accreditation: resource attributes with validity; the feed upserts, the operation asks "who is accredited". */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.fleet.enabled", stringValue = "true")
public class AccreditationService {

    private static final String CARRIER = "carrier";
    private static final String TRUCK = "truck";
    private static final String TRAILER = "trailer";
    private static final String DRIVER = "driver";
    private static final String RESOURCE_TYPE = "resourceType";

    /** Without an explicit filter, these values count as accredited/valid. */
    private static final List<String> DEFAULT_OK = List.of("ACCREDITED", "VALID");

    private final AccreditationStore store;
    private final ResourceStore resources;

    @Inject
    public AccreditationService(AccreditationStore store, ResourceStore resources) {
        this.store = store;
        this.resources = resources;
    }

    public ResourceAttribute upsert(String tenantCode, String actor, AttributeRequest body) {
        AttributeRequest req = body == null ? AttributeRequest.empty() : body;
        String type = Check.oneOf(Check.required(req.resourceType(), RESOURCE_TYPE, 16), RESOURCE_TYPE,
                CARRIER, TRUCK, TRAILER, DRIVER);
        String resourceId = Check.required(req.resourceId(), "resourceId", 64);
        UUID id = ResourceService.parse(resourceId, "resourceId");
        boolean exists = switch (type) {
            case CARRIER -> resources.findCarrier(tenantCode, id).isPresent();
            case TRUCK -> resources.findTruck(tenantCode, id).isPresent();
            case TRAILER -> resources.findTrailer(tenantCode, id).isPresent();
            default -> resources.findDriver(tenantCode, id).isPresent();
        };
        if (!exists) {
            throw new IllegalArgumentException(type + " " + resourceId + " does not exist");
        }
        return store.upsert(new ResourceAttribute(null, tenantCode, type, resourceId,
                Check.required(req.attributeType(), "attributeType", 64),
                Check.required(req.attributeKey(), "attributeKey", 64),
                Check.limitedOrNull(req.attributeValue(), "attributeValue", 64),
                req.context() == null || req.context().isNull() ? null : req.context().toString(),
                req.validFrom(), req.validUntil(),
                Check.limitedOrNull(req.sourceSystem(), "sourceSystem", 64),
                null, actor, null, actor));
    }

    public List<ResourceAttribute> listByResource(String tenantCode, String resourceType, UUID resourceId) {
        Check.oneOf(resourceType, RESOURCE_TYPE, CARRIER, TRUCK, TRAILER, DRIVER);
        return store.listByResource(tenantCode, resourceType, resourceId);
    }

    public List<AccreditationStore.AccreditedRow> accredited(String tenantCode, String attributeType,
            String attributeKey, String values, String at) {
        String type = attributeType == null || attributeType.isBlank()
                ? ResourceAttribute.SITE_ACCREDITATION : attributeType;
        String key = Check.required(attributeKey, "attributeKey", 64);
        List<String> ok = values == null || values.isBlank() ? DEFAULT_OK
                : Arrays.stream(values.split(",")).map(String::trim).filter(v -> !v.isEmpty()).toList();
        OffsetDateTime when = at == null || at.isBlank() ? OffsetDateTime.now(ZoneOffset.UTC) : instant(at);
        return store.accredited(tenantCode, type, key, ok, when);
    }

    private static OffsetDateTime instant(String at) {
        try {
            return OffsetDateTime.parse(at);
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("at must be an ISO-8601 timestamp with offset, e.g. 2026-01-31T12:00:00Z");
        }
    }
}
