package com.microboxlabs.miot.symptoms.map;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.microboxlabs.miot.core.gps.GpsTokenSource;
import com.microboxlabs.miot.core.iam.ServiceAccountTokenIssuer.IssuedToken;
import io.quarkus.rest.client.reactive.QuarkusRestClientBuilder;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.WebApplicationException;
import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.BiFunction;
import java.util.function.Function;
import java.util.function.Supplier;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Map and dashboard data from the StreamHub GPS database, read as the organization: each call carries a token for
 * the organization's own Auth0 application, so the database functions return only its assets and symptoms. Each
 * answer is kept for five seconds per organization, and concurrent identical calls share one request, so many open
 * maps do not trip the gateway's rate limit.
 */
@ApplicationScoped
public class ControlTowerMapService {

    private static final Logger LOG = Logger.getLogger(ControlTowerMapService.class);
    static final Duration FRESH = Duration.ofSeconds(5);

    /** The GPS data cannot be read: not configured, no token for the organization, or the database failed. */
    public static class UnavailableException extends RuntimeException {
        public UnavailableException(String message) {
            super(message);
        }
    }

    private final Function<String, Uni<IssuedToken>> tokens;
    private final Optional<String> url;
    private final Supplier<GpsRpcApi> apiFactory;
    private final Clock clock;
    private final Map<String, Answer> answers = new ConcurrentHashMap<>();
    private final Map<String, Uni<JsonNode>> inFlight = new ConcurrentHashMap<>();
    private GpsRpcApi api;

    private record Answer(JsonNode data, Instant until) {
    }

    @Inject
    public ControlTowerMapService(GpsTokenSource gpsTokens,
            @ConfigProperty(name = "miot.symptoms.gps.rpc-url") Optional<String> url) {
        this(gpsTokens::current, url, () -> QuarkusRestClientBuilder.newBuilder()
                .baseUri(URI.create(url.orElseThrow()))
                .build(GpsRpcApi.class));
    }

    public ControlTowerMapService(Function<String, Uni<IssuedToken>> tokens, Optional<String> url,
            Supplier<GpsRpcApi> apiFactory) {
        this(tokens, url, apiFactory, Clock.systemUTC());
    }

    ControlTowerMapService(Function<String, Uni<IssuedToken>> tokens, Optional<String> url,
            Supplier<GpsRpcApi> apiFactory, Clock clock) {
        this.tokens = tokens;
        this.url = url.filter(u -> !u.isBlank());
        this.apiFactory = apiFactory;
        this.clock = clock;
    }

    /** Last position of each of the organization's assets, on a trip or not. */
    public Uni<JsonNode> positions(String clientId) {
        return call(clientId, "positions", (rpc, bearer) -> rpc.positions(bearer, true),
                JsonNodeFactory.instance.arrayNode());
    }

    public Uni<JsonNode> summary(String clientId) {
        return call(clientId, "summary", GpsRpcApi::summary, JsonNodeFactory.instance.objectNode());
    }

    /**
     * Symptom counts by condition name: the active symptoms, or those created between {@code from} and {@code to}.
     *
     * @throws IllegalArgumentException when only one date is given, or a date is not ISO-8601
     */
    public Uni<JsonNode> conditions(String clientId, String from, String to) {
        boolean hasFrom = from != null && !from.isBlank();
        boolean hasTo = to != null && !to.isBlank();
        if (hasFrom != hasTo) {
            throw new IllegalArgumentException("Send both from and to, or neither");
        }
        String start = hasFrom ? date(from) : null;
        String end = hasTo ? date(to) : null;
        return call(clientId, "conditions " + start + " " + end,
                (rpc, bearer) -> rpc.conditions(bearer, start, end), JsonNodeFactory.instance.objectNode());
    }

    private Uni<JsonNode> call(String clientId, String name,
            BiFunction<GpsRpcApi, String, Uni<GpsRpcApi.RpcResponse>> rpc, JsonNode empty) {
        if (url.isEmpty()) {
            return Uni.createFrom().failure(new UnavailableException("GPS data is not configured"));
        }
        String key = clientId + " " + name;
        Answer answer = answers.get(key);
        if (answer != null && answer.until().isAfter(clock.instant())) {
            return Uni.createFrom().item(answer.data());
        }
        return inFlight.computeIfAbsent(key, k -> read(clientId, rpc, empty)
                .invoke(data -> remember(k, data))
                .onTermination().invoke(() -> inFlight.remove(k))
                .memoize().indefinitely());
    }

    /** Keeps answers for one call per organization; expired ones are dropped as new ones arrive. */
    private void remember(String key, JsonNode data) {
        Instant now = clock.instant();
        answers.values().removeIf(a -> !a.until().isAfter(now));
        answers.put(key, new Answer(data, now.plus(FRESH)));
    }

    private Uni<JsonNode> read(String clientId, BiFunction<GpsRpcApi, String, Uni<GpsRpcApi.RpcResponse>> rpc,
            JsonNode empty) {
        return tokens.apply(clientId)
                .onFailure(IllegalStateException.class).transform(e -> new UnavailableException(e.getMessage()))
                .flatMap(token -> rpc.apply(api(), "Bearer " + token.accessToken()))
                .onFailure(WebApplicationException.class).transform(e -> {
                    int status = ((WebApplicationException) e).getResponse().getStatus();
                    LOG.warnf("GPS database request failed: HTTP %d", status);
                    return new UnavailableException("The GPS database did not answer: HTTP " + status);
                })
                .map(response -> data(response, empty));
    }

    private static JsonNode data(GpsRpcApi.RpcResponse response, JsonNode empty) {
        if (response == null) {
            return empty;
        }
        int status = response.status() == null ? 200 : response.status();
        if (status >= 400) {
            LOG.warnf("GPS database function failed: %d %s", status, response.message());
            throw new UnavailableException("The GPS database could not answer the query");
        }
        JsonNode data = response.data();
        return data == null || data.isNull() ? empty : data;
    }

    private static String date(String value) {
        String v = value.trim();
        try {
            OffsetDateTime.parse(v);
            return v;
        } catch (DateTimeParseException e) {
            // Try the forms without an offset.
        }
        try {
            LocalDateTime.parse(v);
            return v;
        } catch (DateTimeParseException e) {
            // Try a plain date.
        }
        try {
            LocalDate.parse(v);
            return v;
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("Dates must be ISO-8601: " + value);
        }
    }

    private synchronized GpsRpcApi api() {
        if (api == null) {
            api = apiFactory.get();
        }
        return api;
    }
}
