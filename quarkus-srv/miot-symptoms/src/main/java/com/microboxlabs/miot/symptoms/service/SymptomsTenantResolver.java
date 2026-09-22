package com.microboxlabs.miot.symptoms.service;

import jakarta.enterprise.context.ApplicationScoped;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * Maps the org's {@code tenant_client_id} (what {@code TenantContext} carries)
 * to the {@code client_id} StreamHub stamps on {@code public.symptoms}. The two
 * differ for tenants whose symptoms are produced under a separate StreamHub
 * application; the mapping is operator configuration
 * ({@code miot.symptoms.client-id-map}), never inferred from data.
 */
@ApplicationScoped
public class SymptomsTenantResolver {

    private final Map<String, String> map;

    public SymptomsTenantResolver(
            @ConfigProperty(name = "miot.symptoms.client-id-map") Optional<String> spec) {
        this.map = parse(spec.orElse(""));
    }

    public String symptomsClientId(String tenantCode) {
        if (tenantCode == null) {
            throw new IllegalArgumentException("tenant is required");
        }
        return map.getOrDefault(tenantCode, tenantCode);
    }

    static Map<String, String> parse(String spec) {
        Map<String, String> out = new LinkedHashMap<>();
        if (spec == null || spec.isBlank()) {
            return out;
        }
        for (String pair : spec.split(",")) {
            int eq = pair.indexOf('=');
            if (eq <= 0 || eq == pair.length() - 1) {
                throw new IllegalArgumentException(
                        "miot.symptoms.client-id-map entries must be tenant=clientId, got: " + pair.trim());
            }
            out.put(pair.substring(0, eq).trim(), pair.substring(eq + 1).trim());
        }
        return out;
    }
}
