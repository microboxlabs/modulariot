package com.microboxlabs.miot.integrations.service;

import com.microboxlabs.miot.integrations.template.PayloadTemplate;
import java.util.Map;

/**
 * Decides whether a binding's {@code match_condition} holds for an event.
 *
 * <p>The condition is a flat map of context path → expected value; <b>all</b> entries must
 * match, and an empty condition always matches. "Only rejections" is therefore
 * {@code {"review.verdict": false}} — data, not the {@code ON_REJECT}/{@code ON_REVIEW} enum
 * an earlier draft of this feature hardcoded.
 *
 * <p>Comparison is by text. A JSON body arrives with {@code false} as a boolean but a stored
 * condition may hold {@code "false"} (a UI select, a hand-written row), and refusing to
 * dispatch over that difference would be indefensible. Types the operator cannot see are not
 * types they should have to reason about.
 */
public final class EventConditionMatcher {

    private EventConditionMatcher() {
    }

    /**
     * @param condition path → expected value; empty or null matches everything
     * @param context the event's {@code {task, content, review, session}} snapshot
     */
    public static boolean matches(Map<String, Object> condition, Map<String, Object> context) {
        if (condition == null || condition.isEmpty()) {
            return true;
        }
        for (Map.Entry<String, Object> expectation : condition.entrySet()) {
            Object actual = PayloadTemplate.resolve(expectation.getKey(), context);
            if (!equalAsText(expectation.getValue(), actual)) {
                return false;
            }
        }
        return true;
    }

    private static boolean equalAsText(Object expected, Object actual) {
        if (expected == null || actual == null) {
            return expected == null && actual == null;
        }
        return String.valueOf(expected).equalsIgnoreCase(String.valueOf(actual));
    }
}
