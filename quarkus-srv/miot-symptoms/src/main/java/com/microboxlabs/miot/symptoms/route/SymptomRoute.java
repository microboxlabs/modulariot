package com.microboxlabs.miot.symptoms.route;

import java.util.List;
import java.util.Objects;
import java.util.regex.Pattern;

/**
 * One dispatcher route: a set of {@code rule_id}s mapped to an optional
 * Postgres function and an optional webhook.
 *
 * <p>This is the bootstrap shape. Superadmin settings will persist the same
 * fields later; do not invent a parallel model.
 */
public record SymptomRoute(
        String name,
        List<String> targetIds,
        List<String> excludeIds,
        String postgresFunction,
        String webhookUrl,
        int concurrency,
        int timeoutSeconds) {

    private static final Pattern FUNCTION_NAME = Pattern.compile("[A-Za-z_][A-Za-z0-9_]*");

    public SymptomRoute {
        Objects.requireNonNull(name, "name");
        targetIds = List.copyOf(targetIds == null ? List.of() : targetIds);
        excludeIds = List.copyOf(excludeIds == null ? List.of() : excludeIds);
        if (name.isBlank()) {
            throw new IllegalArgumentException("route name must not be blank");
        }
        if (targetIds.isEmpty()) {
            throw new IllegalArgumentException("route " + name + " needs targetIds");
        }
        if (concurrency < 1) {
            throw new IllegalArgumentException("route " + name + " concurrency must be >= 1");
        }
        if (timeoutSeconds < 1) {
            throw new IllegalArgumentException("route " + name + " timeoutSeconds must be >= 1");
        }
        if (postgresFunction != null && postgresFunction.isBlank()) {
            postgresFunction = null;
        }
        if (webhookUrl != null && webhookUrl.isBlank()) {
            webhookUrl = null;
        }
        if (postgresFunction != null && !FUNCTION_NAME.matcher(postgresFunction).matches()) {
            throw new IllegalArgumentException(
                    "route " + name + " has illegal postgresFunction: " + postgresFunction);
        }
        if (postgresFunction == null && webhookUrl == null) {
            throw new IllegalArgumentException(
                    "route " + name + " must have postgresFunction and/or webhookUrl");
        }
    }

    public boolean isCatchAll() {
        return targetIds.contains("*");
    }

    public boolean hasPostgres() {
        return postgresFunction != null;
    }

    public boolean hasWebhook() {
        return webhookUrl != null;
    }

    public boolean accepts(int ruleId) {
        String id = Integer.toString(ruleId);
        if (excludeIds.contains(id)) {
            return false;
        }
        return isCatchAll() || targetIds.contains(id);
    }
}
