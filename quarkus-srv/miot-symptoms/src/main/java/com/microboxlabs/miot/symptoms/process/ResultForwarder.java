package com.microboxlabs.miot.symptoms.process;

import io.smallrye.mutiny.Uni;
import io.vertx.core.json.JsonObject;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * HTTP POST of a processor result. Same skip contract as
 * {@code quarkus-miot-symptoms.ResultForwarder}:
 * {@code forward:false} or {@code status:204} skip; missing {@code forward}
 * still forwards (legacy {@code process_symptoms_*} envelopes).
 *
 * <p>The URL argument must come from the route table, never from the payload.
 */
@ApplicationScoped
public class ResultForwarder implements WebhookForwarder {

    private static final Logger LOG = Logger.getLogger(ResultForwarder.class);

    private final HttpClient http;
    private final Duration defaultTimeout;

    @Inject
    ResultForwarder(
            @ConfigProperty(name = "miot.symptoms.http.timeout-seconds", defaultValue = "15")
                    int timeoutSeconds) {
        this.defaultTimeout = Duration.ofSeconds(timeoutSeconds);
        this.http = HttpClient.newBuilder().connectTimeout(defaultTimeout).build();
    }

    ResultForwarder(HttpClient http, Duration defaultTimeout) {
        this.http = http;
        this.defaultTimeout = defaultTimeout;
    }

    @Override
    public boolean shouldForward(JsonObject result) {
        if (result == null) {
            return false;
        }
        if (result.containsKey("forward") && !result.getBoolean("forward", true)) {
            return false;
        }
        Integer status = result.getInteger("status");
        return status == null || status != 204;
    }

    @Override
    public Uni<Void> forward(String url, JsonObject result) {
        if (url == null || url.isBlank()) {
            return Uni.createFrom().voidItem();
        }
        if (!shouldForward(result)) {
            LOG.debugf("Skipping HTTP forward to %s (forward=false or status=204)", url);
            return Uni.createFrom().voidItem();
        }
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .timeout(defaultTimeout)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(result.encode()))
                .build();
        return Uni.createFrom()
                .completionStage(() -> http.sendAsync(request, HttpResponse.BodyHandlers.discarding()))
                .onItem()
                .invoke(resp -> {
                    if (resp.statusCode() >= 400) {
                        throw new IllegalStateException(
                                "Webhook " + url + " returned HTTP " + resp.statusCode());
                    }
                    LOG.debugf("Forwarded result to %s (%d)", url, resp.statusCode());
                })
                .replaceWithVoid();
    }
}
