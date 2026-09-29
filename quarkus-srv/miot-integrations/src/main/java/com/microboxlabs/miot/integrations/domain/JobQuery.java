package com.microboxlabs.miot.integrations.domain;

/**
 * One page of the job ledger: the filters, the page size and where the page
 * starts. The same record drives the listing and its total count, so a page and
 * its "of N" can never be computed from different predicates.
 *
 * <p>{@code search} is the console's free-text needle. It matches a job-id
 * prefix or a substring of the correlation key, chain key or job type; the
 * service escapes {@code LIKE} wildcards before it reaches SQL.
 */
public record JobQuery(
        String state,
        String correlationKey,
        String jobType,
        String chainKey,
        String executor,
        String search,
        int limit,
        int offset) {}
