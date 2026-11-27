package com.microboxlabs.miot.teltonika.profile;

import java.time.OffsetDateTime;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * An organization's configuration profile ({@code miot_teltonika.config_profile}): Teltonika parameters
 * (frequency, ignition source, sleep, I/O) its devices should carry. The connection guide shows them,
 * they can be sent to a device, and intensive tracking falls back to them when it restores.
 */
public record ConfigProfile(UUID id, String tenantCode, String name, String description, String guideFamily,
        Map<Integer, String> params, OffsetDateTime createdAt, String createdBy, OffsetDateTime updatedAt,
        String updatedBy) {

    public ConfigProfile {
        params = Collections.unmodifiableMap(new LinkedHashMap<>(params));
    }

    /** Stored as {@code id:value;id:value}, the setparam syntax. */
    public String encoded() {
        StringBuilder sb = new StringBuilder();
        params.forEach((k, v) -> {
            if (!sb.isEmpty()) {
                sb.append(';');
            }
            sb.append(k).append(':').append(v);
        });
        return sb.toString();
    }

    public static Map<Integer, String> decode(String encoded) {
        Map<Integer, String> out = new LinkedHashMap<>();
        if (encoded == null || encoded.isBlank()) {
            return out;
        }
        for (String pair : encoded.split(";")) {
            int colon = pair.indexOf(':');
            out.put(Integer.parseInt(pair.substring(0, colon)), pair.substring(colon + 1));
        }
        return out;
    }
}
