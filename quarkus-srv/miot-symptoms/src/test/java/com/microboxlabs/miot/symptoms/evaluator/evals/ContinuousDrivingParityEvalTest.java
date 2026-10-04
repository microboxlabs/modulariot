package com.microboxlabs.miot.symptoms.evaluator.evals;

import org.junit.jupiter.api.Test;

/**
 * Real trips through the evaluator with production's continuous-driving rule; see
 * {@code evals/continuous-driving/README.md}.
 */
class ContinuousDrivingParityEvalTest {

    @Test
    void realTripsGiveTheTransitionsProductionGave() {
        ParityCheck.assertParity("continuous-driving", 4);
    }
}
