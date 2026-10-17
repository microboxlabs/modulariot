package com.microboxlabs.miot.fleet.directory;

import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** What people set by hand for one asset: field overrides and document expiry dates. */
public record Profile(String organizationId, String assetId, Map<String, String> fields,
        Map<String, LocalDate> documents, String updatedBy, Instant updatedAt) {

    /** Prefix of a {@link Change#field()} that names a document. */
    public static final String DOCUMENT = "document.";

    public static Profile empty(String organizationId, String assetId) {
        return new Profile(organizationId, assetId, Map.of(), Map.of(), null, null);
    }

    /** This profile with the changes applied. A null new value clears the field or document. */
    public Profile with(List<Change> changes) {
        Map<String, String> f = new LinkedHashMap<>(fields);
        Map<String, LocalDate> d = new LinkedHashMap<>(documents);
        String by = updatedBy;
        Instant at = updatedAt;
        for (Change c : changes) {
            if (c.field().startsWith(DOCUMENT)) {
                String key = c.field().substring(DOCUMENT.length());
                if (c.newValue() == null) {
                    d.remove(key);
                } else {
                    d.put(key, LocalDate.parse(c.newValue()));
                }
            } else if (c.newValue() == null) {
                f.remove(c.field());
            } else {
                f.put(c.field(), c.newValue());
            }
            by = c.changedBy();
            at = c.changedAt();
        }
        return new Profile(organizationId, assetId, f, d, by, at);
    }
}
