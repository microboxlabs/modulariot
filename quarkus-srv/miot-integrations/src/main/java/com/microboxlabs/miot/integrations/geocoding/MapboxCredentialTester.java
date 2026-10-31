package com.microboxlabs.miot.integrations.geocoding;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.integrations.domain.CredentialType;
import com.microboxlabs.miot.integrations.dto.CredentialTestResponse;
import com.microboxlabs.miot.integrations.tester.CredentialTester;
import jakarta.enterprise.context.ApplicationScoped;
import java.io.IOException;
import java.net.URI;
import java.time.OffsetDateTime;
import java.util.Map;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * Checks a Mapbox credential (a bearer token tagged {@code provider: mapbox}) against Mapbox's token endpoint, which
 * answers whether the token is valid without geocoding anything or counting against a quota.
 */
@ApplicationScoped
public class MapboxCredentialTester implements CredentialTester {

    static final String TAG = "mapbox";
    private static final ObjectMapper JSON = new ObjectMapper();

    private final URI baseUrl;

    public MapboxCredentialTester(
            @ConfigProperty(name = "miot.integrations.geocoding.mapbox.base-url",
                    defaultValue = "https://api.mapbox.com") URI baseUrl) {
        this.baseUrl = baseUrl;
    }

    @Override
    public boolean supports(CredentialType type) {
        return false;
    }

    @Override
    public boolean supports(CredentialType type, Map<String, Object> publicConfig) {
        return type == CredentialType.BEARER_TOKEN && TAG.equals(publicConfig.get("provider"));
    }

    @Override
    public CredentialTestResponse test(CredentialType type, Map<String, Object> publicConfig,
            Map<String, Object> secretConfig) {
        Object token = secretConfig == null ? null : secretConfig.get("token");
        return check(token instanceof String t ? t : null);
    }

    /** Asks Mapbox whether the token is valid; geocodes nothing. */
    public CredentialTestResponse check(String token) {
        if (token == null || token.isBlank()) {
            return CredentialTestResponse.failure("The credential has no token");
        }
        try {
            var response = GeocodingHttp.get(baseUrl, "/tokens/v2", Map.of("access_token", token.strip()));
            JsonNode body = response.body() == null || response.body().isBlank()
                    ? JSON.createObjectNode() : JSON.readTree(response.body());
            String code = body.path("code").asText("");
            if (response.statusCode() == 200 && "TokenValid".equals(code)) {
                JsonNode info = body.path("token");
                return new CredentialTestResponse(true, OffsetDateTime.now(java.time.ZoneOffset.UTC),
                        "Valid " + info.path("usage").asText("") + " token of " + info.path("user").asText("?"),
                        null);
            }
            return CredentialTestResponse.failure(
                    "Mapbox rejected the token: " + (code.isEmpty() ? "HTTP " + response.statusCode() : code));
        } catch (IOException e) {
            return CredentialTestResponse.failure(e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return CredentialTestResponse.failure("The token check was interrupted");
        }
    }
}
