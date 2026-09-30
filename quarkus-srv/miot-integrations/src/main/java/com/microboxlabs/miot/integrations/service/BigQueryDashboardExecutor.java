package com.microboxlabs.miot.integrations.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.microboxlabs.miot.integrations.auth.CredentialAuthRegistry;
import com.microboxlabs.miot.integrations.auth.ResolvedAuth;
import com.microboxlabs.miot.integrations.domain.AuthType;
import com.microboxlabs.miot.integrations.net.BoundedHttpTransport;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.time.Duration;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/** Bounded Google REST jobs; SQL and budgets come only from the host operation policy. */
@ApplicationScoped
public class BigQueryDashboardExecutor {
    private static final String FIELDS = "fields";
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String ORIGIN = "https://bigquery.googleapis.com";
    private final CredentialAuthRegistry credentials;
    private final long hostByteCap;
    private final HttpClient client = HttpClient.newHttpClient();

    @Inject
    public BigQueryDashboardExecutor(CredentialAuthRegistry credentials,
            @ConfigProperty(name = "miot.dashboards.bigquery.maximum-bytes-billed", defaultValue = "1000000000") long hostByteCap) {
        if (hostByteCap < 1) throw new IllegalArgumentException("Positive BigQuery billing cap required");
        this.credentials = credentials;
        this.hostByteCap = hostByteCap;
    }

    public String execute(ResolvedConnection connection, DashboardOperationPolicy.Plan operation,
            DashboardOperationService.Limits limits) throws IOException, InterruptedException {
        if (!"BIGQUERY".equals(operation.kind()) || connection.authType() != AuthType.GOOGLE_SERVICE_ACCOUNT
                || !(ORIGIN.equals(String.valueOf(connection.baseUrl())) || (ORIGIN + "/").equals(String.valueOf(connection.baseUrl())))) {
            throw refused();
        }
        BigQueryDashboardPlan plan = new BigQueryDashboardPlan(operation, hostByteCap);
        long deadline = System.nanoTime() + Duration.ofSeconds(20).toNanos();
        ResolvedAuth auth = credentials.resolve(connection.authContext());
        String base = ORIGIN + "/bigquery/v2/projects/" + plan.project;
        JsonNode dry = call("POST", base + "/jobs", plan.job(null, true), auth, remaining(deadline), limits.maxBytes());
        plan.checkDryRun(dry);
        String jobId = "dashboard_" + UUID.randomUUID().toString().replace("-", "");
        boolean completed = false;
        try {
            call("POST", base + "/jobs", plan.job(jobId, false), auth, remaining(deadline), limits.maxBytes());
            JsonNode result;
            do {
                result = call("GET", base + "/queries/" + jobId + "?location=" + plan.location
                        + "&maxResults=" + (limits.maxRows() + 1) + "&timeoutMs=1000",
                        null, auth, remaining(deadline), limits.maxBytes());
                if (!result.path("jobComplete").asBoolean()) Thread.sleep(50);
            } while (!result.path("jobComplete").asBoolean());
            String rows = rows(result, limits.maxRows()).toString();
            completed = true;
            return rows;
        } finally {
            if (!completed) cancel(base, jobId, plan.location, auth);
        }
    }

    JsonNode call(String method, String url, JsonNode body, ResolvedAuth auth, Duration timeout, int maxBytes)
            throws IOException, InterruptedException {
        var builder = HttpRequest.newBuilder(URI.create(url)).timeout(timeout).header("Accept", "application/json");
        auth.headers().forEach(builder::header);
        if (body == null) builder.GET();
        else builder.header("Content-Type", "application/json").method(method, HttpRequest.BodyPublishers.ofString(body.toString()));
        var response = BoundedHttpTransport.send(client, builder.build(), maxBytes, timeout);
        if (response.statusCode() < 200 || response.statusCode() >= 300) throw refused();
        JsonNode result = JSON.readTree(response.body());
        if (result == null || !result.isObject() || result.has("error") || result.path("status").has("errorResult")
                || result.path("errors").size() > 0) throw refused();
        return result;
    }

    private void cancel(String base, String jobId, String location, ResolvedAuth auth) {
        try {
            call("POST", base + "/jobs/" + jobId + "/cancel?location=" + location,
                    JSON.createObjectNode(), auth, Duration.ofSeconds(2), 65_536);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (RuntimeException | IOException e) {
            // Best effort: the submitted job also carries its server-side deadline.
        }
    }

    private static Duration remaining(long deadline) throws IOException {
        long nanos = deadline - System.nanoTime();
        if (nanos < 1_000_000) throw new IOException("BigQuery deadline exceeded");
        return Duration.ofNanos(nanos);
    }

    private static ArrayNode rows(JsonNode result, int maxRows) {
        if (result.hasNonNull("pageToken") || !result.path("schema").path(FIELDS).isArray()) throw refused();
        JsonNode fields = result.path("schema").path(FIELDS);
        JsonNode data = result.path("rows");
        if (fields.size() > 100 || (!data.isMissingNode() && !data.isArray()) || data.size() > maxRows) throw refused();
        try {
            if (Long.parseLong(result.path("totalRows").asText()) != data.size()) throw refused();
        } catch (NumberFormatException e) {
            throw refused();
        }
        validateFields(fields);
        ArrayNode rows = JSON.createArrayNode();
        for (JsonNode row : data) {
            rows.add(convertRow(fields, row));
        }
        return rows;
    }

    private static JsonNode convertRow(JsonNode fields, JsonNode row) {
        JsonNode cells = row.path("f");
        if (!cells.isArray() || cells.size() != fields.size()) throw refused();
        var output = JSON.createObjectNode();
        for (int index = 0; index < fields.size(); index++) {
            JsonNode value = cells.get(index).get("v");
            if (value == null || !value.isValueNode()) throw refused();
            output.set(fields.get(index).path("name").asText(), value);
        }
        return output;
    }

    private static void validateFields(JsonNode fields) {
        Set<String> names = new HashSet<>();
        for (JsonNode field : fields) {
            if (!field.path("name").isTextual() || !names.add(field.path("name").asText())
                    || "REPEATED".equals(field.path("mode").asText()) || field.has(FIELDS)) throw refused();
        }
    }

    private static OperationInvocationException refused() {
        return new OperationInvocationException("BigQuery dashboard query could not be completed");
    }
}
