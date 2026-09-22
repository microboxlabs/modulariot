package com.microboxlabs.miot.symptoms.domain;

/** Live symptom counts per ICU bucket, matching the tower's status cards. */
public record IcuSummary(
        long underObservation,
        long compromised,
        long critical,
        long codeBlack,
        long underTreatment) {
}
