package com.microboxlabs.miot.integrations.reconciliation;

import com.microboxlabs.miot.integrations.client.HarnessDistillClient;
import com.microboxlabs.miot.integrations.domain.InteractionEpisode;
import com.microboxlabs.miot.integrations.dto.CandidateRequest;
import com.microboxlabs.miot.integrations.dto.DistillCandidate;
import com.microboxlabs.miot.integrations.dto.DistillResponse;
import com.microboxlabs.miot.integrations.persistence.InteractionEpisodeRepository;
import com.microboxlabs.miot.integrations.service.CandidateService;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
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

    private final InteractionEpisodeRepository episodes;
    private final CandidateService candidates;
    private final HarnessDistillClient harness;
    private final boolean enabled;
    private final int lookbackHours;
    private final int batchLimit;
    private final String authMode;
    private final String bearerToken;

    @Inject
    public KnowledgeDistillerJob(
            InteractionEpisodeRepository episodes,
            CandidateService candidates,
            @RestClient HarnessDistillClient harness,
            @ConfigProperty(name = "miot.distill.enabled", defaultValue = "false") boolean enabled,
            @ConfigProperty(name = "miot.distill.lookback-hours", defaultValue = "24") int lookbackHours,
            @ConfigProperty(name = "miot.distill.batch-limit", defaultValue = "200") int batchLimit,
            @ConfigProperty(name = "miot.distill.auth-mode", defaultValue = "m2m") String authMode,
            @ConfigProperty(name = "miot.distill.harness-token", defaultValue = "") String bearerToken) {
        this.episodes = episodes;
        this.candidates = candidates;
        this.harness = harness;
        this.enabled = enabled;
        this.lookbackHours = lookbackHours;
        this.batchLimit = batchLimit;
        this.authMode = authMode;
        this.bearerToken = bearerToken;
    }

    @Scheduled(
            cron = "{miot.distill.cron}",
            concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void reconcile() {
        if (!enabled) {
            return;
        }
        OffsetDateTime since = OffsetDateTime.now().minusHours(lookbackHours);
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
        String bearer = bearerToken.isBlank() ? null : "Bearer " + bearerToken;
        for (Map.Entry<String, List<Map<String, Object>>> entry : byConnection.entrySet()) {
            String connection = entry.getKey();
            DistillResponse resp = harness.distill(
                    connection, tenantCode, authMode, bearer,
                    Map.of("episodes", entry.getValue()));
            stage(tenantCode, connection, resp);
        }
    }

    private void stage(String tenantCode, String connection, DistillResponse resp) {
        if (resp == null || resp.candidates() == null) {
            return;
        }
        for (DistillCandidate c : resp.candidates()) {
            // created_by is null — a system-distilled candidate has no user
            // author; the human gate assigns the reviewer on approval.
            candidates.create(tenantCode, null, new CandidateRequest(
                    c.connection() != null ? c.connection() : connection,
                    c.term(), c.kind(), c.scope(), c.confidence(), c.body(), c.provenance()));
        }
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
            if (!(item instanceof Map<?, ?> assumption)) {
                continue;
            }
            if (Boolean.TRUE.equals(assumption.get("grounded"))) {
                continue; // already grounded → nothing to learn
            }
            if (assumption.get("connection") instanceof String conn && !conn.isBlank()) {
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
