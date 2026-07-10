package com.microboxlabs.miot.integrations.domain;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Parsed {@code filter_json} document stored on a subscription.
 *
 * <pre>
 * {
 *   "scopes": { "allVisible": false, "assetIds": [...], ... },
 *   "match": "ALL"
 * }
 * </pre>
 */
public record WebhookFilterSpec(WebhookFilterScopes scopes, String match) {

    public static final String MATCH_ALL = "ALL";

    public WebhookFilterSpec {
        scopes = scopes == null ? WebhookFilterScopes.empty() : scopes;
        match = match == null || match.isBlank() ? MATCH_ALL : match.trim().toUpperCase();
    }

    public static WebhookFilterSpec allVisible() {
        return new WebhookFilterSpec(
                new WebhookFilterScopes(true, List.of(), List.of(), List.of(), List.of(), List.of()),
                MATCH_ALL);
    }

    public static WebhookFilterSpec fromMap(Map<String, Object> raw) {
        if (raw == null || raw.isEmpty()) {
            return allVisible();
        }
        String match = stringOr(raw.get("match"), MATCH_ALL);
        Object scopesRaw = raw.get("scopes");
        if (!(scopesRaw instanceof Map<?, ?> scopesMap)) {
            return new WebhookFilterSpec(WebhookFilterScopes.empty(), match);
        }
        return new WebhookFilterSpec(scopesFromMap(scopesMap), match);
    }

    public Map<String, Object> toMap() {
        Map<String, Object> scopesMap = new LinkedHashMap<>();
        scopesMap.put("allVisible", scopes.allVisible());
        scopesMap.put("assetIds", scopes.assetIds());
        scopesMap.put("carrierIds", scopes.carrierIds());
        scopesMap.put("ingestClientIds", scopes.ingestClientIds());
        scopesMap.put("gpsProviders", scopes.gpsProviders());
        scopesMap.put("owners", scopes.owners());

        Map<String, Object> root = new LinkedHashMap<>();
        root.put("scopes", scopesMap);
        root.put("match", match);
        return root;
    }

    @SuppressWarnings("unchecked")
    private static WebhookFilterScopes scopesFromMap(Map<?, ?> map) {
        return new WebhookFilterScopes(
                booleanOr(map.get("allVisible"), false),
                stringList(map.get("assetIds")),
                stringList(map.get("carrierIds")),
                stringList(map.get("ingestClientIds")),
                stringList(map.get("gpsProviders")),
                stringList(map.get("owners")));
    }

    private static List<String> stringList(Object value) {
        if (!(value instanceof List<?> list) || list.isEmpty()) {
            return List.of();
        }
        return list.stream().map(v -> v == null ? null : v.toString()).toList();
    }

    private static boolean booleanOr(Object value, boolean defaultValue) {
        if (value instanceof Boolean b) {
            return b;
        }
        if (value instanceof String s) {
            return Boolean.parseBoolean(s);
        }
        return defaultValue;
    }

    private static String stringOr(Object value, String defaultValue) {
        return value == null ? defaultValue : value.toString();
    }
}
