package com.microboxlabs.miot.integrations.service;

import com.microboxlabs.miot.integrations.domain.KnowledgeCandidate;
import com.microboxlabs.miot.integrations.dto.CandidateRequest;
import com.microboxlabs.miot.integrations.persistence.KnowledgeCandidateRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Stages and reviews knowledge candidates for the semantic-layer learning loop.
 * Create validates + injects tenant/reviewer server-side; review transitions a
 * pending candidate to approved/rejected (idempotent — the repository's
 * {@code status = 'pending'} guard means a second review returns null, which the
 * resource maps to 404). This service never writes to the harness: on approve the
 * app calls the harness card-write endpoint (R2a) so the modulith holds no harness
 * egress. Validation throws {@link IllegalArgumentException}, mapped to HTTP 400.
 */
@ApplicationScoped
public class CandidateService {

    private static final Set<String> STATUSES = Set.of("pending", "approved", "rejected");
    private static final int DEFAULT_LIMIT = 100;
    private static final int MAX_LIMIT = 500;

    private final KnowledgeCandidateRepository repository;

    @Inject
    public CandidateService(KnowledgeCandidateRepository repository) {
        this.repository = repository;
    }

    public KnowledgeCandidate create(String tenantCode, String userId, CandidateRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("candidate body is required");
        }
        String connection = require(request.connection(), "connection");
        String term = require(request.term(), "term");
        String body = require(request.body(), "body");
        return repository.insert(new KnowledgeCandidate(
                null,
                tenantCode,
                connection,
                term,
                blankToNull(request.kind()),
                blankToDefault(request.scope(), "tenant"),
                request.confidence(),
                body,
                request.provenance() == null ? Map.of() : request.provenance(),
                "pending",
                userId,
                null,
                null,
                null));
    }

    public List<KnowledgeCandidate> list(String tenantCode, String status, int limit) {
        String resolved = blankToDefault(status, "pending");
        if (!STATUSES.contains(resolved)) {
            throw new IllegalArgumentException("status must be one of " + STATUSES);
        }
        int bounded = limit <= 0 ? DEFAULT_LIMIT : Math.min(limit, MAX_LIMIT);
        return repository.listByStatus(tenantCode, resolved, bounded);
    }

    /**
     * Approves ('approve') or rejects ('reject') a pending candidate, stamping the
     * reviewer. Returns the updated candidate, or {@code null} when it is unknown,
     * belongs to another tenant, or was already reviewed. A malformed id or an
     * unknown decision throws {@link IllegalArgumentException} (HTTP 400).
     */
    public KnowledgeCandidate review(String tenantCode, String id, String decision, String reviewerId) {
        String status = switch (decision == null ? "" : decision) {
            case "approve" -> "approved";
            case "reject" -> "rejected";
            default -> throw new IllegalArgumentException("decision must be 'approve' or 'reject'");
        };
        return repository.updateStatus(tenantCode, id, status, reviewerId);
    }

    private static String require(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " is required");
        }
        return value;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private static String blankToDefault(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }
}
