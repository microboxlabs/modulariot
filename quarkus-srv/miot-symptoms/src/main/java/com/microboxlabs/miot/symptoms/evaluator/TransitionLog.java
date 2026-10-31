package com.microboxlabs.miot.symptoms.evaluator;

import java.util.List;

/** Where the evaluator records the case changes it finds. Appending a change it already holds does nothing. */
public interface TransitionLog {

    /**
     * Where the vehicle was on the signal that caused the changes; any part may be null.
     *
     * @param driverId the trip's driver in the driver registry; published, not stored
     */
    record Place(String tripId, Double latitude, Double longitude, Double speedKmh, String driverId) {
    }

    /**
     * A change the log did not hold before.
     *
     * @param caseId the id of the case's OPENED transition
     */
    record Recorded(Transition transition, long caseId) {
    }

    /** @return the changes it recorded now, without the ones it already held */
    List<Recorded> append(String tenantCode, List<Transition> transitions, Place place);
}
