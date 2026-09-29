package com.microboxlabs.miot.integrations.api;

import com.microboxlabs.miot.core.model.Organization;
import com.microboxlabs.miot.integrations.service.DashboardOperationService;
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

    @Inject
    public DashboardOperationsResource(DashboardOperationService service,
            @ConfigProperty(name = "miot.dashboards.proxy-key") Optional<String> proxyKey) {
        this.service = service;
        this.proxyKey = proxyKey;
    }

    @POST
    public Uni<Response> execute(@HeaderParam("x-miot-proxy-key") String presentedKey,
            DashboardOperationService.Request request) {
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
                        : Uni.createFrom().item(() -> noStore(Response.ok(service.execute(tenant.get(), request))))
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
