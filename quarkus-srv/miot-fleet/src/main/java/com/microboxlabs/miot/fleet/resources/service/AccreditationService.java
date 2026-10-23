package com.microboxlabs.miot.fleet.resources.service;

import com.microboxlabs.miot.fleet.resources.domain.ResourceAttribute;
import com.microboxlabs.miot.fleet.resources.dto.AttributeRequest;
import com.microboxlabs.miot.fleet.resources.store.AccreditationStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

/** Accreditation: resource attributes with validity; the feed upserts, the operation asks "who is accredited". */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.fleet.enabled", stringValue = "true")
public class AccreditationService {

    /** Without an explicit filter, these values count as accredited/valid. */
    private static final List<String> DEFAULT_OK = List.of("ACCREDITED", "VALID");

    private final AccreditationStore store;

    @Inject
    public AccreditationService(AccreditationStore store) {
        this.store = store;
    }

    public ResourceAttribute upsert(String tenantCode, String actor, AttributeRequest body) {
        AttributeRequest req = body == null ? AttributeRequest.empty() : body;
        String type = Check.oneOf(Check.required(req.resourceType(), "resourceType", 16), "resourceType",
                "carrier", "truck", "trailer", "driver");
        String resourceId = Check.required(req.resourceId(), "resourceId", 64);
        ResourceService.parse(resourceId, "resourceId");
        return store.upsert(new ResourceAttribute(null, tenantCode, type, resourceId,
                Check.required(req.attributeType(), "attributeType", 64),
                Check.required(req.attributeKey(), "attributeKey", 64),
                Check.limitedOrNull(req.attributeValue(), "attributeValue", 64),
                req.context() == null ? null : req.context().toString(),
                req.validFrom(), req.validUntil(),
                Check.limitedOrNull(req.sourceSystem(), "sourceSystem", 64),
                null, actor, null, actor));
    }

    public List<ResourceAttribute> listByResource(String tenantCode, String resourceType, UUID resourceId) {
        Check.oneOf(resourceType, "resourceType", "carrier", "truck", "trailer", "driver");
        return store.listByResource(tenantCode, resourceType, resourceId);
    }

    public List<AccreditationStore.AccreditedRow> accredited(String tenantCode, String attributeType,
            String attributeKey, String values, String at) {
        String type = attributeType == null || attributeType.isBlank()
                ? ResourceAttribute.SITE_ACCREDITATION : attributeType;
        String key = Check.required(attributeKey, "attributeKey", 64);
        List<String> ok = values == null || values.isBlank() ? DEFAULT_OK : List.of(values.split(","));
        OffsetDateTime when = at == null || at.isBlank() ? OffsetDateTime.now(ZoneOffset.UTC)
                : OffsetDateTime.parse(at);
        return store.accredited(tenantCode, type, key, ok, when);
    }
}
