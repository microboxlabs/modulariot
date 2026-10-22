package com.microboxlabs.miot.symptoms.evaluator;

import java.util.List;

/** Where the evaluator records the case changes it finds. */
public interface TransitionLog {

    /** Where the vehicle was on the signal that caused the changes; any part may be null. */
    record Place(String tripId, Double latitude, Double longitude, Double speedKmh) {
    }

    void record(String tenantCode, List<Transition> transitions, Place place);
}
