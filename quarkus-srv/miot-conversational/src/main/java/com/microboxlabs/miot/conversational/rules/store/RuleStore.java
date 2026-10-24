package com.microboxlabs.miot.conversational.rules.store;

import com.fasterxml.jackson.databind.JsonNode;
import com.microboxlabs.miot.conversational.rules.Rule;
import com.microboxlabs.miot.conversational.rules.RuleBump;
import com.microboxlabs.miot.conversational.rules.RuleVersion;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/** Rules and their versions. */
public interface RuleStore {

    /** A rule in TEST or ACTIVE with its published version in force. */
    record InForce(Rule rule, RuleVersion version) {
    }

    List<Rule> list(String tenantCode);

    /** Every organization's rules, for the platform's template usage. */
    List<Rule> listAll();

    Optional<Rule> find(String tenantCode, String id);

    /** Throws {@link IllegalStateException} when the tenant already has a rule with that key. */
    Rule create(Rule rule);

    /** Writes the state; empty when the rule does not exist. */
    Optional<Rule> updateState(String tenantCode, String id, Rule.State state, Instant at);

    /** Every version of the rule, the draft included, newest first. */
    List<RuleVersion> versions(String ruleId);

    Optional<RuleVersion> version(String ruleId, String version);

    /** The draft and the version in force of each of these rules, in one read. */
    List<RuleVersion> liveVersions(List<String> ruleIds);

    /** Creates or replaces the rule's draft. */
    RuleVersion saveDraft(String ruleId, JsonNode spec, String actor, Instant at);

    /**
     * Turns the draft into {@code version} and makes it current, provided its spec is still {@code validated}
     * and the rule's current version is still {@code from} (null: none); empty when there is no draft, it changed
     * since it was validated, or another publish moved the current version.
     */
    Optional<RuleVersion> publish(String ruleId, JsonNode validated, String from, String version, RuleBump bump,
            String reason, String actor, Instant at);

    List<InForce> inForce(String tenantCode);
}
