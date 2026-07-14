package com.microboxlabs.miot.integrations.retransmit;

import com.microboxlabs.miot.integrations.domain.RetransmitDelivery;
import com.microboxlabs.miot.integrations.domain.WebhookDeliveryState;
import com.microboxlabs.miot.integrations.persistence.RetransmitDeliveryRepository;
import io.quarkus.scheduler.Scheduled;
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
import java.util.UUID;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Claims PENDING retransmit outbox rows and POSTs payloads. Separate from the
 * Pulsar consume loop so slow destinations never nack the enriched topic.
 */
@ApplicationScoped
public class RetransmitDeliveryJob {

    private static final Logger LOG = Logger.getLogger(RetransmitDeliveryJob.class);
    private static final Duration HTTP_TIMEOUT = Duration.ofSeconds(15);

    private final RetransmitDeliveryRepository repository;
    private final boolean workerEnabled;
    private final int claimLimit;
    private final int leaseSeconds;
    private final int retryBaseSeconds;
    private final int retryMaxSeconds;
    private final String workerId;
    private final HttpClient httpClient;

    RetransmitDeliveryJob(
            RetransmitDeliveryRepository repository,
            @ConfigProperty(name = "miot.integrations.retransmit.worker.enabled", defaultValue = "false")
                    boolean workerEnabled,
            @ConfigProperty(name = "miot.integrations.retransmit.claim-limit", defaultValue = "20")
                    int claimLimit,
            @ConfigProperty(name = "miot.integrations.retransmit.lease-seconds", defaultValue = "60")
                    int leaseSeconds,
            @ConfigProperty(name = "miot.integrations.retransmit.retry-base-seconds", defaultValue = "30")
                    int retryBaseSeconds,
            @ConfigProperty(name = "miot.integrations.retransmit.retry-max-seconds", defaultValue = "900")
                    int retryMaxSeconds) {
        this.repository = repository;
        this.workerEnabled = workerEnabled;
        this.claimLimit = claimLimit;
        this.leaseSeconds = leaseSeconds;
        this.retryBaseSeconds = retryBaseSeconds;
        this.retryMaxSeconds = retryMaxSeconds;
        this.workerId = "retransmit-" + UUID.randomUUID().toString().substring(0, 8);
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    @Scheduled(every = "${miot.integrations.retransmit.claim-every:5s}", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void claimAndDeliver() {
        if (!workerEnabled) {
            return;
        }
        // Claim one row at a time so a slow HTTP POST cannot expire later leases
        // from a multi-row claim while this worker is still serializing delivery.
        int remaining = Math.max(claimLimit, 1);
        while (remaining-- > 0) {
            List<RetransmitDelivery> batch = repository.claim(workerId, 1, leaseSeconds);
            if (batch.isEmpty()) {
                return;
            }
            deliverOne(batch.get(0));
        }
    }

    void deliverOne(RetransmitDelivery delivery) {
        UUID id = UUID.fromString(delivery.id());
        try {
            String body = new JsonObject(delivery.payload()).encode();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(delivery.destinationUrl()))
                    .timeout(HTTP_TIMEOUT)
                    .header("Content-Type", "application/json")
                    .header("User-Agent", "ModularIoT-Retransmit/1.0")
                    .header("X-Miot-Retransmit-Config", delivery.configId())
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            int code = response.statusCode();
            if (code >= 200 && code < 300) {
                repository.markSucceeded(id, workerId, code);
                LOG.debugf("Retransmit delivered id=%s status=%d", delivery.id(), code);
                return;
            }
            failOrRetry(delivery, id, code, "HTTP " + code);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            failOrRetry(delivery, id, null, "interrupted: " + e.getMessage());
        } catch (Exception e) {
            failOrRetry(delivery, id, null, e.getMessage());
        }
    }

    private void failOrRetry(RetransmitDelivery delivery, UUID id, Integer statusCode, String error) {
        boolean exhausted = delivery.attempts() >= delivery.maxAttempts();
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
                retryMaxSeconds,
                (long) retryBaseSeconds * (1L << Math.min(Math.max(attempts - 1, 0), 8)));
        return OffsetDateTime.now(ZoneOffset.UTC).plusSeconds(delay);
    }

    private static String truncate(String error) {
        if (error == null) {
            return null;
        }
        return error.length() > 1000 ? error.substring(0, 1000) : error;
    }
}
