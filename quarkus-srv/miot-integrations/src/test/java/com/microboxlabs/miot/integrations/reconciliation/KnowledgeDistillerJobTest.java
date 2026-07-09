package com.microboxlabs.miot.integrations.reconciliation;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.client.HarnessDistillClient;
import com.microboxlabs.miot.integrations.domain.InteractionEpisode;
import com.microboxlabs.miot.integrations.domain.KnowledgeCandidate;
import com.microboxlabs.miot.integrations.dto.DistillCandidate;
import com.microboxlabs.miot.integrations.dto.DistillResponse;
import com.microboxlabs.miot.integrations.persistence.InteractionEpisodeRepository;
import com.microboxlabs.miot.integrations.persistence.KnowledgeCandidateRepository;
import com.microboxlabs.miot.integrations.service.CandidateService;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class KnowledgeDistillerJobTest {

    private static InteractionEpisode episode(String runId, Object assumptions) {
        Map<String, Object> payload = new java.util.LinkedHashMap<>();
        payload.put("query", "cuantos servicios en entregas");
        payload.put("assumptions", assumptions);
        return new InteractionEpisode(
                null, "tenantA", null, "spotlight", runId, "rephrase", payload, null);
    }

    private static Map<String, Object> assumption(String term, boolean grounded, String connection) {
        Map<String, Object> a = new java.util.LinkedHashMap<>();
        a.put("term", term);
        a.put("grounded", grounded);
        if (connection != null) {
            a.put("connection", connection);
        }
        return a;
    }

    // --- groupByConnection (pure) -------------------------------------------

    @Test
    void groupsEpisodesUnderTheirUngroundedConnection() {
        var episodes = List.of(
                episode("run_a", List.of(assumption("entregas", false, "acs"))),
                episode("run_b", List.of(assumption("despachos", false, "acs"))));
        var grouped = KnowledgeDistillerJob.groupByConnection(episodes);
        assertEquals(List.of("acs"), List.copyOf(grouped.keySet()));
        assertEquals(2, grouped.get("acs").size());
        assertEquals("run_a", grouped.get("acs").get(0).get("run_id"));
    }

    @Test
    void dropsGroundedAndUnstampedAssumptions() {
        var episodes = List.of(
                episode("run_grounded", List.of(assumption("entregas", true, "acs"))),
                episode("run_unstamped", List.of(assumption("entregas", false, null))),
                episode("run_noassumptions", List.of()));
        assertTrue(KnowledgeDistillerJob.groupByConnection(episodes).isEmpty());
    }

    @Test
    void multiConnectionEpisodeAppearsUnderEach() {
        var episodes = List.of(episode("run_x", List.of(
                assumption("entregas", false, "acs"),
                assumption("cobranzas", false, "nexo"))));
        var grouped = KnowledgeDistillerJob.groupByConnection(episodes);
        assertEquals(1, grouped.get("acs").size());
        assertEquals(1, grouped.get("nexo").size());
    }

    // --- reconcile() gate + staging -----------------------------------------

    @Test
    void disabledJobTouchesNothing() {
        var episodes = new FakeEpisodeRepo();
        episodes.throwIfRead = true; // any read is a failure when disabled
        var job = new KnowledgeDistillerJob(
                episodes, candidateService(new FakeCandidateRepo()),
                (c, t, m, a, b) -> { throw new AssertionError("must not call harness"); },
                false, 24, 200, "m2m", "");
        job.reconcile(); // must be a no-op, no exception
    }

    @Test
    void enabledJobStagesReturnedCandidates() {
        var episodes = new FakeEpisodeRepo();
        episodes.tenants = List.of("tenantA");
        episodes.recent = List.of(episode("run_a", List.of(assumption("entregas", false, "acs"))));
        var candidateRepo = new FakeCandidateRepo();

        HarnessDistillClient client = (connection, tenant, mode, auth, body) -> new DistillResponse(
                connection,
                List.of(new DistillCandidate(
                        "acs", "entregas", "task_def_key in (confirmDelivery)",
                        "stage", "tenant", 0.9, Map.of("run_ids", List.of("run_a")))));

        var job = new KnowledgeDistillerJob(
                episodes, candidateService(candidateRepo), client, true, 24, 200, "m2m", "");
        job.reconcile();

        assertEquals(1, candidateRepo.inserted.size());
        KnowledgeCandidate staged = candidateRepo.inserted.get(0);
        assertEquals("tenantA", staged.tenantCode());
        assertEquals("entregas", staged.term());
        assertEquals("acs", staged.connection());
        assertNull(staged.createdBy()); // system-distilled → no user author
        assertEquals("pending", staged.status());
        assertFalse(episodes.recentTenant == null); // proves the read path ran
    }

    @Test
    void dedupsAgainstExistingPendingCandidates() {
        var episodes = new FakeEpisodeRepo();
        episodes.tenants = List.of("tenantA");
        episodes.recent = List.of(episode("run_a", List.of(assumption("entregas", false, "acs"))));
        var candidateRepo = new FakeCandidateRepo();
        candidateRepo.pending.add(pendingCandidate("acs", "entregas")); // already queued

        HarnessDistillClient client = (connection, tenant, mode, auth, body) -> new DistillResponse(
                connection, List.of(new DistillCandidate(
                        "acs", "Entregas", "def", "stage", "tenant", 0.9, Map.of())));

        var job = new KnowledgeDistillerJob(
                episodes, candidateService(candidateRepo), client, true, 24, 200, "m2m", "");
        job.reconcile();

        // Case-insensitively the same term is already pending → not re-staged.
        assertTrue(candidateRepo.inserted.isEmpty());
    }

    @Test
    void skipsMalformedCandidateAndContinuesTheBatch() {
        var episodes = new FakeEpisodeRepo();
        episodes.tenants = List.of("tenantA");
        episodes.recent = List.of(episode("run_a", List.of(assumption("entregas", false, "acs"))));
        var candidateRepo = new FakeCandidateRepo();

        HarnessDistillClient client = (connection, tenant, mode, auth, body) -> new DistillResponse(
                connection, List.of(
                        new DistillCandidate("acs", "entregas", "def1", "stage", "tenant", 0.9, Map.of()),
                        new DistillCandidate("acs", "despachos", "  ", "stage", "tenant", 0.9, Map.of()),
                        new DistillCandidate("acs", "cobranzas", "def3", "stage", "tenant", 0.9, Map.of())));

        var job = new KnowledgeDistillerJob(
                episodes, candidateService(candidateRepo), client, true, 24, 200, "m2m", "");
        job.reconcile(); // the blank-body candidate must not abort the batch

        assertEquals(List.of("entregas", "cobranzas"),
                candidateRepo.inserted.stream().map(KnowledgeCandidate::term).toList());
    }

    private static CandidateService candidateService(FakeCandidateRepo repo) {
        return new CandidateService(repo);
    }

    // --- fakes (null pool, no DB) -------------------------------------------

    private static class FakeEpisodeRepo extends InteractionEpisodeRepository {
        List<String> tenants = List.of();
        List<InteractionEpisode> recent = List.of();
        String recentTenant;
        boolean throwIfRead;

        FakeEpisodeRepo() {
            super(null);
        }

        @Override
        public List<String> listDistinctTenantsSince(OffsetDateTime since) {
            if (throwIfRead) {
                throw new AssertionError("disabled job must not read episodes");
            }
            return tenants;
        }

        @Override
        public List<InteractionEpisode> listRecentByTenant(
                String tenantCode, OffsetDateTime since, int limit) {
            this.recentTenant = tenantCode;
            return recent;
        }
    }

    private static class FakeCandidateRepo extends KnowledgeCandidateRepository {
        final List<KnowledgeCandidate> inserted = new ArrayList<>();
        final List<KnowledgeCandidate> pending = new ArrayList<>();

        FakeCandidateRepo() {
            super(null);
        }

        @Override
        public KnowledgeCandidate insert(KnowledgeCandidate candidate) {
            inserted.add(candidate);
            return candidate;
        }

        @Override
        public List<KnowledgeCandidate> listByStatus(String tenantCode, String status, int limit) {
            return pending;
        }
    }

    private static KnowledgeCandidate pendingCandidate(String connection, String term) {
        return new KnowledgeCandidate(
                null, "tenantA", connection, term, null, "tenant", null, "body",
                Map.of(), "pending", null, null, null, null);
    }
}
