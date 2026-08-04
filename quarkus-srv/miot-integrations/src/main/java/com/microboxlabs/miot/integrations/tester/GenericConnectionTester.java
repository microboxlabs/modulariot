package com.microboxlabs.miot.integrations.tester;

import com.microboxlabs.miot.integrations.domain.CredentialProfile;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.ConnectionTestRequest;
import com.microboxlabs.miot.integrations.dto.ConnectionTestResponse;
import com.microboxlabs.miot.integrations.net.OutboundUrlGuard;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

/**
 * Fallback tester for providers without a live probe. Never matches a specific
 * provider; the registry uses it as the default.
 *
 * <p>No request is sent — for an arbitrary HTTP API there is no request known to be
 * safe — but the runtime's URL policy is still checkable offline: the dispatcher
 * refuses a base URL that resolves to an internal address, so a test that ignored
 * that would bless a connection every dispatch then rejects. That exact case
 * happened: a base URL of {@code http://localhost:8080} tested green and failed on
 * first use.
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
        if (connection.baseUrl() != null) {
            try {
                OutboundUrlGuard.requirePublicHttpUrl(connection.baseUrl(), "base URL");
            } catch (IllegalArgumentException e) {
                return new ConnectionTestResponse(false, OffsetDateTime.now(ZoneOffset.UTC),
                        e.getMessage() + " — the dispatcher will refuse this URL at runtime");
            }
        }
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
