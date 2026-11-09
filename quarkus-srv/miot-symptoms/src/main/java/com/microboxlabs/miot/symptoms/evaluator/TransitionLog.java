package com.microboxlabs.miot.symptoms.evaluator;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Where the evaluator records case changes. A CLOSED row's measure is the case's maximum
 * ({@link Episode#maxMeasure()}); its context is the closing frame, retaining the last trip counters for a
 * trip-end duty close. Appending a change it already holds does nothing.
 */
public interface TransitionLog {

    /**
     * Where the vehicle was on the signal that caused the changes; any part may be null.
     *
     * @param driverId the trip's driver in the driver registry; published, not stored
     */
    record Place(String tripId, Double latitude, Double longitude, Double speedKmh, String driverId) {

        /** Where the change is recorded: here, with the case's trip when the change carries one. */
        public Place of(Transition t) {
            return t.tripId() == null || t.tripId().equals(tripId) ? this
                    : new Place(t.tripId(), latitude, longitude, speedKmh, null);
        }
    }

    /** The durable identity and evidence of a legacy case's opening. */
    record Opening(String tripId, Map<String, Object> context) {
    }

    /**
     * The operator's close of the symptom's newest case on the vehicle, read from that case's CLOSED row; empty when
     * the newest case is open, was closed by the engine, or there is none.
     */
    default Optional<OperatorClose> lastOperatorClose(String tenantCode, String assetId, UUID definitionId) {
        return Optional.empty();
    }

    /** Called once per legacy open episode; stores without opening history keep the identity unknown. */
    default Opening opening(String tenantCode, Episode episode) {
        return new Opening(null, Map.of());
    }

    /**
     * A change the log did not hold before.
     *
     * @param caseId the id of the case's OPENED transition
     */
    record Recorded(Transition transition, long caseId) {
    }

    /** Openings rejected or immediately closed by the authoritative trip guard keep no episode. */
    record Appended(List<Recorded> recorded, Set<UUID> discarded) {
    }

    /** A preflight fact for ordinary late frames opted in by their spec; writes recheck under the same lock. */
    default boolean tripEnded(String tenant, String tripId) {
        return false;
    }

    /** Evaluator and duty writes apply the published lifecycle's after-trip policy under the trip lock. */
    default Appended appendEvaluated(String tenantCode, List<Transition> transitions, Place place,
            Map<String, Object> context) {
        return new Appended(append(tenantCode, transitions, place, context), Set.of());
    }

    /** @return the changes it recorded now, without the ones it already held */
    default List<Recorded> append(String tenantCode, List<Transition> transitions, Place place) {
        return append(tenantCode, transitions, place, null);
    }

    /**
     * @param context what the rules read, kept with each change so the case can say why it is at its level; null
     *        for none
     */
    List<Recorded> append(String tenantCode, List<Transition> transitions, Place place, Map<String, Object> context);

    /** Lost-signal writes must validate and lock the trip state in the same transaction as the transitions. */
    default List<Recorded> appendTripCheck(String tenantCode, List<Transition> transitions, Place place,
            Map<String, Object> context) {
        return append(tenantCode, transitions, place, context);
    }
}
