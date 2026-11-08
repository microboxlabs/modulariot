package com.microboxlabs.miot.symptoms.lostsignal;

import com.microboxlabs.miot.symptoms.cases.EngineCaseStore.StaleCase;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;

/** Which trips ended or reached their destination, and closing a trip's lost-signal cases. */
public interface TripEnds {

    /**
     * What the trips module says about a trip now.
     *
     * @param ended   completed, cancelled or gone
     * @param arrived its {@code arrival} milestone is confirmed
     */
    record State(boolean ended, boolean arrived) {
    }

    /** The {@code closed_by} of a case closed because its trip ended. */
    String REASON = "trip_ended";

    /** A canonical UUID, or null for a legacy or malformed trip id. */
    static UUID uuid(String id) {
        if (id == null) {
            return null;
        }
        try {
            UUID value = UUID.fromString(id);
            return value.toString().equalsIgnoreCase(id) ? value : null;
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    record Closure(StaleCase value, Instant at) {
    }

    /** Closes the trip, then delivers its effects; durable stores also retry previously queued effects. */
    default int end(String tenant, String tripId, List<UUID> definitions, Instant at, Consumer<Closure> effect) {
        List<StaleCase> closed = close(tenant, tripId, definitions, at);
        closed.forEach(c -> effect.accept(new Closure(c, at)));
        return closed.size();
    }

    /** Retries durable effects even when the vehicle no longer has a deadline. */
    default int retry(Consumer<Closure> effect) {
        return 0;
    }

    /** No trip ever ends; closes nothing. */
    TripEnds NONE = new TripEnds() {
        @Override
        public Map<String, State> states(Map<String, String> tripByTenant) {
            return Map.of();
        }

        @Override
        public List<StaleCase> close(String tenant, String tripId, List<UUID> definitionIds, Instant at) {
            return List.of();
        }
    };

    /** Supplies the same episode store the checks use, for exact case maxima at trip end. */
    default TripEnds withEpisodes(com.microboxlabs.miot.symptoms.evaluator.EpisodeRepository episodes) {
        return this;
    }

    /**
     * The state of each organization's trip ({@code tenant → trip id}), by tenant; an organization left out has
     * nothing to say. Fails when the trips cannot be read, so the check is retried rather than run blind.
     */
    Map<String, State> states(Map<String, String> tripByTenant);

    /** Closes the trip's open cases of those symptoms with {@link #REASON}; returns the ones it closed. */
    List<StaleCase> close(String tenant, String tripId, List<UUID> definitionIds, Instant at);
}
