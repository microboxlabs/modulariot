package com.microboxlabs.miot.symptoms.catalog.domain;

/** A plain-language description of the rule text with this hash. HTML limited to b, i and mark. */
public record RuleDescription(String ruleHash, String locale, String audience, String html) {
}
