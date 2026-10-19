package com.microboxlabs.miot.symptoms.evaluator.evals;

import org.junit.jupiter.api.Test;

/**
 * Real trips through the evaluator with production's rule for stopping at night outside an authorized zone;
 * see {@code evals/night-stop-unauthorized/README.md}.
 */
class NightStopParityEvalTest {

    @Test
    void realTripsGiveTheTransitionsProductionGave() {
        ParityCheck.assertParity("night-stop-unauthorized", 30);
    }
}
