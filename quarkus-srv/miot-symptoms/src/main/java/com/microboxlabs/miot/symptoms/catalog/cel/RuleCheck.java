package com.microboxlabs.miot.symptoms.catalog.cel;

import java.util.List;

/** Result of checking a rule: ok with its CEL result type, or the issues found. */
public record RuleCheck(boolean ok, String resultType, List<RuleIssue> issues) {

    static RuleCheck passed(String resultType) {
        return new RuleCheck(true, resultType, List.of());
    }

    static RuleCheck failed(RuleIssue issue) {
        return failed(List.of(issue));
    }

    static RuleCheck failed(List<RuleIssue> issues) {
        return new RuleCheck(false, null, List.copyOf(issues));
    }
}
