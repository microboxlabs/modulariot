package com.microboxlabs.miot.integrations.api;

import com.microboxlabs.miot.core.model.Organization;
import com.microboxlabs.miot.integrations.service.DashboardAuthoringService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * Query authoring for the dashboard server: the tenant's BigQuery connections, a token for
 * one, and its saved queries. Authenticated with {@code miot.dashboards.proxy-key}; the
 * dashboard server decides which users may author. {@code tenantId} is the org slug.
 */
@Path(DashboardAuthoringResource.PATH)
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class DashboardAuthoringResource {
    static final String PATH = "/internal/dashboard-authoring";
    private static final String NOT_FOUND = "Query source not found";

    private final DashboardAuthoringService service;
    private final Optional<String> proxyKey;

    public record SourceRequest(String tenantId, String userId, String sourceId) {
    }

    public record PlanRequest(String tenantId, String userId, String sourceId, String planId,
            DashboardAuthoringService.Content content, String expectedRevision) {
    }

    @Inject
    public DashboardAuthoringResource(DashboardAuthoringService service,
            @ConfigProperty(name = "miot.dashboards.proxy-key") Optional<String> proxyKey) {
        this.service = service;
        this.proxyKey = proxyKey;
    }

    @POST
    @Path("/sources")
    public Uni<Response> sources(@HeaderParam("x-miot-proxy-key") String key, SourceRequest request) {
        return handle(key, request == null ? null : request.tenantId(),
                tenant -> Response.ok(service.sources(tenant)));
    }

    @POST
    @Path("/access")
    public Uni<Response> access(@HeaderParam("x-miot-proxy-key") String key, SourceRequest request) {
        return handle(key, request == null ? null : request.tenantId(), tenant -> {
            var access = service.access(tenant, request.sourceId());
            return access == null ? status(404, NOT_FOUND) : Response.ok(access);
        });
    }

    @POST
    @Path("/plans/list")
    public Uni<Response> list(@HeaderParam("x-miot-proxy-key") String key, PlanRequest request) {
        return handle(key, request == null ? null : request.tenantId(), tenant -> {
            var plans = service.list(tenant, request.sourceId());
            return plans == null ? status(404, NOT_FOUND) : Response.ok(plans);
        });
    }

    @POST
    @Path("/plans/get")
    public Uni<Response> get(@HeaderParam("x-miot-proxy-key") String key, PlanRequest request) {
        return handle(key, request == null ? null : request.tenantId(), tenant -> {
            var plan = service.get(tenant, request.sourceId(), request.planId());
            return plan == null ? status(404, "Query not found") : Response.ok(plan);
        });
    }

    @POST
    @Path("/plans/create")
    public Uni<Response> create(@HeaderParam("x-miot-proxy-key") String key, PlanRequest request) {
        return handle(key, request == null ? null : request.tenantId(), tenant -> {
            var plan = service.create(tenant, request.sourceId(), request.content(), request.userId());
            return plan == null ? status(404, NOT_FOUND) : Response.status(201).entity(plan);
        });
    }

    @POST
    @Path("/plans/update")
    public Uni<Response> update(@HeaderParam("x-miot-proxy-key") String key, PlanRequest request) {
        return handle(key, request == null ? null : request.tenantId(), tenant -> {
            var plan = service.update(tenant, request.sourceId(), request.planId(), request.content(),
                    request.expectedRevision(), request.userId());
            return plan == null ? status(404, "Query not found") : Response.ok(plan);
        });
    }

    @POST
    @Path("/plans/remove")
    public Uni<Response> remove(@HeaderParam("x-miot-proxy-key") String key, PlanRequest request) {
        return handle(key, request == null ? null : request.tenantId(), tenant -> {
            service.remove(tenant, request.sourceId(), request.planId());
            return Response.noContent();
        });
    }

    private Uni<Response> handle(String presentedKey, String tenantId,
            Function<String, Response.ResponseBuilder> action) {
        String configured = proxyKey.orElse("");
        if (configured.isBlank() || configured.length() < 32) {
            return Uni.createFrom().item(error(503, "Dashboard authoring is not configured"));
        }
        if (!DashboardCredentialsResource.keyAccepted(configured, presentedKey)) {
            return Uni.createFrom().item(error(401, "Unauthorized"));
        }
        if (tenantId == null || tenantId.isBlank() || tenantId.length() > 256) {
            return Uni.createFrom().item(error(400, "Invalid dashboard authoring request"));
        }
        return tenantCodeFor(tenantId)
                .flatMap(tenant -> tenant.isEmpty() ? Uni.createFrom().item(error(404, "Organization not found"))
                        : Uni.createFrom().item(() -> noStore(action.apply(tenant.get())))
                                .runSubscriptionOn(Infrastructure.getDefaultWorkerPool()))
                .onFailure(IllegalArgumentException.class).recoverWithItem(e -> error(400, e.getMessage()))
                .onFailure(DashboardAuthoringService.ConflictException.class)
                .recoverWithItem(e -> error(409, e.getMessage()))
                .onFailure().recoverWithItem(() -> error(502, "Dashboard authoring could not be completed"));
    }

    protected Uni<Optional<String>> tenantCodeFor(String slug) {
        return Panache.withSession(() -> Organization.findBySlug(slug)
                .map(org -> org == null ? Optional.<String>empty() : Optional.ofNullable(org.tenantClientId)));
    }

    private static Response.ResponseBuilder status(int status, String message) {
        return Response.status(status).entity(Map.of("error", message));
    }

    private static Response error(int status, String message) {
        return noStore(status(status, message));
    }

    private static Response noStore(Response.ResponseBuilder response) {
        return response.type(MediaType.APPLICATION_JSON).header("Cache-Control", "no-store").build();
    }
}
