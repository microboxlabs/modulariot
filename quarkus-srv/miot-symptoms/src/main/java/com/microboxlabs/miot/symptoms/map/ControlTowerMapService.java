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
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
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
    private static final Set<String> SYMPTOM_TEXT_FILTERS = Set.of("p_asset_id", "p_trip_id", "p_driver_id",
            "p_carrier_id", "p_origin", "p_destination", "p_symptom_name");
    private static final Set<String> SYMPTOM_NUMBER_FILTERS = Set.of("p_icu_code", "p_page", "p_page_size");
    private static final Set<String> SYMPTOM_DATE_FILTERS = Set.of("p_start_date_historic", "p_end_date_historic");

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
        return call(clientId, "positions",
                (rpc, bearer) -> rpc.positions(bearer, true).map(r -> data(r, JsonNodeFactory.instance.arrayNode())));
    }

    public Uni<JsonNode> summary(String clientId) {
        return call(clientId, "summary",
                (rpc, bearer) -> rpc.summary(bearer).map(r -> data(r, JsonNodeFactory.instance.objectNode())));
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
        return call(clientId, "conditions " + start + " " + end, (rpc, bearer) -> rpc.conditions(bearer, start, end)
                .map(r -> data(r, JsonNodeFactory.instance.objectNode())));
    }

    /**
     * One page of the organization's symptoms, with the function's own totals.
     *
     * @param filters the function's parameters: {@code p_asset_id}, {@code p_trip_id}, {@code p_driver_id},
     *        {@code p_carrier_id}, {@code p_origin}, {@code p_destination}, {@code p_symptom_name},
     *        {@code p_icu_code}, {@code p_page}, {@code p_page_size}, {@code p_start_date_historic},
     *        {@code p_end_date_historic}
     * @throws IllegalArgumentException for any other parameter, a non-numeric number or a non-ISO date
     */
    public Uni<JsonNode> symptoms(String clientId, Map<String, String> filters) {
        Map<String, String> sent = new TreeMap<>();
        filters.forEach((name, value) -> {
            if (!SYMPTOM_TEXT_FILTERS.contains(name) && !SYMPTOM_NUMBER_FILTERS.contains(name)
                    && !SYMPTOM_DATE_FILTERS.contains(name)) {
                throw new IllegalArgumentException("Unknown filter: " + name);
            }
            if (value != null && !value.isBlank()) {
                sent.put(name, symptomFilter(name, value.trim()));
            }
        });
        Map<String, String> query = new LinkedHashMap<>(sent);
        return call(clientId, "symptoms " + cacheKey(sent), (rpc, bearer) -> rpc.symptoms(bearer, query)
                .map(ControlTowerMapService::whole));
    }

    /** Each name and value prefixed with its length, so no two filter sets share a key. */
    private static String cacheKey(Map<String, String> sorted) {
        StringBuilder key = new StringBuilder();
        sorted.forEach((name, value) -> key.append(name.length()).append(':').append(name)
                .append(value.length()).append(':').append(value));
        return key.toString();
    }

    private static String symptomFilter(String name, String value) {
        if (SYMPTOM_TEXT_FILTERS.contains(name)) {
            return value;
        }
        if (SYMPTOM_NUMBER_FILTERS.contains(name)) {
            if (!value.matches("\\d{1,9}")) {
                throw new IllegalArgumentException(name + " must be a whole number");
            }
            return value;
        }
        if (SYMPTOM_DATE_FILTERS.contains(name)) {
            return date(value);
        }
        throw new IllegalArgumentException("Unknown filter: " + name);
    }

    private Uni<JsonNode> call(String clientId, String name, BiFunction<GpsRpcApi, String, Uni<JsonNode>> rpc) {
        if (url.isEmpty()) {
            return Uni.createFrom().failure(new UnavailableException("GPS data is not configured"));
        }
        String key = clientId + " " + name;
        Answer answer = answers.get(key);
        if (answer != null && answer.until().isAfter(clock.instant())) {
            return Uni.createFrom().item(answer.data());
        }
        return inFlight.computeIfAbsent(key, k -> read(clientId, rpc)
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

    private Uni<JsonNode> read(String clientId, BiFunction<GpsRpcApi, String, Uni<JsonNode>> rpc) {
        return tokens.apply(clientId)
                .onFailure(IllegalStateException.class).transform(e -> new UnavailableException(e.getMessage()))
                .flatMap(token -> rpc.apply(api(), "Bearer " + token.accessToken()))
                .onFailure(e -> !(e instanceof UnavailableException)).transform(ControlTowerMapService::unanswered);
    }

    /** An HTTP error, or a transport failure such as a refused connection or a timeout. */
    private static UnavailableException unanswered(Throwable e) {
        if (e instanceof WebApplicationException w) {
            int status = w.getResponse().getStatus();
            LOG.warnf("GPS database request failed: HTTP %d", status);
            return new UnavailableException("The GPS database did not answer: HTTP " + status);
        }
        LOG.warnf("GPS database request failed: %s", e.toString());
        return new UnavailableException("The GPS database did not answer");
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

    /** The whole answer of a function that puts totals beside {@code data}. */
    private static JsonNode whole(JsonNode body) {
        if (body == null || body.isNull()) {
            return JsonNodeFactory.instance.objectNode();
        }
        int status = body.path("status").asInt(200);
        if (status >= 400) {
            LOG.warnf("GPS database function failed: %d %s", status, body.path("message").asText());
            throw new UnavailableException("The GPS database could not answer the query");
        }
        return body;
    }

    /** The trimmed value, when it is an ISO-8601 date-time with or without an offset, or a date. */
    private static String date(String value) {
        String v = value.trim();
        if (!isIsoDate(v)) {
            throw new IllegalArgumentException("Dates must be ISO-8601: " + value);
        }
        return v;
    }

    private static boolean isIsoDate(String v) {
        for (DateTimeFormatter format : List.of(DateTimeFormatter.ISO_OFFSET_DATE_TIME,
                DateTimeFormatter.ISO_LOCAL_DATE_TIME, DateTimeFormatter.ISO_LOCAL_DATE)) {
            try {
                format.parse(v);
                return true;
            } catch (DateTimeParseException e) {
                // Try the next form.
            }
        }
        return false;
    }

    private synchronized GpsRpcApi api() {
        if (api == null) {
            api = apiFactory.get();
        }
        return api;
    }
}
