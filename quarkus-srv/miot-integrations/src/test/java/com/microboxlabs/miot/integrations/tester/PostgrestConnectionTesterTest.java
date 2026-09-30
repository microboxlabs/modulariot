package com.microboxlabs.miot.integrations.tester;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.service.OperationInvocationException;
import com.microboxlabs.miot.integrations.service.OperationInvocationResult;
import com.microboxlabs.miot.integrations.service.PostgrestCatalog;
import java.net.URI;
import java.util.Map;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;

class PostgrestConnectionTesterTest {
    private static final IntegrationConnection CONNECTION = new IntegrationConnection("c1", "ACME", "Data",
            ProviderType.POSTGREST, URI.create("https://data.example"), "profile", ConnectionStatus.DRAFT,
            null, null, Map.of());

    private static PostgrestConnectionTester tester(Supplier<OperationInvocationResult> answer) {
        return new PostgrestConnectionTester(new PostgrestCatalog(null, null, null, null) {
            @Override
            public OperationInvocationResult fetchSpec(IntegrationConnection connection) {
                return answer.get();
            }
        });
    }

    @Test
    void passesWhenPostgrestDescribesItsFunctions() {
        var result = tester(() -> new OperationInvocationResult(200,
                "{\"paths\":{\"/\":{},\"/rpc/a\":{},\"/rpc/b\":{},\"/vehicles\":{}}}")).test(CONNECTION, null, null);
        assertTrue(result.success());
        assertEquals("PostgREST OK — 2 functions available", result.message());
        assertTrue(tester(() -> null).supports(ProviderType.POSTGREST));
        assertFalse(tester(() -> null).supports(ProviderType.CUSTOM_HTTP));
    }

    @Test
    void failsOnRejectedCredentialsNonPostgrestAnswersAndRefusedUrls() {
        assertFalse(tester(() -> new OperationInvocationResult(401, "{}")).test(CONNECTION, null, null).success());
        assertFalse(tester(() -> new OperationInvocationResult(200, "<html></html>")).test(CONNECTION, null, null)
                .success());
        var refused = tester(() -> {
            throw new OperationInvocationException("connection base URL resolves to a disallowed address");
        }).test(CONNECTION, null, null);
        assertFalse(refused.success());
        assertTrue(refused.message().contains("disallowed address"));
    }
}
