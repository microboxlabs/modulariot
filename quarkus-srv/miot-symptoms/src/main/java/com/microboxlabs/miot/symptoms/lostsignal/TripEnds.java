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
     * @param assetId the vehicle the trip is on now, or null when unknown
     */
    record State(boolean ended, boolean arrived, String assetId) {
        public State(boolean ended, boolean arrived) {
            this(ended, arrived, null);
        }

        /** The trip runs on another vehicle than {@code asset}: its truck was replaced. */
        public boolean movedFrom(String asset) {
            return !ended && assetId != null && asset != null && !assetId.equalsIgnoreCase(asset);
        }
    }

    /** The {@code closed_by} of a case closed because its trip ended. */
    String REASON = "trip_ended";

    /** The {@code closed_by} of a case closed because its trip moved to another vehicle. */
    String ASSET_CHANGED = "asset_changed";

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

    record Closure(StaleCase value, Instant at, String reason) {
        public Closure(StaleCase value, Instant at) {
            this(value, at, REASON);
        }
    }

    /** Closes the trip, then delivers its effects; durable stores also retry previously queued effects. */
    default int end(String tenant, String tripId, List<UUID> definitions, Instant at, Consumer<Closure> effect) {
        List<StaleCase> closed = close(tenant, tripId, definitions, at);
        closed.forEach(c -> effect.accept(new Closure(c, at)));
        return closed.size();
    }

    /**
     * The trip moved to {@code keepAsset}: closes its open cases of those symptoms on any other vehicle with
     * {@link #ASSET_CHANGED}, then delivers their effects.
     */
    default int leave(String tenant, String tripId, List<UUID> definitions, String keepAsset, Instant at,
            Consumer<Closure> effect) {
        List<StaleCase> closed = closeOthers(tenant, tripId, definitions, keepAsset, at);
        closed.forEach(c -> effect.accept(new Closure(c, at, ASSET_CHANGED)));
        return closed.size();
    }

    /** Closes the trip's open cases of those symptoms whose vehicle is not {@code keepAsset}. */
    default List<StaleCase> closeOthers(String tenant, String tripId, List<UUID> definitionIds, String keepAsset,
            Instant at) {
        return List.of();
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
