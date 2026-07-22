package com.microboxlabs.miot.integrations.dto;

import java.util.Map;

/**
 * One candidate business fact from the harness distiller — maps 1:1 to the
 * harness {@code CandidateFact} ({@code asdict}). {@code body} states the term's
 * MEANING (never row-level data); {@code provenance} carries the source
 * {@code run_ids} + evidence count that grounded it.
 */
public record DistillCandidate(
        String connection,
        String term,
        String body,
        String kind,
        String scope,
        Double confidence,
        Map<String, Object> provenance) {
}
