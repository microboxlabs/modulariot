package com.microboxlabs.miot.integrations.dto;

import java.util.List;

/**
 * The harness {@code /distill} response: the candidate facts it reflected from
 * the posted interaction episodes. Each candidate is staged verbatim via
 * {@code CandidateService.create} (status pending, awaiting the human gate).
 */
public record DistillResponse(String connection, List<DistillCandidate> candidates) {
}
