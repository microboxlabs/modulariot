package com.microboxlabs.miot.integrations.service;

import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.FilterMode;
import com.microboxlabs.miot.integrations.domain.GpsWebhookSubscription;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.domain.WebhookDelivery;
import com.microboxlabs.miot.integrations.domain.WebhookFilterSpec;
import com.microboxlabs.miot.integrations.dto.CreateGpsWebhookRequest;
import com.microboxlabs.miot.integrations.dto.GpsWebhookResponse;
import com.microboxlabs.miot.integrations.dto.GpsWebhookTestResponse;
import com.microboxlabs.miot.integrations.dto.UpdateGpsWebhookRequest;
import com.microboxlabs.miot.integrations.dto.WebhookDeliveryResponse;
import com.microboxlabs.miot.integrations.persistence.GpsWebhookSubscriptionRepository;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import com.microboxlabs.miot.integrations.persistence.WebhookDeliveryRepository;
import com.microboxlabs.miot.integrations.service.WebhookFilterCompiler.CompiledFilter;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jboss.logging.Logger;

@ApplicationScoped
public class GpsWebhookSubscriptionService {

    private static final Logger LOG = Logger.getLogger(GpsWebhookSubscriptionService.class);
    private static final Duration TEST_TIMEOUT = Duration.ofSeconds(10);

    private final GpsWebhookSubscriptionRepository subscriptionRepository;
    private final IntegrationConnectionRepository connectionRepository;
    private final WebhookDeliveryRepository deliveryRepository;
    private final WebhookFilterCompiler filterCompiler;
    private final HttpClient httpClient;

    @Inject
    public GpsWebhookSubscriptionService(
            GpsWebhookSubscriptionRepository subscriptionRepository,
            IntegrationConnectionRepository connectionRepository,
            WebhookDeliveryRepository deliveryRepository,
            WebhookFilterCompiler filterCompiler) {
        this(
                subscriptionRepository,
                connectionRepository,
                deliveryRepository,
                filterCompiler,
                HttpClient.newBuilder().connectTimeout(TEST_TIMEOUT).build());
    }

    GpsWebhookSubscriptionService(
            GpsWebhookSubscriptionRepository subscriptionRepository,
            IntegrationConnectionRepository connectionRepository,
            WebhookDeliveryRepository deliveryRepository,
            WebhookFilterCompiler filterCompiler,
            HttpClient httpClient) {
        this.subscriptionRepository = subscriptionRepository;
        this.connectionRepository = connectionRepository;
        this.deliveryRepository = deliveryRepository;
        this.filterCompiler = filterCompiler;
        this.httpClient = httpClient;
    }

    public List<GpsWebhookResponse> list(String tenantCode) {
        return subscriptionRepository.listByTenant(tenantCode).stream()
                .map(this::toResponse)
                .toList();
    }

    public GpsWebhookResponse get(String tenantCode, String subscriptionId) {
        GpsWebhookSubscription subscription = subscriptionRepository.findByTenantAndId(tenantCode, subscriptionId);
        return subscription == null ? null : toResponse(subscription);
    }

    public GpsWebhookResponse create(String tenantCode, CreateGpsWebhookRequest req) {
        validateCreate(req);
        CompiledFilter compiled = filterCompiler.compile(
                req.filterMode() == null ? FilterMode.ALL_VISIBLE : req.filterMode(),
                WebhookFilterSpec.fromMap(req.filter()));

        String connectionId = UUID.randomUUID().toString();
        IntegrationConnection connection = new IntegrationConnection(
                connectionId,
                tenantCode,
                req.name().trim(),
                ProviderType.GPS_WEBHOOK,
                req.url(),
                blankToNull(req.credentialProfileId()),
                ConnectionStatus.DRAFT,
                null,
                null,
                Map.of("kind", "gps_webhook"));
        connectionRepository.create(connection);

        String subscriptionId = UUID.randomUUID().toString();
        OffsetDateTime compiledAt = OffsetDateTime.now();
        boolean enabled = req.enabled() == null || req.enabled();
        GpsWebhookSubscription created = subscriptionRepository.create(
                subscriptionId,
                tenantCode,
                connectionId,
                req.name().trim(),
                enabled,
                compiled.filterMode(),
                compiled.spec().toMap(),
                compiled.includeAllVisible(),
                compiledAt,
                compiled.assetIds(),
                req.url().toString());
        return toResponse(created);
    }

    public GpsWebhookResponse update(String tenantCode, String subscriptionId, UpdateGpsWebhookRequest req) {
        GpsWebhookSubscription existing = subscriptionRepository.findByTenantAndId(tenantCode, subscriptionId);
        if (existing == null) {
            return null;
        }

        String nextName = req.name() == null ? null : requireName(req.name());
        String nextUrl = null;
        if (req.url() != null) {
            nextUrl = req.url().toString();
            connectionRepository.update(tenantCode, existing.connectionId(), nextName, nextUrl, null);
        } else if (nextName != null) {
            connectionRepository.update(tenantCode, existing.connectionId(), nextName, null, null);
        }

        CompiledFilter compiled = null;
        if (req.filterMode() != null || req.filter() != null) {
            FilterMode mode = req.filterMode() != null ? req.filterMode() : existing.filterMode();
            Map<String, Object> filterMap = req.filter() != null ? req.filter() : existing.filterJson();
            compiled = filterCompiler.compile(mode, WebhookFilterSpec.fromMap(filterMap));
        }

        GpsWebhookSubscription updated = subscriptionRepository.update(
                tenantCode,
                subscriptionId,
                nextName,
                req.enabled(),
                compiled == null ? null : compiled.filterMode(),
                compiled == null ? null : compiled.spec().toMap(),
                compiled == null ? null : compiled.includeAllVisible(),
                compiled == null ? null : OffsetDateTime.now(),
                compiled == null ? null : compiled.assetIds(),
                nextUrl != null ? nextUrl : existing.webhookUrl());
        return updated == null ? null : toResponse(updated);
    }

    public boolean delete(String tenantCode, String subscriptionId) {
        return subscriptionRepository.softDelete(tenantCode, subscriptionId);
    }

    public GpsWebhookResponse recompile(String tenantCode, String subscriptionId) {
        GpsWebhookSubscription existing = subscriptionRepository.findByTenantAndId(tenantCode, subscriptionId);
        if (existing == null) {
            return null;
        }
        CompiledFilter compiled = filterCompiler.compile(
                existing.filterMode(), WebhookFilterSpec.fromMap(existing.filterJson()));
        GpsWebhookSubscription updated = subscriptionRepository.update(
                tenantCode,
                subscriptionId,
                null,
                null,
                compiled.filterMode(),
                compiled.spec().toMap(),
                compiled.includeAllVisible(),
                OffsetDateTime.now(),
                compiled.assetIds(),
                existing.webhookUrl());
        return updated == null ? null : toResponse(updated);
    }

    public List<WebhookDeliveryResponse> listDeliveries(String tenantCode, String subscriptionId, int limit) {
        if (subscriptionRepository.findByTenantAndId(tenantCode, subscriptionId) == null) {
            return null;
        }
        return deliveryRepository.listBySubscription(tenantCode, subscriptionId, limit).stream()
                .map(this::toDeliveryResponse)
                .toList();
    }

    /**
     * Posts a synthetic {@code miot.gps.webhook@1} sample to the subscription URL.
     * Does not write a delivery ledger row (operator probe only).
     */
    public GpsWebhookTestResponse test(String tenantCode, String subscriptionId) {
        GpsWebhookSubscription subscription = subscriptionRepository.findByTenantAndId(tenantCode, subscriptionId);
        if (subscription == null) {
            return new GpsWebhookTestResponse(false, null, "Subscription not found", OffsetDateTime.now());
        }
        if (subscription.webhookUrl() == null || subscription.webhookUrl().isBlank()) {
            return new GpsWebhookTestResponse(false, null, "Webhook URL is missing", OffsetDateTime.now());
        }

        Map<String, Object> payload = samplePayload(subscription);
        String body = new io.vertx.core.json.JsonObject(payload).encode();
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(subscription.webhookUrl()))
                    .timeout(TEST_TIMEOUT)
                    .header("Content-Type", "application/json")
                    .header("User-Agent", "ModularIoT-GPS-Webhook-Test/1.0")
                    .header("X-Miot-Webhook-Test", "true")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            boolean success = response.statusCode() >= 200 && response.statusCode() < 300;
            String message = success
                    ? "Webhook accepted synthetic sample"
                    : "Webhook returned HTTP " + response.statusCode();
            return new GpsWebhookTestResponse(success, response.statusCode(), message, OffsetDateTime.now());
        } catch (Exception e) {
            LOG.warnf(e, "GPS webhook test failed for subscription %s", subscriptionId);
            return new GpsWebhookTestResponse(
                    false, null, "Request failed: " + e.getMessage(), OffsetDateTime.now());
        }
    }

    private void validateCreate(CreateGpsWebhookRequest req) {
        if (req == null) {
            throw new IllegalArgumentException("Request body is required");
        }
        requireName(req.name());
        if (req.url() == null) {
            throw new IllegalArgumentException("url is required");
        }
        String scheme = req.url().getScheme();
        if (scheme == null || !(scheme.equalsIgnoreCase("https") || scheme.equalsIgnoreCase("http"))) {
            throw new IllegalArgumentException("url must be http or https");
        }
    }

    private static String requireName(String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("name is required");
        }
        String trimmed = name.trim();
        if (trimmed.length() > 160) {
            throw new IllegalArgumentException("name must be at most 160 characters");
        }
        return trimmed;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private Map<String, Object> samplePayload(GpsWebhookSubscription subscription) {
        Map<String, Object> gps = new LinkedHashMap<>();
        gps.put("latitude", -33.4489);
        gps.put("longitude", -70.6693);
        gps.put("speed", 0);
        gps.put("heading", 0);

        Map<String, Object> telecom = new LinkedHashMap<>();
        telecom.put("gps_provider", "sample");

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("spec", "miot.gps.webhook@1");
        payload.put("subscription_id", subscription.id());
        payload.put("delivered_at", OffsetDateTime.now().toString());
        payload.put("request_id", "test-" + UUID.randomUUID());
        payload.put("ingest_client_id", "test-client");
        payload.put("asset_id", subscription.compiledAssetIds().isEmpty()
                ? "SAMPLE-ASSET"
                : subscription.compiledAssetIds().get(0));
        payload.put("timestamp", OffsetDateTime.now().toString());
        payload.put("gps", gps);
        payload.put("telecom", telecom);
        payload.put("owner", "sample");
        payload.put("type", "Truck");
        payload.put("enrichment", Map.of("quality", "TEST"));
        return payload;
    }

    private GpsWebhookResponse toResponse(GpsWebhookSubscription subscription) {
        return new GpsWebhookResponse(
                subscription.id(),
                subscription.tenantCode(),
                subscription.connectionId(),
                subscription.name(),
                subscription.webhookUrl(),
                subscription.enabled(),
                subscription.filterMode(),
                subscription.filterJson(),
                subscription.includeAllVisible(),
                subscription.compiledAssetIds(),
                subscription.compiledAt(),
                subscription.createdAt(),
                subscription.updatedAt());
    }

    private WebhookDeliveryResponse toDeliveryResponse(WebhookDelivery delivery) {
        return new WebhookDeliveryResponse(
                delivery.id(),
                delivery.subscriptionId(),
                delivery.tenantCode(),
                delivery.dedupeKey(),
                delivery.payload(),
                delivery.state(),
                delivery.attempts(),
                delivery.maxAttempts(),
                delivery.nextRetryAt(),
                delivery.lastStatusCode(),
                delivery.lastError(),
                delivery.createdAt(),
                delivery.updatedAt());
    }
}
