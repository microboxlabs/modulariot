package com.microboxlabs.miot.symptoms.evaluator.evals;

import org.junit.jupiter.api.Test;

/** Real trips through the evaluator with production's speed rule; see {@code evals/speed/README.md}. */
class SpeedParityEvalTest {

    @Test
    void realTripsGiveTheTransitionsProductionGave() {
        ParityCheck.assertParity("speed", 59);
    }
}
