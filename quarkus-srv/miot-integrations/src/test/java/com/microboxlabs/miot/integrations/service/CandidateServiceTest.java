package com.microboxlabs.miot.integrations.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.microboxlabs.miot.integrations.domain.KnowledgeCandidate;
import com.microboxlabs.miot.integrations.dto.CandidateRequest;
import com.microboxlabs.miot.integrations.persistence.KnowledgeCandidateRepository;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class CandidateServiceTest {

    private static CandidateRequest req(String connection, String term, String body) {
        return new CandidateRequest(connection, term, null, null, null, body, null);
    }

    @Test
    void createRejectsNullBodyAndMissingRequiredFields() {
        var service = new CandidateService(new FakeRepository());
        assertThrows(IllegalArgumentException.class, () -> service.create("t", "u", null));
        assertThrows(IllegalArgumentException.class,
                () -> service.create("t", "u", req(null, "entregas", "def")));
        assertThrows(IllegalArgumentException.class,
                () -> service.create("t", "u", req("acs", "  ", "def")));
        assertThrows(IllegalArgumentException.class,
                () -> service.create("t", "u", req("acs", "entregas", "")));
    }

    @Test
    void createInjectsTenantReviewerDefaultsScopeAndProvenance() {
        var repo = new FakeRepository();
        var service = new CandidateService(repo);

        var saved = service.create("tenant-1", "user-1", req("acs", "entregas", "solo confirmDelivery"));

        assertNotNull(saved);
        assertEquals("tenant-1", repo.inserted.tenantCode());
        assertEquals("acs", repo.inserted.connection());
        assertEquals("entregas", repo.inserted.term());
        assertEquals("user-1", repo.inserted.createdBy());
        assertEquals("tenant", repo.inserted.scope()); // default
        assertEquals(Map.of(), repo.inserted.provenance()); // null -> empty map
        assertNull(repo.inserted.kind()); // blank -> null
    }

    @Test
    void listRejectsUnknownStatusAndDefaultsToPending() {
        var repo = new FakeRepository();
        var service = new CandidateService(repo);

        assertThrows(IllegalArgumentException.class, () -> service.list("t", "bogus", 0));

        service.list("t", "  ", 0);
        assertEquals("pending", repo.listedStatus);
        assertEquals(100, repo.listedLimit); // limit<=0 -> default
    }

    @Test
    void reviewMapsDecisionToStatusAndPassesReviewer() {
        var repo = new FakeRepository();
        var service = new CandidateService(repo);

        service.review("t", "id-1", "approve", "rev-1");
        assertEquals("approved", repo.updatedStatus);
        assertEquals("rev-1", repo.updatedReviewer);

        service.review("t", "id-1", "reject", "rev-2");
        assertEquals("rejected", repo.updatedStatus);
    }

    @Test
    void reviewRejectsUnknownDecision() {
        var service = new CandidateService(new FakeRepository());
        assertThrows(IllegalArgumentException.class,
                () -> service.review("t", "id-1", "maybe", "rev"));
        assertThrows(IllegalArgumentException.class,
                () -> service.review("t", "id-1", null, "rev"));
    }

    @Test
    void reviewReturnsNullWhenCandidateIsNotPending() {
        var repo = new FakeRepository();
        repo.updateResult = null; // not found / already reviewed / other tenant
        var service = new CandidateService(repo);
        assertNull(service.review("t", "id-x", "approve", "rev"));
    }

    /** Repository stub capturing calls (null pool, no DB) — mirrors EpisodeServiceTest. */
    private static class FakeRepository extends KnowledgeCandidateRepository {
        KnowledgeCandidate inserted;
        String listedStatus;
        int listedLimit;
        String updatedStatus;
        String updatedReviewer;
        KnowledgeCandidate updateResult = SENTINEL;

        FakeRepository() {
            super(null);
        }

        @Override
        public KnowledgeCandidate insert(KnowledgeCandidate candidate) {
            this.inserted = candidate;
            return candidate;
        }

        @Override
        public List<KnowledgeCandidate> listByStatus(String tenantCode, String status, int limit) {
            this.listedStatus = status;
            this.listedLimit = limit;
            return List.of();
        }

        @Override
        public KnowledgeCandidate updateStatus(String tenantCode, String id, String status, String reviewedBy) {
            this.updatedStatus = status;
            this.updatedReviewer = reviewedBy;
            return updateResult;
        }
    }

    private static final KnowledgeCandidate SENTINEL = new KnowledgeCandidate(
            "id", "t", "acs", "term", null, "tenant", null, "body",
            Map.of(), "approved", "u", "rev", null, null);
}
