package com.microboxlabs.miot.fleet.directory;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;

/** What people set by hand for one asset: field overrides and document expiry dates. */
public record Profile(String organizationId, String assetId, Map<String, String> fields,
        Map<String, LocalDate> documents, String updatedBy, Instant updatedAt) {

    public static Profile empty(String organizationId, String assetId) {
        return new Profile(organizationId, assetId, Map.of(), Map.of(), null, null);
    }
}
