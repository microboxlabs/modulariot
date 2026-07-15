package com.microboxlabs.miot.integrations.domain;

import java.time.OffsetDateTime;
import java.util.Map;

/**
 * One human-gated candidate business-semantics fact in the STAGING store of the
 * semantic-layer continual-learning loop. A candidate proposes that, for
 * {@code connection}, the business {@code term} means {@code body} (its MEANING,
 * never row-level secrets). It is authored via {@code /remember}, elicited on a
 * grounding.gap, or (later) distilled from {@code interaction_episodes}, and sits
 * at {@code status = 'pending'} until a human approves or rejects it. On approve
 * the app writes it to the harness as a connection-scoped card. {@code provenance}
 * (JSONB) carries the source run/episode ids; {@code scope} is the tier the fact
 * would apply at (personal | group[:id] | tenant).
 */
public record KnowledgeCandidate(
        String id,
        String tenantCode,
        String connection,
        String term,
        String kind,
        String scope,
        Double confidence,
        String body,
        Map<String, Object> provenance,
        String status,
        String createdBy,
        String reviewedBy,
        OffsetDateTime reviewedAt,
        OffsetDateTime createdAt) {
}
