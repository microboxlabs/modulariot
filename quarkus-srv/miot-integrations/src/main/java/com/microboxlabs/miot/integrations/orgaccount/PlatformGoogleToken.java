package com.microboxlabs.miot.integrations.orgaccount;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

/**
 * The modulith's own Google access token, with no key: the GKE metadata server
 * (Workload Identity), or locally the user credentials that
 * {@code gcloud auth application-default login} writes. No Google SDK.
 */
public class PlatformGoogleToken {

    static final String METADATA_TOKEN_URL =
            "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";
    static final String TOKEN_URL = "https://oauth2.googleapis.com/token";
    private static final Duration TIMEOUT = Duration.ofSeconds(10);
    private static final Duration EARLY_REFRESH = Duration.ofSeconds(60);

    private final HttpClient http;
    private final ObjectMapper json;
    private final Clock clock;
    private final Optional<Path> adcFile;
    private final String metadataUrl;
    private final String tokenUrl;
    private String token;
    private Instant expiresAt = Instant.EPOCH;

    public PlatformGoogleToken(HttpClient http, ObjectMapper json, Clock clock, Optional<Path> adcFile) {
        this(http, json, clock, adcFile, METADATA_TOKEN_URL, TOKEN_URL);
    }

    PlatformGoogleToken(HttpClient http, ObjectMapper json, Clock clock, Optional<Path> adcFile,
            String metadataUrl, String tokenUrl) {
        this.http = http;
        this.json = json;
        this.clock = clock;
        this.adcFile = adcFile;
        this.metadataUrl = metadataUrl;
        this.tokenUrl = tokenUrl;
    }

    /** {@code GOOGLE_APPLICATION_CREDENTIALS}, else gcloud's well-known file when it exists. */
    public static Optional<Path> defaultAdcFile() {
        String env = System.getenv("GOOGLE_APPLICATION_CREDENTIALS");
        if (env != null && !env.isBlank()) return Optional.of(Path.of(env));
        Path wellKnown = Path.of(System.getProperty("user.home"), ".config", "gcloud",
                "application_default_credentials.json");
        return Files.isReadable(wellKnown) ? Optional.of(wellKnown) : Optional.empty();
    }

    public synchronized String get() {
        if (token != null && clock.instant().isBefore(expiresAt.minus(EARLY_REFRESH))) return token;
        HttpRequest request = adcFile.isPresent() ? refreshRequest(adcFile.get()) : metadataRequest();
        JsonNode body = GoogleCalls.send(http, json, request, "platform token");
        JsonNode accessToken = body.get("access_token");
        if (accessToken == null || accessToken.asText().isBlank()) {
            throw new GoogleCallException(502, "The platform token response had no access_token");
        }
        token = accessToken.asText();
        expiresAt = clock.instant().plusSeconds(body.path("expires_in").asLong(300));
        return token;
    }

    private HttpRequest metadataRequest() {
        return HttpRequest.newBuilder(URI.create(metadataUrl))
                .timeout(TIMEOUT)
                .header("Metadata-Flavor", "Google")
                .GET()
                .build();
    }

    /** Only {@code authorized_user} files: a key file is what this class exists to avoid. */
    private HttpRequest refreshRequest(Path file) {
        JsonNode credentials;
        try {
            credentials = json.readTree(Files.readString(file));
        } catch (IOException e) {
            throw new GoogleCallException(500, "Could not read the local Google credentials file");
        }
        if (!"authorized_user".equals(credentials.path("type").asText())) {
            throw new GoogleCallException(500, "Only authorized_user credentials are accepted locally");
        }
        String form = "grant_type=refresh_token"
                + "&client_id=" + encode(credentials.path("client_id").asText())
                + "&client_secret=" + encode(credentials.path("client_secret").asText())
                + "&refresh_token=" + encode(credentials.path("refresh_token").asText());
        return HttpRequest.newBuilder(URI.create(tokenUrl))
                .timeout(TIMEOUT)
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(form))
                .build();
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
