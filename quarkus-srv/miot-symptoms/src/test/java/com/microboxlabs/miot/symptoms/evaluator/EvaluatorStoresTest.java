package com.microboxlabs.miot.symptoms.evaluator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.evaluator.EvaluatorBenchmarkTest.Env;
import com.microboxlabs.miot.symptoms.evaluator.EvaluatorBenchmarkTest.Signal;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * The evaluator on the Redis stores, read in one pipeline per organization, against the in-memory stores: the
 * platform templates on synthetic signals ({@link EvaluatorBenchmarkTest}).
 */
class EvaluatorStoresTest {

    private static final Instant START = Instant.parse("2026-11-07T12:00:00Z");

    @Test
    void theRedisStoresRecordTheSameCasesAsTheInMemoryOnes() {
        Env redis = new Env(0, 0, false);
        Env memory = new Env(0, 0, true);
        List<Signal> signals = EvaluatorBenchmarkTest.signals(40, 2000, START, 7);

        signals.forEach(s -> {
            Instant arrived = Instant.now();
            redis.stream.evaluate(s.json(), arrived);
            memory.stream.evaluate(s.json(), arrived);
        });

        List<String> fromRedis = cases(redis);
        assertFalse(fromRedis.isEmpty(), "the signals open cases");
        assertEquals(cases(memory), fromRedis);
        redis.redis.close();
    }

    @Test
    void eachOrganizationIsReadAndWrittenOncePerSignalAndTheHoldsReadOnce() {
        Env env = new Env(0, 0, false);
        List<Signal> signals = EvaluatorBenchmarkTest.signals(5, 10, START, 3);
        env.stream.evaluate(signals.get(0).json(), Instant.now());
        env.reset();

        // Vehicle 0 belongs to both organizations: each has GPS symptoms and symptoms on the duty counters.
        Signal shared = signals.get(5);
        assertTrue(shared.json().contains(EvaluatorBenchmarkTest.OTHER));
        env.stream.evaluate(shared.json(), Instant.now());

        Map<String, Long> commands = env.redis.commands();
        assertEquals(2L, commands.get("HGETALL"), "one read of the episodes per organization");
        assertEquals(2L, commands.get("EVAL episodes.save"), "one write of the episodes per organization");
        assertEquals(2L, commands.get("EVAL duty.write"));
        assertEquals(2, env.holdQueries.get(), "the holds read once per organization with ACTIVE symptoms");
        env.redis.close();
    }

    /** The recorded changes, without the symptom ids, which each catalog draws anew. */
    private static List<String> cases(Env env) {
        return env.recorded.recorded.stream()
                .map(t -> t.kind() + " " + t.state() + " " + t.assetId() + " " + t.at() + " " + t.level()
                        + " " + t.previousLevel())
                .sorted(Comparator.naturalOrder()).toList();
    }
}
