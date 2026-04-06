package com.microboxlabs.miot.gateway.fork.api;

import com.microboxlabs.miot.gateway.fork.ForkEngine;
import com.microboxlabs.miot.gateway.fork.model.ForkResult;
import com.microboxlabs.miot.gateway.fork.model.ForkRule;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;
import org.jboss.logging.Logger;

/**
 * Catch-all POST receiver for APISIX proxy-mirror traffic.
 *
 * <p>Accepts any path except those under /internal/ (reserved for the management API).
 * Delegates path-to-rule matching and fan-out to {@link ForkEngine}.
 *
 * <p>Always responds 200 — APISIX discards mirror responses.
 *
 * <p><b>APISIX configuration:</b>
 * <pre>
 * plugins:
 *   - name: proxy-mirror
 *     enable: true
 *     config:
 *       host: "http://prod-streamhub-gateway:8080"
 *       sample_ratio: 1
 * </pre>
 * The host field is scheme+host+port only. APISIX appends the original upstream
 * path, so requests arrive here at their original paths (e.g. /v1/asset/track).
 */
@Path("/{path: (?!internal/).*}")
@IfBuildProperty(name = "miot.component.gateway.enabled", stringValue = "true")
public class ForkMirrorResource {

    private static final Logger LOG = Logger.getLogger(ForkMirrorResource.class);
    private static final String PATH_SEPARATOR = "/";

    private final ForkEngine engine;

    ForkMirrorResource(ForkEngine engine) {
        this.engine = engine;
    }

    @POST
    @Consumes(MediaType.WILDCARD)
    @Produces(MediaType.APPLICATION_JSON)
    public Response mirror(
            @PathParam("path") String path,
            String body,
            @Context HttpHeaders headers) {

        String fullPath = PATH_SEPARATOR + path;
        List<ForkRule> matchingRules = engine.findRulesForPath(fullPath);

        if (matchingRules.isEmpty()) {
            LOG.debugf("No fork rule for path '%s' — discarding", fullPath);
            return Response.ok().build();
        }

        Response.ResponseBuilder rb = Response.ok();
        for (ForkRule rule : matchingRules) {
            ForkResult result = engine.process(rule, body, headers.getRequestHeaders());
            rb.header("X-Fork-Rule", result.ruleId());
            rb.header("X-Fork-Outcome", result.outcome().name());
            if (result.key() != null && !result.key().isBlank()) {
                rb.header("X-Fork-Key", result.key());
            }
            if (!result.dispatchedTargets().isEmpty()) {
                rb.header("X-Fork-Targets", String.join(", ", result.dispatchedTargets()));
            }
        }
        return rb.build();
    }
}
