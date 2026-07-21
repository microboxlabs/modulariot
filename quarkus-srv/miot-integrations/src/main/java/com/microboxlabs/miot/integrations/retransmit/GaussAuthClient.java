package com.microboxlabs.miot.integrations.retransmit;

import io.vertx.core.json.JsonObject;
import jakarta.enterprise.context.ApplicationScoped;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;
import java.util.concurrent.locks.ReentrantLock;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Gauss Control auth for position upload.
 *
 * <p>Preferred (provider gateway): {@code X-Provider-Api-Key} + optional
 * {@code X-Target-Tenant}. Fallback: static bearer or OAuth password/refresh
 * (APG2 login docs).
 */
@ApplicationScoped
public class GaussAuthClient {

    private static final Logger LOG = Logger.getLogger(GaussAuthClient.class);
    private static final Duration HTTP_TIMEOUT = Duration.ofSeconds(15);
    /** Refresh a minute before expiry when expires_in is known. */
    private static final long SKEW_SECONDS = 60;

    private final Optional<String> providerApiKey;
    private final Optional<String> targetTenant;
    private final Optional<String> staticBearer;
    private final Optional<String> tokenUrl;
    private final Optional<String> clientId;
    private final Optional<String> clientSecret;
    private final Optional<String> username;
    private final Optional<String> password;
    private final HttpClient httpClient;
    private final ReentrantLock lock = new ReentrantLock();

    private String accessToken;
    private String refreshToken;
    private Instant accessExpiresAt = Instant.EPOCH;

    GaussAuthClient(
            @ConfigProperty(name = "miot.integrations.retransmit.gauss.provider-api-key")
                    Optional<String> providerApiKey,
            @ConfigProperty(name = "miot.integrations.retransmit.gauss.target-tenant")
                    Optional<String> targetTenant,
            @ConfigProperty(name = "miot.integrations.retransmit.gauss.bearer-token")
                    Optional<String> staticBearer,
            @ConfigProperty(name = "miot.integrations.retransmit.gauss.oauth-token-url")
                    Optional<String> tokenUrl,
            @ConfigProperty(name = "miot.integrations.retransmit.gauss.client-id")
                    Optional<String> clientId,
            @ConfigProperty(name = "miot.integrations.retransmit.gauss.client-secret")
                    Optional<String> clientSecret,
            @ConfigProperty(name = "miot.integrations.retransmit.gauss.username")
                    Optional<String> username,
            @ConfigProperty(name = "miot.integrations.retransmit.gauss.password")
                    Optional<String> password) {
        this.providerApiKey = providerApiKey.filter(s -> s != null && !s.isBlank());
        this.targetTenant = targetTenant.filter(s -> s != null && !s.isBlank());
        this.staticBearer = staticBearer.filter(s -> s != null && !s.isBlank());
        this.tokenUrl = tokenUrl.filter(s -> s != null && !s.isBlank());
        this.clientId = clientId.filter(s -> s != null && !s.isBlank());
        this.clientSecret = clientSecret.filter(s -> s != null && !s.isBlank());
        this.username = username.filter(s -> s != null && !s.isBlank());
        this.password = password.filter(s -> s != null && !s.isBlank());
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
    }

    /** Whether any Gauss auth mode is configured. */
    public boolean isConfigured() {
        if (providerApiKey.isPresent()) {
            return true;
        }
        if (staticBearer.isPresent()) {
            return true;
        }
        return tokenUrl.isPresent()
                && clientId.isPresent()
                && clientSecret.isPresent()
                && (username.isPresent() && password.isPresent() || refreshToken != null);
    }

    /**
     * Applies auth headers to a Gauss upload request.
     * Prefer provider API key; else OAuth/bearer {@code Authorization}.
     */
    public void applyAuthHeaders(HttpRequest.Builder req) {
        if (providerApiKey.isPresent()) {
            req.header("X-Provider-Api-Key", providerApiKey.get().trim());
            targetTenant.ifPresent(t -> req.header("X-Target-Tenant", t.trim()));
            return;
        }
        if (!isConfigured()) {
            LOG.warn("Gauss delivery without auth config — request will likely 401");
            return;
        }
        req.header("Authorization", "bearer " + getAccessToken());
    }

    /**
     * Returns a usable access token. Refreshes or re-authenticates as needed.
     *
     * @throws IllegalStateException if auth is not configured or login fails
     */
    public String getAccessToken() {
        if (providerApiKey.isPresent()) {
            throw new IllegalStateException("Gauss provider API key mode does not use bearer tokens");
        }
        if (staticBearer.isPresent()) {
            return staticBearer.get().trim();
        }
        lock.lock();
        try {
            if (accessToken != null && Instant.now().isBefore(accessExpiresAt.minusSeconds(SKEW_SECONDS))) {
                return accessToken;
            }
            if (refreshToken != null && !refreshToken.isBlank()) {
                try {
                    return requestToken(formRefresh(refreshToken));
                } catch (Exception e) {
                    LOG.warnf(e, "Gauss refresh_token failed; falling back to password grant");
                }
            }
            if (username.isEmpty() || password.isEmpty()) {
                throw new IllegalStateException(
                        "Gauss OAuth not configured (set bearer-token or oauth-token-url + client + user)");
            }
            return requestToken(formPassword(username.get(), password.get()));
        } finally {
            lock.unlock();
        }
    }

    /** Force next {@link #getAccessToken()} to re-login (e.g. after HTTP 401). */
    public void invalidate() {
        if (staticBearer.isPresent()) {
            return;
        }
        lock.lock();
        try {
            accessToken = null;
            accessExpiresAt = Instant.EPOCH;
        } finally {
            lock.unlock();
        }
    }

    private String requestToken(String formBody) {
        if (tokenUrl.isEmpty() || clientId.isEmpty() || clientSecret.isEmpty()) {
            throw new IllegalStateException("Gauss OAuth token URL / client credentials missing");
        }
        try {
            String basic = Base64.getEncoder()
                    .encodeToString((clientId.get() + ":" + clientSecret.get())
                            .getBytes(StandardCharsets.UTF_8));
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(tokenUrl.get().trim()))
                    .timeout(HTTP_TIMEOUT)
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .header("Authorization", "Basic " + basic)
                    .POST(HttpRequest.BodyPublishers.ofString(formBody))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException(
                        "Gauss OAuth HTTP " + response.statusCode() + ": " + truncate(response.body()));
            }
            JsonObject json = new JsonObject(response.body());
            String token = json.getString("access_token");
            if (token == null || token.isBlank()) {
                throw new IllegalStateException("Gauss OAuth response missing access_token");
            }
            accessToken = token.trim();
            String newRefresh = json.getString("refresh_token");
            if (newRefresh != null && !newRefresh.isBlank()) {
                refreshToken = newRefresh.trim();
            }
            long expiresIn = json.containsKey("expires_in") ? json.getLong("expires_in") : 3600L;
            accessExpiresAt = Instant.now().plusSeconds(Math.max(expiresIn, 60));
            LOG.debugf("Gauss OAuth token acquired expires_in=%ds", expiresIn);
            return accessToken;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Gauss OAuth interrupted", e);
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("Gauss OAuth failed: " + e.getMessage(), e);
        }
    }

    private static String formPassword(String user, String pass) {
        return "grant_type=password"
                + "&username=" + url(user)
                + "&password=" + url(pass);
    }

    private static String formRefresh(String refresh) {
        return "grant_type=refresh_token&refresh_token=" + url(refresh);
    }

    private static String url(String v) {
        return URLEncoder.encode(v, StandardCharsets.UTF_8);
    }

    private static String truncate(String s) {
        if (s == null) {
            return "";
        }
        return s.length() > 300 ? s.substring(0, 300) : s;
    }
}
