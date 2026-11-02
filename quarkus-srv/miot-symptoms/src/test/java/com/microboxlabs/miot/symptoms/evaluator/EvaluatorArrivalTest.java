package com.microboxlabs.miot.symptoms.evaluator;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.Test;

class EvaluatorArrivalTest {

    private static final Instant PUBLISHED = Instant.parse("2026-11-02T12:10:00Z");

    @Test
    void theGatewayTimeWinsOverTheBuildersPublishTime() {
        assertEquals(Instant.parse("2026-11-02T12:00:01Z"),
                EvaluatorStream.arrival(Map.of("received_at", "2026-11-02T12:00:01Z"), PUBLISHED),
                "a backlog before the builder is not the device's delay");
    }

    @Test
    void withoutAGatewayTimeThePublishTimeIsTheArrival() {
        assertEquals(PUBLISHED, EvaluatorStream.arrival(Map.of(), PUBLISHED));
        assertEquals(PUBLISHED, EvaluatorStream.arrival(Map.of("received_at", "not a time"), PUBLISHED));
    }
}
