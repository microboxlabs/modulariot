package com.microboxlabs.miot.integrations.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

class EventConditionMatcherTest {

    private static final Map<String, Object> REJECTED = Map.of(
            "review", Map.of("verdict", false, "reviewer", "revisor.demo"),
            "task", Map.of("priority", "UR"));

    private static final Map<String, Object> APPROVED = Map.of(
            "review", Map.of("verdict", true, "reviewer", "revisor.demo"),
            "task", Map.of("priority", "NORMAL"));

    @Test
    void anEmptyConditionMatchesEverything() {
        assertTrue(EventConditionMatcher.matches(Map.of(), REJECTED));
        assertTrue(EventConditionMatcher.matches(null, APPROVED));
    }

    @Test
    void onlyRejectionsIsJustDataNotAnEnum() {
        Map<String, Object> onlyRejections = Map.of("review.verdict", false);

        assertTrue(EventConditionMatcher.matches(onlyRejections, REJECTED));
        assertFalse(EventConditionMatcher.matches(onlyRejections, APPROVED));
    }

    @Test
    void comparesAcrossTheJsonBooleanAndItsTextForm() {
        // A stored condition may hold "false" (a UI select, a hand-written row) while the
        // event carries a real boolean. Refusing to dispatch over that would be indefensible.
        assertTrue(EventConditionMatcher.matches(Map.of("review.verdict", "false"), REJECTED));
        assertTrue(EventConditionMatcher.matches(Map.of("review.verdict", "FALSE"), REJECTED));
    }

    @Test
    void everyEntryMustMatch() {
        Map<String, Object> both = new LinkedHashMap<>();
        both.put("review.verdict", false);
        both.put("task.priority", "UR");
        assertTrue(EventConditionMatcher.matches(both, REJECTED));

        both.put("task.priority", "NORMAL");
        assertFalse(EventConditionMatcher.matches(both, REJECTED));
    }

    @Test
    void aPathThatResolvesToNothingDoesNotMatch() {
        assertFalse(EventConditionMatcher.matches(Map.of("review.missing", "x"), REJECTED));
    }

    @Test
    void anExpectedNullMatchesAnAbsentValue() {
        Map<String, Object> expectNull = new LinkedHashMap<>();
        expectNull.put("review.missing", null);

        assertTrue(EventConditionMatcher.matches(expectNull, REJECTED));
    }
}
