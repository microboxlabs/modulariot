package com.microboxlabs.miot.conversational.rules;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.time.Instant;

/**
 * A conversation rule. {@code currentVersion} is the published version in force, null before the first publish.
 * OFF does nothing; TEST runs the rule and records its messages as SIMULATED; ACTIVE sends them.
 */
public record Rule(String id, @JsonIgnore String tenantCode, String key, String name, State state,
        String currentVersion, Instant createdAt, Instant updatedAt) {

    public enum State {
        OFF,
        TEST,
        ACTIVE
    }

    public Rule withState(State newState, Instant at) {
        return new Rule(id, tenantCode, key, name, newState, currentVersion, createdAt, at);
    }
}
