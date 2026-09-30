package com.microboxlabs.miot.symptoms.engine;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Which engine client ids hold an organization's symptoms. The engine keys
 * rows by its own client id, which is not always the organization's tenant
 * code, so the mapping is configuration:
 * {@code miot.symptoms.engine.clients=tenant-a=clientX|clientY,tenant-b=clientZ}.
 */
public final class EngineTenants {

    private final Map<String, List<String>> clients;

    private EngineTenants(Map<String, List<String>> clients) {
        this.clients = clients;
    }

    public static EngineTenants parse(Optional<List<String>> entries) {
        Map<String, List<String>> out = new LinkedHashMap<>();
        for (String entry : entries.orElse(List.of())) {
            int eq = entry.indexOf('=');
            if (eq <= 0 || eq == entry.length() - 1) {
                throw new IllegalArgumentException(
                        "miot.symptoms.engine.clients: expected tenant=client[|client], got: " + entry);
            }
            List<String> ids = Arrays.stream(entry.substring(eq + 1).split("\\|"))
                    .map(String::trim).filter(s -> !s.isEmpty()).toList();
            out.put(entry.substring(0, eq).trim(), ids);
        }
        return new EngineTenants(out);
    }

    /** The organization's engine client ids; empty when it has none, so it sees no engine data. */
    public List<String> clientIds(String tenantCode) {
        return clients.getOrDefault(tenantCode, List.of());
    }
}
