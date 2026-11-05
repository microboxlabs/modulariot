package com.microboxlabs.miot.integrations.tester;

import com.microboxlabs.miot.integrations.domain.CredentialType;
import com.microboxlabs.miot.integrations.dto.CredentialTestResponse;
import com.microboxlabs.miot.integrations.telephony.TelnyxClient;
import jakarta.enterprise.context.ApplicationScoped;
import java.io.IOException;
import java.net.http.HttpResponse;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;

/**
 * Checks a Telnyx API key (a bearer token tagged {@code provider: telnyx}) on {@code GET /v2/balance}, which proves
 * the key without placing a call or spending credit. The SIP connection is checked by {@link TelnyxConnectionTester}.
 */
@ApplicationScoped
public class TelnyxCredentialTester implements CredentialTester {

    static final String TAG = "telnyx";

    private final TelnyxClient client;

    public TelnyxCredentialTester(TelnyxClient client) {
        this.client = client;
    }

    @Override
    public boolean supports(CredentialType type) {
        return false;
    }

    @Override
    public boolean supports(CredentialType type, Map<String, Object> publicConfig) {
        return type == CredentialType.BEARER_TOKEN && publicConfig != null && TAG.equals(publicConfig.get("provider"));
    }

    @Override
    public CredentialTestResponse test(CredentialType type, Map<String, Object> publicConfig,
            Map<String, Object> secretConfig) {
        Object token = secretConfig == null ? null : secretConfig.get("token");
        if (!(token instanceof String key) || key.isBlank()) {
            return CredentialTestResponse.failure("The credential has no API key");
        }
        try {
            HttpResponse<String> balance = client.balance(key.strip());
            int status = balance.statusCode();
            if (status >= 200 && status < 300) {
                return new CredentialTestResponse(true, OffsetDateTime.now(ZoneOffset.UTC),
                        "Telnyx accepted the API key", null);
            }
            if (status == 401 || status == 403) {
                return CredentialTestResponse.failure("Telnyx rejected the API key (HTTP " + status + ")");
            }
            return CredentialTestResponse.failure("Telnyx returned HTTP " + status + " for /v2/balance");
        } catch (IllegalArgumentException e) {
            // HttpRequest's invalid-header exception contains the secret: never expose or log it.
            return CredentialTestResponse.failure("The API key is not a valid HTTP bearer token");
        } catch (IOException e) {
            return CredentialTestResponse.failure("Could not reach Telnyx: " + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return CredentialTestResponse.failure("The Telnyx key check was interrupted");
        }
    }
}
