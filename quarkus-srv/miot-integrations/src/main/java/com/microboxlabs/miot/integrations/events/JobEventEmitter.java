package com.microboxlabs.miot.integrations.events;

import com.microboxlabs.miot.integrations.domain.AsyncJob;
import io.vertx.core.json.JsonObject;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Publishes async-job state transitions to the quarkus-sse event bus so the
 * frontend job console and notification inbox update live.
 *
 * <p>Each transition becomes one {@code EventData} frame POSTed to
 * {@code {base-url}/api/v1/events/emit} with {@code eventType} {@value #EVENT_TYPE}
 * and {@code tenantId} = the job's tenant code, matching the tenant-scoped
 * stream the browser subscribes to
 * ({@code GET /api/v1/events/tenant/{tenantId}/stream/{eventType}}).
 *
 * <p>quarkus-sse is a live fan-out with no persistence: frames sent with no
 * subscriber are dropped, which is fine — the console's source of truth is the
 * {@code async_jobs} ledger; SSE only triggers refreshes. Delivery is therefore
 * strictly fire-and-forget: failures are logged at DEBUG and never propagate
 * into the enqueue/claim/report path.
 *
 * <p>Disabled until {@code miot.integrations.job-events.sse-base-url} is set
 * (empty default — no baked endpoint), mirroring {@code CalendarBookingsClient}.
 */
@ApplicationScoped
public class JobEventEmitter {

    public static final String EVENT_TYPE = "integrations.job";

    private static final Logger LOG = Logger.getLogger(JobEventEmitter.class);
    private static final String EMIT_PATH = "/api/v1/events/emit";

    private final Optional<String> baseUrl;
    private final HttpClient http;

    @Inject
    public JobEventEmitter(
            @ConfigProperty(name = "miot.integrations.job-events.sse-base-url") Optional<String> baseUrl) {
        this.baseUrl = baseUrl
                .filter(url -> !url.isBlank())
                .map(url -> url.endsWith("/") ? url.substring(0, url.length() - 1) : url);
        this.http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(3))
                .build();
    }

    public boolean isConfigured() {
        return baseUrl.isPresent();
    }

    /**
     * Emits one transition frame for the job's current row state. Never throws;
     * a no-op when unconfigured.
     *
     * @param transition what just happened to the job: {@code enqueued},
     *        {@code claimed}, {@code succeeded}, {@code retry_scheduled},
     *        {@code failed} or {@code retried}
     */
    public void emit(AsyncJob job, String transition) {
        if (job == null || baseUrl.isEmpty()) {
            return;
        }
        try {
            String body = eventData(job, transition).encode();
            HttpRequest request = HttpRequest.newBuilder(URI.create(baseUrl.get() + EMIT_PATH))
                    .timeout(Duration.ofSeconds(5))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();
            http.sendAsync(request, HttpResponse.BodyHandlers.discarding())
                    .whenComplete((response, error) -> {
                        if (error != null) {
                            LOG.debugf("Job event emit failed for job %s (%s): %s",
                                    job.id(), transition, error.getMessage());
                        } else if (response.statusCode() >= 400) {
                            LOG.debugf("Job event emit rejected for job %s (%s): HTTP %d",
                                    job.id(), transition, response.statusCode());
                        }
                    });
        } catch (Exception e) {
            // e.g. a malformed configured base URL (URI.create) — never let the
            // emitter abort the enqueue/claim/report path it piggybacks on.
            LOG.debugf("Job event emit failed for job %s (%s): %s",
                    job.id(), transition, e.getMessage());
        }
    }

    /** quarkus-sse {@code EventData} frame for a job transition. */
    JsonObject eventData(AsyncJob job, String transition) {
        JsonObject payload = new JsonObject()
                .put("jobId", job.id())
                .put("jobType", job.jobType())
                .put("executor", job.executor())
                .put("state", job.state() != null ? job.state().name() : null)
                .put("transition", transition)
                .put("attempts", job.attempts())
                .put("maxAttempts", job.maxAttempts())
                .put("correlationKey", job.correlationKey())
                .put("chainKey", job.chainKey())
                .put("chainSequence", job.chainSequence())
                .put("enqueuedBy", job.enqueuedBy())
                .put("lastError", job.lastError())
                .put("nextRetryAt", job.nextRetryAt() != null ? job.nextRetryAt().toString() : null)
                .put("updatedAt", job.updatedAt() != null ? job.updatedAt().toString() : null);
        return new JsonObject()
                .put("eventType", EVENT_TYPE)
                .put("tenantId", job.tenantCode())
                .put("timestamp", Instant.now().toString())
                .put("payload", payload);
    }
}
