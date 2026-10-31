package com.microboxlabs.miot.conversational.rules;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;

/**
 * One version of a rule's spec: the DRAFT (version and bump null, at most one per rule) or a PUBLISHED semantic
 * version with the bump it was published with.
 */
public record RuleVersion(String id, @JsonIgnore String ruleId, String version, RuleBump bump, Status status,
        JsonNode spec, String reason, Instant createdAt, String createdBy) {

    public enum Status {
        DRAFT,
        PUBLISHED
    }
}
