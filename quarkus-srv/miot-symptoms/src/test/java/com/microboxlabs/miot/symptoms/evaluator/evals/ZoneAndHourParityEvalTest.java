package com.microboxlabs.miot.symptoms.evaluator.evals;

import org.junit.jupiter.api.Test;

/**
 * Real trips through the evaluator with production's rules for stops in risk zones and for driving at night;
 * see each folder's README under {@code evals/}.
 */
class ZoneAndHourParityEvalTest {

    @Test
    void riskZoneStop() {
        ParityCheck.assertParity("risk-zone-stop", 15);
    }

    @Test
    void nightRiskStay() {
        ParityCheck.assertParity("night-risk-stay", 6);
    }

    @Test
    void offHoursDriving() {
        ParityCheck.assertParity("off-hours-driving", 7);
    }
}
