package com.microboxlabs.miot.integrations.auth.google;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.integrations.auth.AuthResolutionException;
import com.microboxlabs.miot.integrations.auth.AuthStrategy;
import com.microboxlabs.miot.integrations.auth.ResolvedAuth;
import com.microboxlabs.miot.integrations.auth.oauth.OAuth2TokenException;
import com.microboxlabs.miot.integrations.domain.AuthType;
import jakarta.enterprise.context.ApplicationScoped;
import java.io.IOException;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.Signature;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.Set;

/**
 * The JWT-bearer grant a Google service account uses: a JWT signed with the account's
 * private key, exchanged at the token endpoint for an access token. No Google SDK.
 */
@ApplicationScoped
public class GoogleServiceAccountStrategy implements AuthStrategy<GoogleServiceAccountConfig> {

    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(10);
    private static final long ASSERTION_LIFETIME_SECONDS = 3600;
    private static final long DEFAULT_EXPIRES_IN_SECONDS = 3600;
    private static final String GRANT_TYPE = "urn:ietf:params:oauth:grant-type:jwt-bearer";

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    public GoogleServiceAccountStrategy() {
        this(HttpClient.newHttpClient(), new ObjectMapper(), Clock.systemUTC());
    }

    GoogleServiceAccountStrategy(HttpClient httpClient, ObjectMapper objectMapper, Clock clock) {
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    @Override
    public Set<AuthType> supportedTypes() {
        return Set.of(AuthType.GOOGLE_SERVICE_ACCOUNT);
    }

    @Override
    public ResolvedAuth resolve(GoogleServiceAccountConfig config) {
        String body = "grant_type=" + URLEncoder.encode(GRANT_TYPE, StandardCharsets.UTF_8)
                + "&assertion=" + signAssertion(config);
        HttpRequest request = HttpRequest.newBuilder(config.tokenUrl())
                .timeout(REQUEST_TIMEOUT)
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        HttpResponse<String> response;
        try {
            response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (IOException e) {
            throw new AuthResolutionException("Google token request failed", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new AuthResolutionException("Google token request interrupted", e);
        }

        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            String errorCode = errorCode(response.body());
            throw new OAuth2TokenException(
                    "Google token request failed with HTTP " + response.statusCode()
                            + (errorCode == null ? "" : " (" + errorCode + ")"),
                    response.statusCode(),
                    errorCode);
        }
        return parseToken(response.body());
    }

    /** The signed JWT, as three base64url parts. */
    String signAssertion(GoogleServiceAccountConfig config) {
        long now = clock.instant().getEpochSecond();
        String header = base64Url("{\"alg\":\"RS256\",\"typ\":\"JWT\"}");
        String claims;
        try {
            claims = base64Url(objectMapper.writeValueAsString(Map.of(
                    "iss", config.clientEmail(),
                    "scope", config.scope(),
                    "aud", config.tokenUrl().toString(),
                    "iat", now,
                    "exp", now + ASSERTION_LIFETIME_SECONDS)));
        } catch (IOException e) {
            throw new AuthResolutionException("Could not serialize the assertion", e);
        }
        String input = header + "." + claims;
        try {
            Signature signature = Signature.getInstance("SHA256withRSA");
            signature.initSign(privateKey(config.privateKeyPem()));
            signature.update(input.getBytes(StandardCharsets.US_ASCII));
            return input + "." + Base64.getUrlEncoder().withoutPadding().encodeToString(signature.sign());
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            // The cause could quote the key material it failed to parse.
            throw new AuthResolutionException("The private key is not a usable RSA key");
        }
    }

    /** Escaped line breaks, as a JSON key file carries them, are accepted. */
    private static PrivateKey privateKey(String pem) throws GeneralSecurityException {
        String body = pem.replace("\\n", "\n")
                .replace("-----BEGIN PRIVATE KEY-----", "")
                .replace("-----END PRIVATE KEY-----", "")
                .replaceAll("\\s", "");
        byte[] der = Base64.getDecoder().decode(body);
        return KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(der));
    }

    private static String base64Url(String text) {
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(text.getBytes(StandardCharsets.UTF_8));
    }

    /** Only the RFC 6749 {@code error} code, never the free-text description. */
    private String errorCode(String body) {
        if (body == null || body.isBlank()) {
            return null;
        }
        try {
            JsonNode error = objectMapper.readTree(body).get("error");
            return error == null || error.asText().isBlank() ? null : error.asText();
        } catch (IOException e) {
            return null;
        }
    }

    private ResolvedAuth parseToken(String body) {
        try {
            JsonNode json = objectMapper.readTree(body);
            JsonNode accessToken = json.get("access_token");
            if (accessToken == null || accessToken.asText().isBlank()) {
                throw new AuthResolutionException("Google token response did not include access_token");
            }
            long expiresIn = json.has("expires_in")
                    ? json.get("expires_in").asLong(DEFAULT_EXPIRES_IN_SECONDS)
                    : DEFAULT_EXPIRES_IN_SECONDS;
            return ResolvedAuth.headers(
                    Map.of("Authorization", "Bearer " + accessToken.asText()),
                    Instant.now(clock).plusSeconds(expiresIn));
        } catch (IOException e) {
            throw new AuthResolutionException("Google token response was not valid JSON", e);
        }
    }
}
