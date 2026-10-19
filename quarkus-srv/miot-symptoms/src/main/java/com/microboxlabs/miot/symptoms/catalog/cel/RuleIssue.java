package com.microboxlabs.miot.symptoms.catalog.cel;

/**
 * One problem in a rule.
 *
 * @param position zero-based character offset where it starts
 * @param message  in plain Spanish, for the owner
 * @param detail   the CEL message, for support
 */
public record RuleIssue(int position, String message, String detail) {
}
