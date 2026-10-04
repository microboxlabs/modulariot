package com.microboxlabs.miot.symptoms.evaluator.evals;

import org.junit.jupiter.api.Test;

/** Real trips through the evaluator with production's lost-signal rule; see {@code evals/lost-signal/README.md}. */
class LostSignalParityEvalTest {

    @Test
    void realTripsGiveTheTransitionsProductionGave() {
        ParityCheck.assertParity("lost-signal", 59);
    }
}
