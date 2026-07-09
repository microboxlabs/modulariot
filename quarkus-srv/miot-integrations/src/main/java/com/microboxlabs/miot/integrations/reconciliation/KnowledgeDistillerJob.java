package com.microboxlabs.miot.integrations.reconciliation;

import com.microboxlabs.miot.integrations.client.HarnessDistillClient;
import com.microboxlabs.miot.integrations.domain.InteractionEpisode;
import com.microboxlabs.miot.integrations.domain.KnowledgeCandidate;
import com.microboxlabs.miot.integrations.dto.CandidateRequest;
import com.microboxlabs.miot.integrations.dto.DistillCandidate;
import com.microboxlabs.miot.integrations.dto.DistillResponse;
import com.microboxlabs.miot.integrations.persistence.InteractionEpisodeRepository;
import com.microboxlabs.miot.integrations.service.CandidateService;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.rest.client.inject.RestClient;
import org.jboss.logging.Logger;

/**
 * Background knowledge distiller (R3, Option A) — the DISTILL stage's driver.
 *
 * <p>OFF the request hot path, on a schedule, for each tenant with recent
 * interaction activity: read its recent episodes, group them by the connection
 * their ungrounded assumptions name, POST each connection's batch to the harness
 * {@code /distill} endpoint (which owns the LLM + the authoritative cards), and
 * stage the returned candidate facts in {@code knowledge_candidates} — pending
 * the human gate. The modulith owns the data (episodes in, candidates out); the
 * harness lends the reflection. Nothing is ever auto-promoted here.
 *
 * <p>OFF by default ({@code miot.distill.enabled=false}): the pass is inert until
 * an operator enables it AND provisions the harness credential (the outbound call
 * needs a service bearer in an auth-enabled deployment — an ops prereq). The cron
 * fires regardless but returns immediately while disabled.
 */
@ApplicationScoped
public class KnowledgeDistillerJob {

    private static final Logger LOG = Logger.getLogger(KnowledgeDistillerJob.class);

    // How many already-pending candidates to scan per tenant for dedup. Well
    // above any realistic pending backlog for one tenant.
    private static final int PENDING_SCAN_LIMIT = 500;

    private final InteractionEpisodeRepository episodes;
    private final CandidateService candidates;
    private final HarnessDistillClient harness;
    private final boolean enabled;
    private final int lookbackHours;
    private final int batchLimit;
    private final String authMode;
    // Optional, not defaultValue="" — SmallRye treats an empty-string default as
    // UNCONFIGURED and then fails the injection as "required". Absent → empty.
    private final Optional<String> harnessToken;

    @Inject
    public KnowledgeDistillerJob(
            InteractionEpisodeRepository episodes,
            CandidateService candidates,
            @RestClient HarnessDistillClient harness,
            @ConfigProperty(name = "miot.distill.enabled", defaultValue = "false") boolean enabled,
            @ConfigProperty(name = "miot.distill.lookback-hours", defaultValue = "24") int lookbackHours,
            @ConfigProperty(name = "miot.distill.batch-limit", defaultValue = "200") int batchLimit,
            @ConfigProperty(name = "miot.distill.auth-mode", defaultValue = "m2m") String authMode,
            @ConfigProperty(name = "miot.distill.harness-token") Optional<String> harnessToken) {
        this.episodes = episodes;
        this.candidates = candidates;
        this.harness = harness;
        this.enabled = enabled;
        this.lookbackHours = lookbackHours;
        this.batchLimit = batchLimit;
        this.authMode = authMode;
        this.harnessToken = harnessToken;
    }

    @Scheduled(
            cron = "{miot.distill.cron}",
            concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void reconcile() {
        if (!enabled) {
            return;
        }
        OffsetDateTime since = OffsetDateTime.now(ZoneOffset.UTC).minusHours(lookbackHours);
        List<String> tenants = episodes.listDistinctTenantsSince(since);
        LOG.debugf("distiller: %d tenant(s) with recent activity", tenants.size());
        for (String tenantCode : tenants) {
            try {
                distillTenant(tenantCode, since);
            } catch (RuntimeException e) {
                // One tenant's failure (harness down, a bad batch) must not stop
                // the pass for the others — log and continue.
                LOG.warnf(e, "distiller: tenant %s failed", tenantCode);
            }
        }
    }

    private void distillTenant(String tenantCode, OffsetDateTime since) {
        List<InteractionEpisode> recent =
                episodes.listRecentByTenant(tenantCode, since, batchLimit);
        Map<String, List<Map<String, Object>>> byConnection = groupByConnection(recent);
        if (byConnection.isEmpty()) {
            return;
        }
        // Dedup against candidates already pending for this tenant, so a repeated
        // pass over the same (overlapping-window) episodes doesn't flood the review
        // queue with duplicates. The set also grows within the pass to dedup a term
        // that recurs across connections. Approved/rejected terms are NOT in here,
        // so a re-learn after a rejection can still be re-proposed.
        Set<String> staged = pendingKeys(tenantCode);
        String bearer = harnessToken
                .filter(t -> !t.isBlank())
                .map(t -> "Bearer " + t)
                .orElse(null);
        for (Map.Entry<String, List<Map<String, Object>>> entry : byConnection.entrySet()) {
            String connection = entry.getKey();
            try {
                DistillResponse resp = harness.distill(
                        connection, tenantCode, authMode, bearer,
                        Map.of("episodes", entry.getValue()));
                stage(tenantCode, connection, resp, staged);
            } catch (RuntimeException e) {
                // A harness error or a bad batch on ONE connection must not stop
                // the tenant's other connections.
                LOG.warnf(e, "distiller: tenant %s connection %s failed", tenantCode, connection);
            }
        }
    }

    private Set<String> pendingKeys(String tenantCode) {
        Set<String> keys = new LinkedHashSet<>();
        for (KnowledgeCandidate c : candidates.list(tenantCode, "pending", PENDING_SCAN_LIMIT)) {
            keys.add(dedupeKey(c.connection(), c.term()));
        }
        return keys;
    }

    private void stage(
            String tenantCode, String connection, DistillResponse resp, Set<String> staged) {
        if (resp == null || resp.candidates() == null) {
            return;
        }
        for (DistillCandidate c : resp.candidates()) {
            String conn = c.connection() != null ? c.connection() : connection;
            if (c.term() == null || c.term().isBlank() || !staged.add(dedupeKey(conn, c.term()))) {
                continue; // blank term, or already pending / already staged this pass
            }
            try {
                // created_by is null — a system-distilled candidate has no user
                // author; the human gate assigns the reviewer on approval.
                candidates.create(tenantCode, null, new CandidateRequest(
                        conn, c.term(), c.kind(), c.scope(), c.confidence(), c.body(), c.provenance()));
            } catch (IllegalArgumentException e) {
                // A malformed candidate (e.g. blank body) is skipped, never fatal —
                // one bad item must not drop the rest of the batch.
                staged.remove(dedupeKey(conn, c.term()));
                LOG.warnf(e, "distiller: skipped a malformed candidate for %s/%s", tenantCode, conn);
            }
        }
    }

    private static String dedupeKey(String connection, String term) {
        return (connection == null ? "" : connection)
                + "|"
                + (term == null ? "" : term.strip().toLowerCase());
    }

    /**
     * Group each episode's wire telemetry under the connection(s) its UNGROUNDED
     * assumptions name (R2c-3 stamps the connection on each assumption). An
     * episode whose assumptions are all grounded, or carry no connection, teaches
     * nothing and is dropped. Multi-connection episodes appear under each.
     * Package-visible + static so the grouping is unit-tested without CDI/HTTP.
     */
    static Map<String, List<Map<String, Object>>> groupByConnection(
            List<InteractionEpisode> episodes) {
        Map<String, List<Map<String, Object>>> out = new LinkedHashMap<>();
        for (InteractionEpisode ep : episodes) {
            Map<String, Object> wire = toWire(ep);
            for (String connection : ungroundedConnectionsOf(ep)) {
                out.computeIfAbsent(connection, k -> new ArrayList<>()).add(wire);
            }
        }
        return out;
    }

    private static Set<String> ungroundedConnectionsOf(InteractionEpisode ep) {
        Set<String> out = new LinkedHashSet<>();
        Object raw = ep.payload() == null ? null : ep.payload().get("assumptions");
        if (!(raw instanceof List<?> list)) {
            return out;
        }
        for (Object item : list) {
            // Collect the connection of each UNGROUNDED, connection-stamped
            // assumption; a grounded or unstamped one teaches nothing.
            if (item instanceof Map<?, ?> assumption
                    && !Boolean.TRUE.equals(assumption.get("grounded"))
                    && assumption.get("connection") instanceof String conn
                    && !conn.isBlank()) {
                out.add(conn);
            }
        }
        return out;
    }

    private static Map<String, Object> toWire(InteractionEpisode ep) {
        Map<String, Object> wire = new LinkedHashMap<>();
        wire.put("run_id", ep.runId());
        wire.put("surface", ep.surface());
        wire.put("signal", ep.signal());
        wire.put("payload", ep.payload());
        return wire;
    }
}
