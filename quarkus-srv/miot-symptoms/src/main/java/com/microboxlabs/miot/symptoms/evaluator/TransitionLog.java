package com.microboxlabs.miot.symptoms.evaluator;

import java.util.List;
import java.util.Map;

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
