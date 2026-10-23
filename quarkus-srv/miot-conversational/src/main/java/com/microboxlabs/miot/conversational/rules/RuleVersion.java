package com.microboxlabs.miot.conversational.rules;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;

/** One version of a rule's spec: the DRAFT (version null, at most one per rule) or a PUBLISHED version. */
public record RuleVersion(String id, @JsonIgnore String ruleId, Integer version, Status status, JsonNode spec,
        String reason, Instant createdAt, String createdBy) {

    public enum Status {
        DRAFT,
        PUBLISHED
    }
}
