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
 * Live check for a POSTGREST connection. {@code GET {baseUrl}/} with the credential must return
 * PostgREST's OpenAPI description, and an imported function must answer with the credential and
 * be refused without it.
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
        if (credential == null) return fail(now, "Link a credential to this connection");
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
        PostgrestCatalog.Probe probe;
        try {
            probe = catalog.probe(connection);
        } catch (RuntimeException e) {
            return fail(now, e.getMessage());
        }
        return verdict(now, probe);
    }

    private static ConnectionTestResponse verdict(OffsetDateTime now, PostgrestCatalog.Probe probe) {
        if (!successful(probe.withCredential())) {
            return fail(now, probe.function() + " answered HTTP " + probe.withCredential() + " with the credential");
        }
        if (successful(probe.withoutCredential())) {
            return fail(now, probe.function() + " also answers without a token: the credential is not what grants access");
        }
        return new ConnectionTestResponse(true, now, "PostgREST OK — " + probe.function()
                + " answers with the credential and is refused without it (HTTP " + probe.withoutCredential() + ")");
    }

    private static boolean successful(int status) {
        return status >= 200 && status < 300;
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
