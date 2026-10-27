package com.microboxlabs.miot.fleet.resources.store;

import com.microboxlabs.miot.fleet.resources.domain.ResourceAttribute;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** Resource attributes (accreditation). Every call is tenant-scoped. */
public interface AccreditationStore {

    /** Upserts by the natural key (resource, attributeType, attributeKey); versioning keeps the history. */
    ResourceAttribute upsert(ResourceAttribute attribute);

    List<ResourceAttribute> listByResource(String tenantCode, String resourceType, UUID resourceId);

    /** The resources holding the attribute with one of the given values and a validity covering {@code at}. */
    List<AccreditedRow> accredited(String tenantCode, String attributeType, String attributeKey,
            List<String> values, OffsetDateTime at);

    record AccreditedRow(String resourceType, String resourceId, String label, String attributeValue,
            OffsetDateTime validUntil) {
    }
}
