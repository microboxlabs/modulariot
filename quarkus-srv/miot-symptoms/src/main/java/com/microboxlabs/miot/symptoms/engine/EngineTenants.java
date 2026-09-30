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
            String tenant = eq < 0 ? "" : entry.substring(0, eq).trim();
            List<String> ids = eq < 0 ? List.of()
                    : Arrays.stream(entry.substring(eq + 1).split("\\|", -1)).map(String::trim).toList();
            if (tenant.isEmpty() || ids.isEmpty() || ids.stream().anyMatch(String::isEmpty)) {
                throw new IllegalArgumentException(
                        "miot.symptoms.engine.clients: expected tenant=client[|client], got: " + entry);
            }
            out.put(tenant, ids);
        }
        return new EngineTenants(out);
    }

    /** The organization's engine client ids; empty when it has none, so it sees no engine data. */
    public List<String> clientIds(String tenantCode) {
        return clients.getOrDefault(tenantCode, List.of());
    }
}
