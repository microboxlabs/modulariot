package com.microboxlabs.miot.integrations.tester;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.domain.AuthType;
import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.CredentialType;
import com.microboxlabs.miot.integrations.domain.CredentialProfile;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.ConnectionTestResponse;
import com.microboxlabs.miot.integrations.service.OperationInvocationException;
import com.microboxlabs.miot.integrations.service.OperationInvocationResult;
import com.microboxlabs.miot.integrations.service.PostgrestCatalog;
import java.net.URI;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;

class PostgrestConnectionTesterTest {
    private static final IntegrationConnection CONNECTION = new IntegrationConnection("c1", "ACME", "Data",
            ProviderType.POSTGREST, URI.create("https://data.example"), "profile", ConnectionStatus.DRAFT,
            null, null, Map.of());
    private static final OperationInvocationResult SPEC = new OperationInvocationResult(200,
            "{\"paths\":{\"/\":{},\"/rpc/a\":{},\"/rpc/b\":{},\"/vehicles\":{}}}");

    private static ConnectionTestResponse test(Supplier<OperationInvocationResult> spec,
            Supplier<PostgrestCatalog.Probe> probe, CredentialProfile credential) {
        var tester = new PostgrestConnectionTester(new PostgrestCatalog(null, null, null, null) {
            @Override
            public OperationInvocationResult fetchSpec(IntegrationConnection connection) {
                return spec.get();
            }

            @Override
            public Probe probe(IntegrationConnection connection) {
                return probe.get();
            }
        });
        return tester.test(CONNECTION, credential, null);
    }

    private static ConnectionTestResponse test(PostgrestCatalog.Probe probe) {
        return test(() -> SPEC, () -> probe, credential());
    }

    /** The tester only checks that a credential is linked; the catalog applies it. */
    private static CredentialProfile credential() {
        OffsetDateTime now = OffsetDateTime.now();
        return new CredentialProfile("p1", "ACME", "PostgREST token", CredentialType.BEARER_TOKEN,
                AuthType.BEARER_TOKEN, "DEV", Map.of(), "encrypted", "****", 1, null, null, now, now, null, null);
    }

    @Test
    void passesWhenAnImportedFunctionNeedsTheCredential() {
        var result = test(new PostgrestCatalog.Probe("fn_summary", 200, 401));
        assertTrue(result.success());
        assertEquals("PostgREST OK — fn_summary answers with the credential and is refused without it (HTTP 401)",
                result.message());
    }

    @Test
    void failsWhenTheFunctionAlsoAnswersWithoutAToken() {
        var result = test(new PostgrestCatalog.Probe("fn_summary", 200, 200));
        assertFalse(result.success());
        assertTrue(result.message().contains("also answers without a token"));
    }

    @Test
    void failsWhenTheCredentialIsRejected() {
        assertFalse(test(new PostgrestCatalog.Probe("fn_summary", 401, 401)).success());
    }

    @Test
    void failsWithoutACredentialBeforeCallingPostgrest() {
        var result = test(() -> {
            throw new AssertionError("must not be called");
        }, () -> null, null);
        assertFalse(result.success());
        assertEquals("Link a credential to this connection", result.message());
    }

    @Test
    void failsOnAnUnusableDescriptionOrNoImportedFunction() {
        assertFalse(test(() -> new OperationInvocationResult(401, "{}"), () -> null, credential()).success());
        assertFalse(test(() -> new OperationInvocationResult(200, "<html></html>"), () -> null, credential())
                .success());
        var refused = test(() -> {
            throw new OperationInvocationException("connection base URL resolves to a disallowed address");
        }, () -> null, credential());
        assertTrue(refused.message().contains("disallowed address"));
        var nothingImported = test(() -> SPEC, () -> {
            throw new IllegalStateException("Import at least one function in Funciones");
        }, credential());
        assertFalse(nothingImported.success());
        assertTrue(nothingImported.message().startsWith("Import at least one function"));
    }

    @Test
    void supportsOnlyPostgrest() {
        var tester = new PostgrestConnectionTester(null);
        assertTrue(tester.supports(ProviderType.POSTGREST));
        assertFalse(tester.supports(ProviderType.CUSTOM_HTTP));
    }
}
