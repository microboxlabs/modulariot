package com.microboxlabs.miot.integrations.auth.oauth;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.integrations.auth.AuthResolutionException;
import com.microboxlabs.miot.integrations.auth.AuthStrategy;
import com.microboxlabs.miot.integrations.auth.ResolvedAuth;
import com.microboxlabs.miot.integrations.domain.AuthType;
import com.microboxlabs.miot.integrations.domain.TokenRequestFormat;
import jakarta.enterprise.context.ApplicationScoped;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

@ApplicationScoped
public class OAuth2ClientCredentialsStrategy implements AuthStrategy<OAuth2ClientCredentialsConfig> {

    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(10);
    private static final long DEFAULT_EXPIRES_IN_SECONDS = 3600;

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    public OAuth2ClientCredentialsStrategy() {
        this(HttpClient.newHttpClient(), new ObjectMapper());
    }

    OAuth2ClientCredentialsStrategy(HttpClient httpClient, ObjectMapper objectMapper) {
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
    }

    @Override
    public Set<AuthType> supportedTypes() {
        return Set.of(AuthType.OAUTH2_CLIENT_CREDENTIALS);
    }

    @Override
    public ResolvedAuth resolve(OAuth2ClientCredentialsConfig config) {
        HttpRequest request = buildTokenRequest(config);
        HttpResponse<String> response;
        try {
            response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (IOException e) {
            throw new AuthResolutionException("OAuth token request failed", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new AuthResolutionException("OAuth token request interrupted", e);
        }

        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new AuthResolutionException("OAuth token request failed with HTTP " + response.statusCode());
        }

        OAuthToken token = parseToken(response.body());
        return ResolvedAuth.headers(
                Map.of("Authorization", "Bearer " + token.accessToken()),
                token.expiresAt());
    }

    HttpRequest buildTokenRequest(OAuth2ClientCredentialsConfig config) {
        Map<String, String> params = tokenParams(config);
        if (config.tokenRequestFormat() == TokenRequestFormat.JSON) {
            return buildJsonRequest(config.tokenUrl(), params);
        }
        return buildFormRequest(config.tokenUrl(), params);
    }

    private Map<String, String> tokenParams(OAuth2ClientCredentialsConfig config) {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("grant_type", "client_credentials");
        params.put("client_id", config.clientId());
        params.put("client_secret", config.clientSecret());
        config.scope().filter(s -> !s.isBlank()).ifPresent(s -> params.put("scope", s));
        config.audience().filter(s -> !s.isBlank()).ifPresent(s -> params.put("audience", s));
        return params;
    }

    private HttpRequest buildFormRequest(URI tokenUrl, Map<String, String> params) {
        String body = encodeForm(params);
        return HttpRequest.newBuilder(tokenUrl)
                .timeout(REQUEST_TIMEOUT)
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();
    }

    private HttpRequest buildJsonRequest(URI tokenUrl, Map<String, String> params) {
        try {
            return HttpRequest.newBuilder(tokenUrl)
                    .timeout(REQUEST_TIMEOUT)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(params)))
                    .build();
        } catch (IOException e) {
            throw new AuthResolutionException("Could not serialize OAuth token request", e);
        }
    }

    private String encodeForm(Map<String, String> params) {
        StringBuilder body = new StringBuilder();
        params.forEach((key, value) -> {
            if (!body.isEmpty()) {
                body.append('&');
            }
            body.append(URLEncoder.encode(key, StandardCharsets.UTF_8));
            body.append('=');
            body.append(URLEncoder.encode(value, StandardCharsets.UTF_8));
        });
        return body.toString();
    }

    private OAuthToken parseToken(String body) {
        try {
            JsonNode json = objectMapper.readTree(body);
            JsonNode accessToken = json.get("access_token");
            if (accessToken == null || accessToken.asText().isBlank()) {
                throw new AuthResolutionException("OAuth response did not include access_token");
            }
            long expiresIn = json.has("expires_in")
                    ? json.get("expires_in").asLong(DEFAULT_EXPIRES_IN_SECONDS)
                    : DEFAULT_EXPIRES_IN_SECONDS;
            return new OAuthToken(accessToken.asText(), Instant.now().plusSeconds(expiresIn));
        } catch (IOException e) {
            throw new AuthResolutionException("OAuth response was not valid JSON", e);
        }
    }

    private record OAuthToken(String accessToken, Instant expiresAt) {
    }
}
