package com.microboxlabs.miot.gateway.fork.api;

import com.microboxlabs.miot.gateway.fork.ForkEngine;
import com.microboxlabs.miot.gateway.fork.ForkFilterRegistry;
import com.microboxlabs.miot.gateway.fork.model.ForkRule;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.jboss.logging.Logger;

/**
 * Internal management API for the fork engine.
 *
 * <p>Exposed at /internal/fork — accessible only within the cluster (ClusterIP service).
 * No authentication is applied since this endpoint is not reachable externally.
 *
 * <pre>
 * GET    /internal/fork/rules                       List all configured rules
 * GET    /internal/fork/rules/{id}/filter           Inspect the in-memory filter for a rule
 * POST   /internal/fork/rules/{id}/filter           Add keys to the filter (JSON array body)
 * DELETE /internal/fork/rules/{id}/filter/{key}     Remove a single key
 * POST   /internal/fork/rules/{id}/filter/reload    Reload filter from the configured file
 * </pre>
 */
@Path("/internal/fork")
@Produces(MediaType.APPLICATION_JSON)
@IfBuildProperty(name = "miot.component.gateway.enabled", stringValue = "true")
public class ForkManagementResource {

    private static final Logger LOG = Logger.getLogger(ForkManagementResource.class);

    private static final String FIELD_ERROR = "error";
    private static final String FIELD_TOTAL = "total";

    private final ForkEngine engine;
    private final ForkFilterRegistry filterRegistry;

    ForkManagementResource(ForkEngine engine, ForkFilterRegistry filterRegistry) {
        this.engine = engine;
        this.filterRegistry = filterRegistry;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Rules
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * List all active rules with their current filter size and target list.
     *
     * <p>Example response:
     * <pre>
     * [
     *   {
     *     "id": "asset-track-canary",
     *     "paths": ["/v1/asset/track"],
     *     "bodyParser": "JSON",
     *     "keyField": "asset_id",
     *     "filterFile": "/config/asset-ids.txt",
     *     "filterSize": 2,
     *     "targets": [
     *       {"id": "storm", "url": "https://storm.modulariot.com/v1/asset/track", "timeout": 5000}
     *     ]
     *   }
     * ]
     * </pre>
     */
    @GET
    @Path("/rules")
    public Response listRules() {
        List<Map<String, Object>> rules = engine.rules().stream()
                .map(this::summarize)
                .toList();
        return Response.ok(rules).build();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Filter inspection
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Return all routing keys currently in the in-memory filter for a rule.
     *
     * <p>Example response: {@code ["SVSX88", "ABC123"]}
     */
    @GET
    @Path("/rules/{id}/filter")
    public Response getFilter(@PathParam("id") String id) {
        Optional<ForkRule> rule = engine.findRule(id);
        if (rule.isEmpty()) {
            return ruleNotFound(id);
        }
        Set<String> keys = filterRegistry.inspect(id).orElse(Set.of());
        return Response.ok(keys).build();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Filter mutation
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Add one or more routing keys to the in-memory filter.
     *
     * <p>Request body: JSON array of strings — {@code ["DEF456", "GHI789"]}
     *
     * <p>Example response: {@code {"added": 2, "total": 4}}
     */
    @POST
    @Path("/rules/{id}/filter")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response addToFilter(@PathParam("id") String id, List<String> keys) {
        if (engine.findRule(id).isEmpty()) {
            return ruleNotFound(id);
        }
        if (keys == null || keys.isEmpty()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of(FIELD_ERROR, "Request body must be a non-empty JSON array of strings"))
                    .build();
        }
        int added = filterRegistry.add(id, keys);
        int total = filterRegistry.inspect(id).map(Set::size).orElse(0);
        LOG.infof("Filter add — rule=%s added=%d total=%d", id, added, total);
        return Response.ok(Map.of("added", added, FIELD_TOTAL, total)).build();
    }

    /**
     * Remove a single routing key from the in-memory filter.
     *
     * <p>Example response: {@code {"removed": true, "total": 3}}
     */
    @DELETE
    @Path("/rules/{id}/filter/{key}")
    public Response removeFromFilter(@PathParam("id") String id, @PathParam("key") String key) {
        if (engine.findRule(id).isEmpty()) {
            return ruleNotFound(id);
        }
        boolean removed = filterRegistry.remove(id, key);
        int total = filterRegistry.inspect(id).map(Set::size).orElse(0);
        LOG.infof("Filter remove — rule=%s key=%s removed=%b total=%d", id, key, removed, total);
        return Response.ok(Map.of("removed", removed, FIELD_TOTAL, total)).build();
    }

    /**
     * Reload the in-memory filter from the rule's configured filter file.
     * Replaces the entire current filter atomically.
     *
     * <p>Returns 409 if the rule has no filter file configured.
     *
     * <p>Example response: {@code {"loaded": 2, "total": 2}}
     */
    @POST
    @Path("/rules/{id}/filter/reload")
    public Response reloadFilter(@PathParam("id") String id) {
        if (engine.findRule(id).isEmpty()) {
            return ruleNotFound(id);
        }
        if (!filterRegistry.hasFilterFile(id)) {
            return Response.status(Response.Status.CONFLICT)
                    .entity(Map.of(FIELD_ERROR, "Rule '" + id + "' has no filter file configured"))
                    .build();
        }
        try {
            int loaded = filterRegistry.reload(id);
            int total = filterRegistry.inspect(id).map(Set::size).orElse(0);
            LOG.infof("Filter reload — rule=%s loaded=%d", id, loaded);
            return Response.ok(Map.of("loaded", loaded, FIELD_TOTAL, total)).build();
        } catch (IllegalStateException e) {
            LOG.errorf(e, "Filter reload failed — rule=%s", id);
            return Response.serverError()
                    .entity(Map.of(FIELD_ERROR, e.getMessage()))
                    .build();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private Map<String, Object> summarize(ForkRule rule) {
        List<Map<String, Object>> targetSummaries = rule.targets().stream()
                .map(t -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("id", t.id());
                    m.put("url", t.url());
                    m.put("timeout", t.timeout());
                    return m;
                })
                .toList();

        int filterSize = filterRegistry.inspect(rule.id()).map(Set::size).orElse(0);

        Map<String, Object> summary = new HashMap<>();
        summary.put("id", rule.id());
        summary.put("paths", rule.paths());
        summary.put("bodyParser", rule.bodyParser().name());
        summary.put("keyField", rule.keyField());
        summary.put("filterFile", rule.filterFile().orElse(""));
        summary.put("filterSize", filterSize);
        summary.put("targets", targetSummaries);
        return summary;
    }

    private Response ruleNotFound(String id) {
        return Response.status(Response.Status.NOT_FOUND)
                .entity(Map.of(FIELD_ERROR, "Rule not found: " + id))
                .build();
    }
}
