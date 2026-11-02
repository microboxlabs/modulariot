package com.microboxlabs.miot.integrations.tester;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.integrations.domain.AuthType;
import com.microboxlabs.miot.integrations.domain.CredentialProfile;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.ConnectionTestRequest;
import com.microboxlabs.miot.integrations.dto.ConnectionTestResponse;
import com.microboxlabs.miot.integrations.orgaccount.ManagedGoogleIdentity;
import com.microboxlabs.miot.integrations.service.BigQueryProbe;
import com.microboxlabs.miot.integrations.service.OperationInvocationResult;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

/**
 * Live check for a BigQuery connection: with its Google service account, a dry run of
 * {@code SELECT 1} must be accepted (scope and job permission, nothing billed) and the
 * credential's project datasets must be listable.
 */
@ApplicationScoped
public class BigQueryConnectionTester implements ConnectionTester {
    private static final ObjectMapper JSON = new ObjectMapper();
    private final BigQueryProbe probe;

    @Inject
    public BigQueryConnectionTester(BigQueryProbe probe) {
        this.probe = probe;
    }

    @Override
    public boolean supports(ProviderType providerType) {
        return false;
    }

    @Override
    public boolean supports(IntegrationConnection connection) {
        return BigQueryProbe.isBigQuery(connection);
    }

    @Override
    public ConnectionTestResponse test(
            IntegrationConnection connection,
            CredentialProfile credential,
            ConnectionTestRequest request) {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        if (credential == null || credential.authType() != AuthType.GOOGLE_SERVICE_ACCOUNT) {
            return fail(now, "Link a Google service account credential to this connection");
        }
        Object value = credential.publicConfig() == null ? null : credential.publicConfig().get("projectId");
        String project = value == null ? null : value.toString();
        if (!BigQueryProbe.validProjectId(project)) {
            return fail(now, "The credential has no valid project id");
        }
        try {
            OperationInvocationResult dryRun = probe.dryRun(connection, project);
            if (!dryRun.successful()) {
                return fail(now, "BigQuery refused a test query (HTTP " + dryRun.status() + "): "
                        + errorMessage(dryRun.body())
                        + ". The scope must be https://www.googleapis.com/auth/bigquery and the account needs "
                        + "BigQuery Job User on " + project);
            }
            if (ManagedGoogleIdentity.isManaged(credential.publicConfig())) {
                // Its data is published to it from other projects; this one only runs its jobs.
                return new ConnectionTestResponse(true, now, "BigQuery OK — the organization's service account "
                        + "can run queries in " + project);
            }
            OperationInvocationResult datasets = probe.datasets(connection, project);
            if (!datasets.successful()) {
                return fail(now, "BigQuery refused to list datasets (HTTP " + datasets.status() + "): "
                        + errorMessage(datasets.body()) + ". The account needs BigQuery Data Viewer");
            }
            return new ConnectionTestResponse(true, now, "BigQuery OK — the service account can query "
                    + project + " and sees " + countDatasets(datasets.body()) + " datasets");
        } catch (RuntimeException e) {
            return fail(now, "Could not reach BigQuery: " + e.getMessage());
        }
    }

    private static int countDatasets(String body) {
        try {
            JsonNode datasets = JSON.readTree(body).path("datasets");
            return datasets.isArray() ? datasets.size() : 0;
        } catch (Exception e) {
            return 0;
        }
    }

    private static String errorMessage(String body) {
        try {
            String message = JSON.readTree(body).path("error").path("message").asText("");
            return message.isBlank() ? "no reason given" : message;
        } catch (Exception e) {
            return "no reason given";
        }
    }

    private static ConnectionTestResponse fail(OffsetDateTime testedAt, String message) {
        return new ConnectionTestResponse(false, testedAt, message);
    }
}
