package com.microboxlabs.miot.integrations.api;

import com.microboxlabs.miot.core.model.Organization;
import com.microboxlabs.miot.integrations.service.DashboardOperationService;
import com.microboxlabs.miot.integrations.service.DashboardOperationCatalog;
import com.microboxlabs.miot.integrations.service.DashboardOperationResolver;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.function.BiFunction;
import com.microboxlabs.miot.integrations.service.OperationInvocationException;
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
import org.eclipse.microprofile.config.inject.ConfigProperty;

/** Service-authenticated bridge; the dashboard server owns user/scope authorization. */
@Path("/internal/dashboard-operations")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class DashboardOperationsResource {
    private final DashboardOperationService service;
    private final Optional<String> proxyKey;
    private final DashboardOperationResolver resolver;
    private final DashboardOperationCatalog catalog;
    private final boolean resolutionEnabled;

    public record CatalogRequest(String tenantId) {
    }

    @Inject
    public DashboardOperationsResource(DashboardOperationService service, DashboardOperationResolver resolver,
            DashboardOperationCatalog catalog,
            @ConfigProperty(name = "miot.dashboards.plan-resolution.enabled", defaultValue = "false") boolean resolutionEnabled,
            @ConfigProperty(name = "miot.dashboards.proxy-key") Optional<String> proxyKey) {
        this.service = service;
        this.resolver = resolver;
        this.catalog = catalog;
        this.resolutionEnabled = resolutionEnabled;
        this.proxyKey = proxyKey;
    }

    @POST
    public Uni<Response> execute(@HeaderParam("x-miot-proxy-key") String presentedKey,
            DashboardOperationService.Request request) {
        return dispatch(presentedKey, request, service::execute);
    }

    /** Returns sensitive execution material only to the trusted dashboard service. */
    @POST
    @Path("/resolve")
    public Uni<Response> resolve(@HeaderParam("x-miot-proxy-key") String presentedKey,
            DashboardOperationService.Request request) {
        if (!resolutionEnabled) return reply(503, "Dashboard plan resolution is not configured");
        return dispatch(presentedKey, request, resolver::resolve);
    }

    /** Names and ids of the organization's active, dashboard-eligible operations. */
    @POST
    @Path("/catalog")
    public Uni<Response> catalog(@HeaderParam("x-miot-proxy-key") String presentedKey, CatalogRequest request) {
        String configured = proxyKey.orElse("");
        if (configured.isBlank() || configured.length() < 32) return reply(503, "Dashboard operations are not configured");
        if (!DashboardCredentialsResource.keyAccepted(configured, presentedKey)) return reply(401, "Unauthorized");
        if (request == null || request.tenantId() == null || request.tenantId().isBlank() || request.tenantId().length() > 256) {
            return reply(400, "Invalid dashboard catalog request");
        }
        return tenantCodeFor(request.tenantId())
                .flatMap(tenant -> tenant.isEmpty() ? reply(404, "Organization not found")
                        : Uni.createFrom().item(() -> noStore(Response.ok(Map.of("connections", catalog.list(tenant.get())))))
                                .runSubscriptionOn(Infrastructure.getDefaultWorkerPool()))
                .onFailure().recoverWithItem(() -> error(502, "Dashboard catalog could not be listed"));
    }

    private Uni<Response> dispatch(String presentedKey, DashboardOperationService.Request request,
            BiFunction<String, DashboardOperationService.Request, ObjectNode> action) {
        String configured = proxyKey.orElse("");
        if (configured.isBlank() || configured.length() < 32) return reply(503, "Dashboard operations are not configured");
        if (!DashboardCredentialsResource.keyAccepted(configured, presentedKey)) return reply(401, "Unauthorized");
        try {
            DashboardOperationService.validate(request);
        } catch (OperationInvocationException e) {
            return reply(400, "Invalid dashboard operation request");
        }
        return tenantCodeFor(request.tenantId())
                .flatMap(tenant -> tenant.isEmpty() ? reply(404, "Organization not found")
                        : Uni.createFrom().item(() -> noStore(Response.ok(action.apply(tenant.get(), request))))
                                .runSubscriptionOn(Infrastructure.getDefaultWorkerPool()))
                .onFailure().recoverWithItem(() -> error(502, "Dashboard operation could not be completed"));
    }

    Uni<Optional<String>> tenantCodeFor(String slug) {
        return Panache.withSession(() -> Organization.findBySlug(slug)
                .map(org -> org == null ? Optional.<String>empty() : Optional.ofNullable(org.tenantClientId)));
    }

    private static Uni<Response> reply(int status, String message) {
        return Uni.createFrom().item(error(status, message));
    }

    private static Response error(int status, String message) {
        return noStore(Response.status(status).entity(Map.of("error", message)));
    }

    private static Response noStore(Response.ResponseBuilder response) {
        return response.type(MediaType.APPLICATION_JSON).header("Cache-Control", "no-store").build();
    }
}
