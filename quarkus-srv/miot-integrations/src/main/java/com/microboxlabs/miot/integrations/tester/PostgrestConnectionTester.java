package com.microboxlabs.miot.integrations.tester;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.integrations.domain.CredentialProfile;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.ConnectionTestRequest;
import com.microboxlabs.miot.integrations.dto.ConnectionTestResponse;
import com.microboxlabs.miot.integrations.service.OperationInvocationResult;
import com.microboxlabs.miot.integrations.service.PostgrestCatalog;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

/**
 * Live check for a POSTGREST connection: {@code GET {baseUrl}/} with the connection's
 * credential must return PostgREST's OpenAPI description.
 */
@ApplicationScoped
public class PostgrestConnectionTester implements ConnectionTester {
    private static final ObjectMapper JSON = new ObjectMapper();
    private final PostgrestCatalog catalog;

    @Inject
    public PostgrestConnectionTester(PostgrestCatalog catalog) {
        this.catalog = catalog;
    }

    @Override
    public boolean supports(ProviderType providerType) {
        return providerType == ProviderType.POSTGREST;
    }

    @Override
    public ConnectionTestResponse test(
            IntegrationConnection connection,
            CredentialProfile credential,
            ConnectionTestRequest request) {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        if (connection.baseUrl() == null) return fail(now, "Connection base URL is not set");
        OperationInvocationResult result;
        try {
            result = catalog.fetchSpec(connection);
        } catch (RuntimeException e) {
            return fail(now, "Could not reach PostgREST: " + e.getMessage());
        }
        if (!result.successful()) {
            return fail(now, "PostgREST answered HTTP " + result.status() + " — check the base URL and credential");
        }
        int functions = countFunctions(result.body());
        if (functions < 0) return fail(now, "The base URL did not return a PostgREST OpenAPI description");
        return new ConnectionTestResponse(true, now, "PostgREST OK — " + functions + " functions available");
    }

    private static int countFunctions(String body) {
        try {
            JsonNode paths = JSON.readTree(body).path("paths");
            if (!paths.isObject()) return -1;
            int count = 0;
            for (var names = paths.fieldNames(); names.hasNext(); ) {
                if (names.next().startsWith("/rpc/")) count++;
            }
            return count;
        } catch (Exception e) {
            return -1;
        }
    }

    private static ConnectionTestResponse fail(OffsetDateTime testedAt, String message) {
        return new ConnectionTestResponse(false, testedAt, message);
    }
}
