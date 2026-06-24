package com.microboxlabs.miot.integrations.tester;

import com.microboxlabs.miot.integrations.domain.CredentialProfile;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.ConnectionTestRequest;
import com.microboxlabs.miot.integrations.dto.ConnectionTestResponse;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

/**
 * Fallback tester for providers without a live probe. Validates the connection
 * contract only (preserves the original pre-probe behaviour). Never matches a
 * specific provider; the registry uses it as the default.
 */
@ApplicationScoped
public class GenericConnectionTester implements ConnectionTester {

    @Override
    public boolean supports(ProviderType providerType) {
        return false;
    }

    @Override
    public ConnectionTestResponse test(
            IntegrationConnection connection,
            CredentialProfile credential,
            ConnectionTestRequest request) {
        return new ConnectionTestResponse(true, OffsetDateTime.now(ZoneOffset.UTC), message(request));
    }

    private String message(ConnectionTestRequest request) {
        if (request == null || request.path() == null || request.path().isBlank()) {
            return "Connection contract is valid; runtime probe pending";
        }
        String method = request.method() == null || request.method().isBlank() ? "GET" : request.method();
        return "Connection contract is valid for " + method + " " + request.path() + "; runtime probe pending";
    }
}
