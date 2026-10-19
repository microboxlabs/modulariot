package com.microboxlabs.miot.symptoms.catalog.domain;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * A source of data symptom rules read. {@code tenantCode} is null for a
 * platform source every organization sees.
 *
 * @param root    the CEL variable rules use, such as {@code signal}
 * @param samples example objects, used to preview rules
 */
public record DataSource(
        UUID id,
        String tenantCode,
        String key,
        String name,
        SourceKind kind,
        String root,
        String cadence,
        List<SourceField> fields,
        List<Map<String, Object>> samples) {
}
