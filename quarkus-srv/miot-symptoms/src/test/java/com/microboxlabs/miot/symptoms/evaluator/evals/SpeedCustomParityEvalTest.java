package com.microboxlabs.miot.symptoms.evaluator.evals;

import org.junit.jupiter.api.Test;

/**
 * Real trips through the evaluator with production's rule for speeding over the organization's own limits;
 * see {@code evals/speed-custom/README.md}.
 */
class SpeedCustomParityEvalTest {

    @Test
    void realTripsGiveTheTransitionsProductionGave() {
        ParityCheck.assertParity("speed-custom", 18);
    }
}
