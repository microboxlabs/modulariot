package com.microboxlabs.miot.integrations.tester;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.domain.AuthType;
import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.CredentialProfile;
import com.microboxlabs.miot.integrations.domain.CredentialType;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.service.BigQueryProbe;
import com.microboxlabs.miot.integrations.service.OperationInvocationResult;
import java.net.URI;
import java.time.OffsetDateTime;
import java.util.Map;
import org.junit.jupiter.api.Test;

class BigQueryConnectionTesterTest {
    private static final IntegrationConnection CONNECTION = new IntegrationConnection(
            IntegrationConnection.DRAFT_ID, "ACME", "Costs", ProviderType.CUSTOM_HTTP,
            URI.create("https://bigquery.googleapis.com"), "profile", ConnectionStatus.DRAFT,
            null, null, Map.of(), null);
    private static final OperationInvocationResult DATASETS = new OperationInvocationResult(200,
            "{\"datasets\":[{\"datasetReference\":{\"datasetId\":\"billing\"}},"
                    + "{\"datasetReference\":{\"datasetId\":\"fleet\"}}]}");

    private static BigQueryConnectionTester tester(OperationInvocationResult dryRun, OperationInvocationResult datasets) {
        return new BigQueryConnectionTester(new BigQueryProbe(null, null) {
            @Override
            public OperationInvocationResult dryRun(IntegrationConnection connection, String projectId) {
                return dryRun;
            }

            @Override
            public OperationInvocationResult datasets(IntegrationConnection connection, String projectId) {
                return datasets;
            }
        });
    }

    private static CredentialProfile credential(AuthType authType, Map<String, Object> publicConfig) {
        OffsetDateTime now = OffsetDateTime.now();
        return new CredentialProfile("p1", "ACME", "BigQuery", CredentialType.GOOGLE_SERVICE_ACCOUNT,
                authType, "PRODUCTION", publicConfig, "encrypted", "****", 1, null, null, now, now, null, null);
    }

    private static CredentialProfile serviceAccount() {
        return credential(AuthType.GOOGLE_SERVICE_ACCOUNT, Map.of("projectId", "acme-analytics"));
    }

    @Test
    void passesWhenTheAccountCanQueryAndListDatasets() {
        var result = tester(new OperationInvocationResult(200, "{}"), DATASETS).test(CONNECTION, serviceAccount(), null);
        assertTrue(result.success());
        assertTrue(result.message().contains("acme-analytics"), result.message());
        assertTrue(result.message().contains("2 datasets"), result.message());
    }

    @Test
    void failsNamingTheScopeWhenTheTestQueryIsRefused() {
        var refused = new OperationInvocationResult(403,
                "{\"error\":{\"message\":\"Request had insufficient authentication scopes.\"}}");
        var result = tester(refused, DATASETS).test(CONNECTION, serviceAccount(), null);
        assertFalse(result.success());
        assertTrue(result.message().contains("insufficient authentication scopes"), result.message());
        assertTrue(result.message().contains("auth/bigquery"), result.message());
    }

    @Test
    void failsWhenTheDatasetsCannotBeListed() {
        var result = tester(new OperationInvocationResult(200, "{}"), new OperationInvocationResult(403, "{}"))
                .test(CONNECTION, serviceAccount(), null);
        assertFalse(result.success());
        assertTrue(result.message().contains("Data Viewer"), result.message());
    }

    @Test
    void needsAGoogleServiceAccountWithAProject() {
        var ok = new OperationInvocationResult(200, "{}");
        assertFalse(tester(ok, DATASETS).test(CONNECTION, null, null).success());
        assertFalse(tester(ok, DATASETS)
                .test(CONNECTION, credential(AuthType.BEARER_TOKEN, Map.of("projectId", "acme-analytics")), null)
                .success());
        assertFalse(tester(ok, DATASETS)
                .test(CONNECTION, credential(AuthType.GOOGLE_SERVICE_ACCOUNT, Map.of()), null).success());
    }

    @Test
    void claimsOnlyTemplateLessConnectionsToTheBigQueryApi() {
        var tester = tester(null, null);
        assertTrue(tester.supports(CONNECTION));
        assertFalse(tester.supports(new IntegrationConnection("c", "ACME", "Partner", ProviderType.CUSTOM_HTTP,
                URI.create("https://partner.example"), null, ConnectionStatus.DRAFT, null, null, Map.of(), null)));
        assertFalse(tester.supports(new IntegrationConnection("c", "ACME", "From template", ProviderType.CUSTOM_HTTP,
                URI.create("https://bigquery.googleapis.com"), null, ConnectionStatus.DRAFT, null, null, Map.of(), "t1")));
    }
}
