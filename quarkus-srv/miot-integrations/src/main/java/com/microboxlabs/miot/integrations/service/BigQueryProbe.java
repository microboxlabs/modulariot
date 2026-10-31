package com.microboxlabs.miot.integrations.service;

import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.IntegrationOperation;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Calls the BigQuery API with a connection's credential to check it, without running a
 * billed query: a dry-run job and a dataset listing.
 */
@ApplicationScoped
public class BigQueryProbe {
    public static final String BASE_URL = "https://bigquery.googleapis.com";
    private static final Pattern PROJECT_ID = Pattern.compile("[a-z][a-z0-9-]{4,61}[a-z0-9]");

    private final IntegrationConnectionResolver resolver;
    private final IntegrationOperationInvoker invoker;

    @Inject
    public BigQueryProbe(IntegrationConnectionResolver resolver, IntegrationOperationInvoker invoker) {
        this.resolver = resolver;
        this.invoker = invoker;
    }

    /** A connection the dashboards run BigQuery queries through: no template, the BigQuery API as base URL. */
    public static boolean isBigQuery(IntegrationConnection connection) {
        if (connection.templateId() != null || connection.baseUrl() == null) return false;
        String base = connection.baseUrl().toString();
        return BASE_URL.equals(base) || (BASE_URL + "/").equals(base);
    }

    public static boolean validProjectId(String projectId) {
        return projectId != null && PROJECT_ID.matcher(projectId).matches();
    }

    /** A dry run of {@code SELECT 1}: needs the bigquery scope and permission to create jobs, and bills nothing. */
    public OperationInvocationResult dryRun(IntegrationConnection connection, String projectId) {
        return invoker.execute(resolver.resolve(connection.tenantCode(), connection),
                operation(connection, "POST", "/bigquery/v2/projects/" + checked(projectId) + "/jobs"),
                Map.of("configuration", Map.of("dryRun", true,
                        "query", Map.of("query", "SELECT 1", "useLegacySql", false))));
    }

    /** The project's datasets the credential can see. */
    public OperationInvocationResult datasets(IntegrationConnection connection, String projectId) {
        return invoker.execute(resolver.resolve(connection.tenantCode(), connection),
                operation(connection, "GET", "/bigquery/v2/projects/" + checked(projectId) + "/datasets"),
                null);
    }

    private static IntegrationOperation operation(IntegrationConnection connection, String method, String path) {
        return new IntegrationOperation(null, connection.id(), "bigquery-probe", method, path,
                Map.of(), Map.of(), false);
    }

    private static String checked(String projectId) {
        if (!validProjectId(projectId)) throw new IllegalArgumentException("Invalid Google Cloud project id");
        return projectId;
    }
}
