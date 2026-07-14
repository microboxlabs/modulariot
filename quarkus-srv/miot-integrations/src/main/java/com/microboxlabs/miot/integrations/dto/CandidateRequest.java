package com.microboxlabs.miot.integrations.dto;

import java.util.Map;

/**
 * Request body to stage a knowledge candidate. {@code connection}, {@code term},
 * and {@code body} are required; the rest are optional. {@code body} records the
 * MEANING of the term (never row-level secrets); {@code provenance} is free-form
 * JSONB carrying the source run/episode ids. Validation is imperative in
 * {@code CandidateService} (mirrors the other integrations DTOs — plain records,
 * no bean-validation annotations). tenant + reviewer identity are NEVER taken
 * from the body; the resource injects them from the session.
 */
public record CandidateRequest(
        String connection,
        String term,
        String kind,
        String scope,
        Double confidence,
        String body,
        Map<String, Object> provenance) {
}
