package com.microboxlabs.miot.integrations.domain;

import java.util.List;
import java.util.Map;

/**
 * Whole-ledger shape of a tenant's jobs, read in one pass: per-state row counts
 * for the console's summary tiles plus the distinct job types and executor
 * lanes that populate its filter dropdowns. The dropdowns must not be derived
 * from the rows of the current page — a page holds at most a few dozen jobs, so
 * the options would change as the operator pages through the ledger.
 */
public record JobLedgerFacets(
        Map<String, Integer> counts,
        List<String> jobTypes,
        List<String> executors) {}
