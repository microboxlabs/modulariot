package com.microboxlabs.miot.integrations.retransmit;

import com.microboxlabs.miot.integrations.domain.RetransmitDelivery;
import com.microboxlabs.miot.integrations.domain.WebhookDeliveryState;
import com.microboxlabs.miot.integrations.persistence.RetransmitDeliveryRepository;
import io.quarkus.scheduler.Scheduled;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import jakarta.enterprise.context.ApplicationScoped;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.jboss.logging.Logger;

/**
 * Claims PENDING retransmit outbox rows and POSTs payloads. Separate from the
 * Pulsar consume loop so slow destinations never nack the enriched topic.
 *
 * <p>When the destination is a Gauss Control position API (or
 * {@code miot.integrations.retransmit.payload-format=gauss}), the body is mapped
 * to <em>Inyección puntos GPS v2</em> (JSON array + Bearer auth).
 */
@ApplicationScoped
public class RetransmitDeliveryJob {

    private static final Logger LOG = Logger.getLogger(RetransmitDeliveryJob.class);
    private static final Duration HTTP_TIMEOUT = Duration.ofSeconds(15);
    /** Max chars of request/response body in traffic logs (full GPS points are small). */
    private static final int TRAFFIC_BODY_MAX = 16_384;

    private final RetransmitDeliveryRepository repository;
    private final GaussAuthClient gaussAuth;
    private final RetransmitDeliverySettings settings;
    private final String workerId;
    private final HttpClient httpClient;

    RetransmitDeliveryJob(
            RetransmitDeliveryRepository repository,
            GaussAuthClient gaussAuth,
            RetransmitDeliverySettings settings) {
        this.repository = repository;
        this.gaussAuth = gaussAuth;
        this.settings = settings;
        this.workerId = "retransmit-" + UUID.randomUUID().toString().substring(0, 8);
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
    }

    @Scheduled(every = "${miot.integrations.retransmit.claim-every:5s}", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void claimAndDeliver() {
        if (!settings.workerEnabled()) {
            return;
        }
        // Claim one row at a time so a slow HTTP POST cannot expire later leases
        // from a multi-row claim while this worker is still serializing delivery.
        int remaining = Math.max(settings.claimLimit(), 1);
        while (remaining-- > 0) {
            List<RetransmitDelivery> batch = repository.claim(workerId, 1, settings.leaseSeconds());
            if (batch.isEmpty()) {
                return;
            }
            deliverOne(batch.get(0));
        }
    }

    void deliverOne(RetransmitDelivery delivery) {
        UUID id = UUID.fromString(delivery.id());
        try {
            boolean gauss = useGaussFormat(delivery);
            String body;
            HttpRequest.Builder req = HttpRequest.newBuilder()
                    .uri(URI.create(delivery.destinationUrl()))
                    .timeout(HTTP_TIMEOUT)
                    .header("Content-Type", "application/json")
                    .header("User-Agent", "ModularIoT-Retransmit/1.0")
                    .header("X-Miot-Retransmit-Config", delivery.configId());

            if (gauss) {
                JsonObject payload = new JsonObject(delivery.payload());
                JsonArray gaussBody = GaussPositionMapper.toGaussBody(payload, settings.gaussDefaults());
                body = gaussBody.encode();
                gaussAuth.applyAuthHeaders(req);
            } else {
                body = new JsonObject(delivery.payload()).encode();
            }

            if (settings.logTraffic() && gauss) {
                logTrafficRequest(delivery, body, false);
            }

            HttpResponse<String> response = httpClient.send(
                    req.POST(HttpRequest.BodyPublishers.ofString(body)).build(),
                    HttpResponse.BodyHandlers.ofString());
            int code = response.statusCode();

            if (settings.logTraffic() && gauss) {
                logTrafficResponse(delivery, code, response.body(), false);
            }

            // One retry after re-auth on 401 for Gauss (OAuth/bearer; API-key mode is static)
            if (gauss && code == 401) {
                gaussAuth.invalidate();
                HttpRequest.Builder retry = HttpRequest.newBuilder()
                        .uri(URI.create(delivery.destinationUrl()))
                        .timeout(HTTP_TIMEOUT)
                        .header("Content-Type", "application/json")
                        .header("User-Agent", "ModularIoT-Retransmit/1.0")
                        .header("X-Miot-Retransmit-Config", delivery.configId());
                gaussAuth.applyAuthHeaders(retry);
                if (settings.logTraffic()) {
                    logTrafficRequest(delivery, body, true);
                }
                response = httpClient.send(
                        retry.POST(HttpRequest.BodyPublishers.ofString(body)).build(),
                        HttpResponse.BodyHandlers.ofString());
                code = response.statusCode();
                if (settings.logTraffic()) {
                    logTrafficResponse(delivery, code, response.body(), true);
                }
            }

            handleResponse(delivery, id, code, response.body(), gauss);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            failOrRetry(delivery, id, null, "interrupted: " + e.getMessage(), true);
        } catch (Exception e) {
            failOrRetry(delivery, id, null, e.getMessage(), true);
        }
    }

    private void handleResponse(
            RetransmitDelivery delivery, UUID id, int code, String responseBody, boolean gauss) {
        if (code >= 200 && code < 300) {
            repository.markSucceeded(id, workerId, code);
            LOG.infof(
                    "Retransmit delivered id=%s config=%s asset=%s status=%d gauss=%s",
                    delivery.id(),
                    delivery.configId(),
                    delivery.assetId(),
                    code,
                    gauss);
            return;
        }
        // Gauss 409 = partial business rejection (unknown vehicle/driver or validation).
        // Do not spin forever: mark DEAD with response snippet.
        if (gauss && code == 409) {
            String err = "Gauss 409: " + truncate(responseBody);
            repository.markRetryOrDead(
                    id, workerId, WebhookDeliveryState.DEAD, null, code, err);
            LOG.warnf(
                    "Retransmit DEAD (Gauss business reject) id=%s asset=%s %s",
                    delivery.id(),
                    delivery.assetId(),
                    err);
            return;
        }
        if (code == 401 || code == 403) {
            failOrRetry(delivery, id, code, "HTTP " + code + ": " + truncate(responseBody), false);
            return;
        }
        failOrRetry(delivery, id, code, "HTTP " + code + ": " + truncate(responseBody), true);
    }

    private boolean useGaussFormat(RetransmitDelivery delivery) {
        String format = settings.payloadFormat();
        if ("gauss".equals(format)) {
            return true;
        }
        if ("raw".equals(format) || "miot".equals(format)) {
            return false;
        }
        // auto
        String url = Optional.ofNullable(delivery.destinationUrl()).orElse("").toLowerCase(Locale.ROOT);
        return url.contains("gausscontrol")
                || url.contains("positionupdate")
                || url.contains("/processor/events/");
    }

    private void failOrRetry(
            RetransmitDelivery delivery, UUID id, Integer statusCode, String error, boolean retryable) {
        boolean exhausted = !retryable || delivery.attempts() >= delivery.maxAttempts();
        WebhookDeliveryState next = exhausted ? WebhookDeliveryState.DEAD : WebhookDeliveryState.PENDING;
        OffsetDateTime retryAt = exhausted ? null : nextRetryAt(delivery.attempts());
        repository.markRetryOrDead(id, workerId, next, retryAt, statusCode, truncate(error));
        if (exhausted) {
            LOG.warnf(
                    "Retransmit DEAD id=%s config=%s asset=%s error=%s",
                    delivery.id(),
                    delivery.configId(),
                    delivery.assetId(),
                    error);
        } else {
            LOG.warnf(
                    "Retransmit retry id=%s attempt=%d/%d error=%s",
                    delivery.id(),
                    delivery.attempts(),
                    delivery.maxAttempts(),
                    error);
        }
    }

    private OffsetDateTime nextRetryAt(int attempts) {
        long delay = Math.min(
                settings.retryMaxSeconds(),
                (long) settings.retryBaseSeconds() * (1L << Math.min(Math.max(attempts - 1, 0), 8)));
        return OffsetDateTime.now(ZoneOffset.UTC).plusSeconds(delay);
    }

    private static String truncate(String error) {
        if (error == null) {
            return null;
        }
        return error.length() > 1000 ? error.substring(0, 1000) : error;
    }

    /**
     * Traffic capture for Gauss POSTs. Never logs Authorization / API-key values —
     * only URL, delivery metadata, and JSON bodies.
     */
    private void logTrafficRequest(RetransmitDelivery delivery, String body, boolean retry) {
        LOG.infof(
                "Gauss traffic REQUEST%s id=%s config=%s asset=%s url=%s body=%s",
                retry ? " (retry-after-401)" : "",
                delivery.id(),
                delivery.configId(),
                delivery.assetId(),
                delivery.destinationUrl(),
                truncateTraffic(body));
    }

    private void logTrafficResponse(
            RetransmitDelivery delivery, int statusCode, String responseBody, boolean retry) {
        LOG.infof(
                "Gauss traffic RESPONSE%s id=%s config=%s asset=%s status=%d body=%s",
                retry ? " (retry-after-401)" : "",
                delivery.id(),
                delivery.configId(),
                delivery.assetId(),
                statusCode,
                truncateTraffic(responseBody));
    }

    private static String truncateTraffic(String body) {
        if (body == null) {
            return "";
        }
        if (body.length() <= TRAFFIC_BODY_MAX) {
            return body;
        }
        return body.substring(0, TRAFFIC_BODY_MAX) + "...[truncated " + body.length() + " chars]";
    }
}
