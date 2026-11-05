package com.microboxlabs.miot.symptoms.catalog.cel;

/**
 * One problem in a rule.
 *
 * @param position zero-based character offset where it starts
 * @param text     the problem as a code the app translates
 * @param detail   the CEL message, for support
 */
public record RuleIssue(int position, RuleMessage text, String detail) {

    /** The problem in Spanish. */
    public String message() {
        return text.spanish();
    }
}
