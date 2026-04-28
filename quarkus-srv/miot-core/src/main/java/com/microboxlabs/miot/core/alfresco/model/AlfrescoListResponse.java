package com.microboxlabs.miot.core.alfresco.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

/**
 * Common wrapper shape used by Alfresco's public REST API for list endpoints:
 *
 * <pre>
 * { "list": { "pagination": {...}, "entries": [ { "entry": {...} }, ... ] } }
 * </pre>
 *
 * This record ignores {@code pagination} for now — callers page via the
 * {@code skipCount} / {@code maxItems} request params.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record AlfrescoListResponse<T>(AlfrescoList<T> list) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AlfrescoList<T>(List<AlfrescoEntry<T>> entries) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AlfrescoEntry<T>(T entry) {
    }

    /** Flatten list → entries → entry, returning an empty list if any layer is null. */
    public List<T> unwrap() {
        if (list == null || list.entries == null) {
            return List.of();
        }
        return list.entries.stream()
                .map(AlfrescoEntry::entry)
                .filter(e -> e != null)
                .toList();
    }
}
