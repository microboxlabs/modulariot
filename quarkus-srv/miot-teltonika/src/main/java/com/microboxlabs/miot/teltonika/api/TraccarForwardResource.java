package com.microboxlabs.miot.teltonika.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.teltonika.TeltonikaComponent;
import com.microboxlabs.miot.teltonika.config.TeltonikaConfig;
import com.microboxlabs.miot.teltonika.traccar.TraccarIngest;
import io.quarkus.arc.properties.IfBuildProperty;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;
import java.util.Optional;
import java.util.function.BooleanSupplier;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.jboss.logging.Logger;

/**
 * Where the platform's Traccar gateway forwards every position ({@code forward.url}, JSON). Internal:
 * not under {@code /api}, reachable only inside the cluster, and every request must carry the shared
 * key ({@code forward.header = x-miot-traccar-key: ...}); without {@code miot.teltonika.traccar-key}
 * configured the endpoint answers 503. Same pattern as {@code /internal/dashboard-credentials}.
 *
 * <p>Answers: 200 with the outcome (published, duplicate, kept, pending_activation, unknown_device:
 * Traccar must not retry those); 400 for a body that is not a position; 503 when it could not be
 * published nor kept (Traccar retries with {@code forward.retry.enable}).
 */
@Path("/internal/gps/traccar/positions")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "GPS — Traccar gateway (internal)")
@IfBuildProperty(name = "miot.component.teltonika.enabled", stringValue = "true")
public class TraccarForwardResource {

    public static final String KEY_HEADER = "x-miot-traccar-key";
    private static final Logger LOG = Logger.getLogger(TraccarForwardResource.class);
    private static final ObjectMapper JSON = new ObjectMapper();

    private final TraccarIngest ingest;
    private final Optional<String> key;
    private final BooleanSupplier ready;

    @Inject
    public TraccarForwardResource(TraccarIngest ingest, TeltonikaConfig config, TeltonikaComponent component) {
        this(ingest, config.traccarKey(), component::ready);
    }

    public TraccarForwardResource(TraccarIngest ingest, Optional<String> key, BooleanSupplier ready) {
        this.ingest = ingest;
        this.key = key.filter(k -> !k.isBlank());
        this.ready = ready;
    }

    @POST
    @Operation(hidden = true, summary = "A position forwarded by Traccar")
    public Uni<Response> position(@HeaderParam(KEY_HEADER) String presented, String body) {
        if (key.isEmpty()) {
            return Uni.createFrom().item(error(Response.Status.SERVICE_UNAVAILABLE, "Traccar ingest not configured"));
        }
        if (presented == null || !MessageDigest.isEqual(key.get().getBytes(StandardCharsets.UTF_8),
                presented.getBytes(StandardCharsets.UTF_8))) {
            return Uni.createFrom().item(error(Response.Status.UNAUTHORIZED, "missing or wrong key"));
        }
        if (!ready.getAsBoolean()) {
            // The device registry is not loaded here (receiver starting, or turned off in this pod):
            // "unknown device" would be a 200 and Traccar would drop the position. 503: it retries.
            return Uni.createFrom().item(error(Response.Status.SERVICE_UNAVAILABLE, "receiver not ready"));
        }
        return Uni.createFrom().item(() -> handle(body)).runSubscriptionOn(Infrastructure.getDefaultWorkerPool());
    }

    Response handle(String body) {
        JsonNode json;
        try {
            json = JSON.readTree(body == null ? "" : body);
        } catch (IOException e) {
            return error(Response.Status.BAD_REQUEST, "body is not JSON");
        }
        try {
            TraccarIngest.Result r = ingest.handle(json, "traccar");
            return Response.ok(r).build();
        } catch (IllegalArgumentException e) {
            return error(Response.Status.BAD_REQUEST, e.getMessage());
        } catch (RuntimeException e) {
            LOG.errorf(e, "Traccar position not accepted; Traccar will retry");
            return error(Response.Status.SERVICE_UNAVAILABLE, e.getMessage());
        }
    }

    private static Response error(Response.Status status, String message) {
        return Response.status(status).type(MediaType.APPLICATION_JSON).entity(Map.of("error", message)).build();
    }
}
