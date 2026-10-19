package com.microboxlabs.miot.symptoms.map;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.microboxlabs.miot.symptoms.map.ControlTowerMapService.UnavailableException;
import com.microboxlabs.miot.symptoms.process.StreamhubSymptomsGpsClient;
import io.smallrye.mutiny.Uni;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.pgclient.PgConnectOptions;
import io.vertx.sqlclient.PoolOptions;
import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.function.Function;
import java.util.function.Supplier;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * The treatment page's data from the GPS database, read with read-only sessions through
 * {@code miot.symptoms.gps.*}: the symptom header, its signals, and the positions of a trip. A symptom or trip outside
 * the organization's client ids is not found.
 */
@ApplicationScoped
public class ControlTowerTreatmentService {

    private static final Logger LOG = Logger.getLogger(ControlTowerTreatmentService.class);
    private static final String FEATURES = "features";
    static final int MAX_POSITIONS = 20_000;

    private final TreatmentReads reads;
    private Vertx vertx;
    private Optional<String> url = Optional.empty();
    private Optional<String> username = Optional.empty();
    private Optional<String> password = Optional.empty();
    private Pool pool;

    @Inject
    public ControlTowerTreatmentService(Vertx vertx,
            @ConfigProperty(name = "miot.gps.reactive-url") Optional<String> url,
            @ConfigProperty(name = "miot.gps.username") Optional<String> username,
            @ConfigProperty(name = "miot.gps.password") Optional<String> password) {
        this.vertx = vertx;
        this.url = url.filter(s -> !s.isBlank());
        this.username = username.filter(s -> !s.isBlank());
        this.password = password;
        this.reads = this.url.isPresent() && this.username.isPresent() ? new PgTreatmentReads(this::pool) : null;
    }

    /** {@code reads} null: the GPS database is not configured. */
    public ControlTowerTreatmentService(TreatmentReads reads) {
        this.reads = reads;
    }

    /** The {@code data} of {@code api_modular_treatments_info_general} for the symptom. */
    public Uni<JsonNode> treatment(List<String> clientIds, String symptomId) {
        long id = symptomId(symptomId);
        return guarded(() -> firstFound(clientIds, client -> reads.treatment(client, id), "Symptom not found")
                .map(answer -> {
                    JsonNode data = checked(answer).path("data");
                    if (status(answer) == 204 || !data.isObject() || data.isEmpty()) {
                        throw new NoSuchElementException("Symptom not found");
                    }
                    return data;
                }));
    }

    /** The {@code data} of {@code api_modular_treatment_symptoms_signals_map}: a FeatureCollection. */
    public Uni<JsonNode> signals(List<String> clientIds, String symptomId) {
        long id = symptomId(symptomId);
        return guarded(() -> firstFound(clientIds, client -> reads.signals(client, id), "Symptom not found")
                .map(answer -> {
                    JsonNode data = checked(answer).path("data");
                    if (!data.isObject()) {
                        return emptyFeatures();
                    }
                    if (!data.path(FEATURES).isArray()) {
                        ((ObjectNode) data).putArray(FEATURES);
                    }
                    return data;
                }));
    }

    /** The asset's positions during the trip, oldest first, sampled down to at most {@value #MAX_POSITIONS}. */
    public Uni<JsonNode> tripPositions(List<String> clientIds, String tripId, String assetId) {
        if (tripId == null || tripId.isBlank() || assetId == null || assetId.isBlank()) {
            throw new IllegalArgumentException("tripId and assetId are required");
        }
        String trip = tripId.trim();
        String asset = assetId.trim();
        return guarded(() -> firstFound(clientIds, client -> reads.tripPositions(trip, asset, client, MAX_POSITIONS),
                "Trip not found"));
    }

    /** The first client id, in order and one at a time, for which {@code read} finds something. */
    private static Uni<JsonNode> firstFound(List<String> clientIds,
            Function<String, Uni<Optional<JsonNode>>> read, String notFound) {
        Uni<Optional<JsonNode>> found = Uni.createFrom().item(Optional.empty());
        for (String client : clientIds) {
            found = found.flatMap(previous -> previous.isPresent() ? Uni.createFrom().item(previous)
                    : read.apply(client));
        }
        return found.map(answer -> answer.orElseThrow(() -> new NoSuchElementException(notFound)));
    }

    private Uni<JsonNode> guarded(Supplier<Uni<? extends JsonNode>> read) {
        if (reads == null) {
            return Uni.createFrom().failure(new UnavailableException("GPS data is not configured"));
        }
        return Uni.createFrom().<JsonNode>deferred(read)
                .onFailure(e -> !(e instanceof NoSuchElementException || e instanceof UnavailableException))
                .transform(e -> {
                    LOG.warnf("GPS database read failed: %s", e.toString());
                    return new UnavailableException("The GPS database did not answer");
                });
    }

    private static long symptomId(String raw) {
        try {
            return Long.parseLong(raw == null ? "" : raw.trim());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("symptomId must be numeric");
        }
    }

    private static int status(JsonNode answer) {
        return answer.path("status").asInt(200);
    }

    private static JsonNode checked(JsonNode answer) {
        if (answer == null || answer.isNull()) {
            throw new NoSuchElementException("Symptom not found");
        }
        if (status(answer) >= 400) {
            LOG.warnf("GPS database function failed: %d %s", status(answer), answer.path("message").asText());
            throw new UnavailableException("The GPS database could not answer the query");
        }
        return answer;
    }

    private static JsonNode emptyFeatures() {
        ObjectNode empty = JsonNodeFactory.instance.objectNode().put("type", "FeatureCollection");
        empty.putObject("description");
        empty.putArray(FEATURES);
        return empty;
    }

    private synchronized Pool pool() {
        if (pool == null) {
            StreamhubSymptomsGpsClient.ParsedUrl parsed = StreamhubSymptomsGpsClient.parseUrl(url.orElseThrow());
            PgConnectOptions connect = new PgConnectOptions()
                    .setHost(parsed.host())
                    .setPort(parsed.port())
                    .setDatabase(parsed.database())
                    .setUser(username.orElseThrow())
                    .setPassword(password.orElse(""))
                    .setProperties(Map.of(
                            "application_name", "miot-control-tower",
                            "default_transaction_read_only", "on",
                            "statement_timeout", "25000",
                            "TimeZone", "UTC"));
            pool = PgBuilder.pool().with(new PoolOptions().setMaxSize(2)).connectingTo(connect).using(vertx).build();
        }
        return pool;
    }

    @PreDestroy
    synchronized void close() {
        if (pool != null) {
            pool.closeAndAwait();
        }
    }
}
