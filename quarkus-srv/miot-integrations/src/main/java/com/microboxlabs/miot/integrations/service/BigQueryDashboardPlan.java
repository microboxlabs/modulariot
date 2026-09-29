package com.microboxlabs.miot.integrations.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.Set;

/** Operator-owned SQL and typed named values; no SQL interpolation or viewer job options. */
final class BigQueryDashboardPlan {
    private static final String QUERY_FIELD = "query";
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Set<String> TYPES = Set.of("STRING", "INT64", "FLOAT64", "NUMERIC", "BIGNUMERIC",
            "BOOL", "DATE", "DATETIME", "TIME", "TIMESTAMP");
    final String project;
    final String location;
    final long maximumBytesBilled;
    final ObjectNode query;

    BigQueryDashboardPlan(DashboardOperationPolicy.Plan plan, long hostByteCap) {
        JsonNode settings = plan.settings();
        project = identifier(settings, "projectId", "[a-z][a-z0-9-]{4,61}[a-z0-9]");
        location = identifier(settings, "location", "[A-Za-z0-9-]{2,64}");
        String sql = settings.path(QUERY_FIELD).asText("");
        if (sql.isBlank() || sql.length() > 65_536) throw refused();
        try {
            maximumBytesBilled = Long.parseLong(settings.path("maximumBytesBilled").asText());
        } catch (NumberFormatException e) {
            throw refused();
        }
        if (maximumBytesBilled < 1 || maximumBytesBilled > hostByteCap) throw refused();
        query = JSON.createObjectNode().put(QUERY_FIELD, sql).put("useLegacySql", false)
                .put("useQueryCache", true).put("maximumBytesBilled", Long.toString(maximumBytesBilled))
                .put("parameterMode", "NAMED");
        addParameters(plan);
    }

    private void addParameters(DashboardOperationPolicy.Plan plan) {
        var parameters = query.putArray("queryParameters");
        JsonNode types = plan.settings().path("parameterTypes");
        if (!types.isObject() || types.size() != plan.parameters().size()) throw refused();
        plan.parameters().fields().forEachRemaining(entry -> {
            String type = types.path(entry.getKey()).asText();
            JsonNode value = entry.getValue();
            boolean array = type.startsWith("ARRAY<") && type.endsWith(">");
            String scalarType = array ? type.substring(6, type.length() - 1) : type;
            if (!TYPES.contains(scalarType) || (array != value.isArray())) throw refused();
            var parameter = parameters.addObject().put("name", entry.getKey());
            var descriptor = parameter.putObject("parameterType");
            var argument = parameter.putObject("parameterValue");
            if (array) {
                descriptor.put("type", "ARRAY").putObject("arrayType").put("type", scalarType);
                var items = argument.putArray("arrayValues");
                value.forEach(item -> scalar(items.addObject(), item));
            } else {
                descriptor.put("type", scalarType);
                scalar(argument, value);
            }
        });
    }

    ObjectNode job(String jobId, boolean dryRun) {
        ObjectNode job = JSON.createObjectNode();
        var reference = job.putObject("jobReference").put("projectId", project).put("location", location);
        if (jobId != null) reference.put("jobId", jobId);
        var configuration = job.putObject("configuration").put("dryRun", dryRun).put("jobTimeoutMs", "20000");
        configuration.set(QUERY_FIELD, query.deepCopy());
        return job;
    }

    void checkDryRun(JsonNode response) {
        JsonNode statistics = response.path("statistics");
        if (!"SELECT".equals(statistics.path(QUERY_FIELD).path("statementType").asText())) throw refused();
        try {
            long bytes = Long.parseLong(statistics.path("totalBytesProcessed").asText());
            if (bytes < 0 || bytes > maximumBytesBilled) throw refused();
        } catch (NumberFormatException e) {
            throw refused();
        }
    }

    private static String identifier(JsonNode settings, String name, String pattern) {
        String value = settings.path(name).asText();
        if (!value.matches(pattern)) throw refused();
        return value;
    }

    private static void scalar(ObjectNode result, JsonNode value) {
        if (value.isNull()) result.putNull("value");
        else if (value.isValueNode()) result.put("value", value.asText());
        else throw refused();
    }

    private static OperationInvocationException refused() {
        return new OperationInvocationException("BigQuery dashboard operation is not permitted");
    }
}
