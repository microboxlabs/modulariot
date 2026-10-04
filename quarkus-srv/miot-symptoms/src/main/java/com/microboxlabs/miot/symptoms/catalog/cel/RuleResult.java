package com.microboxlabs.miot.symptoms.catalog.cel;

/** Result of running a rule on one sample: the value, or why it could not run. */
public record RuleResult(boolean ok, Object value, String error) {

    static RuleResult of(Object value) {
        return new RuleResult(true, value, null);
    }

    static RuleResult failed(String error) {
        return new RuleResult(false, null, error);
    }
}
