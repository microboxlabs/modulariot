package com.microboxlabs.miot.integrations.api;

import com.microboxlabs.miot.core.auth.PlatformAuthorizer;
import com.microboxlabs.miot.core.model.Organization;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.geocoding.ManagedGeocodingConnections;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import jakarta.inject.Inject;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import java.util.Optional;
import java.util.function.BiFunction;
import java.util.function.Supplier;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * Connects an organization to the platform's geocoding provider. The organization gets its own {@code GEOCODING}
 * connection with a managed credential; the token and our cost stay in the platform's connection.
 */
@Path("/api/v1/platform/orgs/{slug}/geocoding-connection")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "Platform Organization Geocoding", description = "An organization's connection to the platform's"
        + " geocoding provider")
@SecurityRequirement(name = "oidc")
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class PlatformOrgGeocodingConnectionResource {

    /** {@code connected} is false and the rest null when the organization has no connection. */
    public record ConnectionView(boolean connected, String connectionId, String name, String status) {
        static ConnectionView of(Optional<IntegrationConnection> c) {
            return c.map(v -> new ConnectionView(true, v.id(), v.name(), v.status().name()))
                    .orElseGet(() -> new ConnectionView(false, null, null, null));
        }
    }

    private final ManagedGeocodingConnections connections;
    private final PlatformAuthorizer authorizer;

    @Inject
    public PlatformOrgGeocodingConnectionResource(ManagedGeocodingConnections connections,
            PlatformAuthorizer authorizer) {
        this.connections = connections;
        this.authorizer = authorizer;
    }

    @GET
    @Operation(summary = "The organization's geocoding connection, if it has one")
    public Uni<Response> get(@PathParam("slug") String slug) {
        return run(slug, (tenant, actor) -> Response.ok(ConnectionView.of(connections.find(tenant))).build());
    }

    @POST
    @Operation(summary = "Connect the organization to the platform's geocoding provider",
            description = "Creates a managed credential and the connection once. Idempotent.")
    public Uni<Response> connect(@PathParam("slug") String slug) {
        return run(slug, (tenant, actor) -> Response.ok(ConnectionView.of(
                Optional.of(connections.connect(tenant, actor)))).build());
    }

    @DELETE
    @Operation(summary = "Remove the organization's geocoding connection",
            description = "The organization's sites go to review instead of the provider.")
    public Uni<Response> remove(@PathParam("slug") String slug) {
        return run(slug, (tenant, actor) -> connections.remove(tenant, actor)
                ? Response.noContent().build()
                : error(Response.Status.NOT_FOUND, "The organization has no geocoding connection"));
    }

    private Uni<Response> run(String slug, BiFunction<String, String, Response> action) {
        return owner().flatMap(actor -> tenantCode(slug).flatMap(tenant -> tenant.isEmpty()
                ? Uni.createFrom().item(error(Response.Status.NOT_FOUND, "Organization not found"))
                : onWorker(() -> respond(tenant.get(), actor, action))));
    }

    static Response respond(String tenant, String actor, BiFunction<String, String, Response> action) {
        try {
            return action.apply(tenant, actor);
        } catch (ManagedGeocodingConnections.NoPlatformProviderException e) {
            return error(Response.Status.CONFLICT, e.getMessage());
        } catch (IllegalArgumentException e) {
            return error(Response.Status.BAD_REQUEST, e.getMessage());
        } catch (IllegalStateException e) {
            return error(Response.Status.CONFLICT, e.getMessage());
        }
    }

    protected Uni<String> owner() {
        return authorizer.requirePlatformOwner();
    }

    protected Uni<Optional<String>> tenantCode(String slug) {
        return Panache.withSession(() -> Organization.findBySlug(slug)).map(org ->
                org == null || org.tenantClientId == null || org.tenantClientId.isBlank()
                        ? Optional.<String>empty() : Optional.of(org.tenantClientId));
    }

    private static Uni<Response> onWorker(Supplier<Response> work) {
        return Uni.createFrom().item(work).runSubscriptionOn(Infrastructure.getDefaultWorkerPool());
    }

    private static Response error(Response.Status status, String message) {
        return Response.status(status).type(MediaType.APPLICATION_JSON).entity(Map.of("error", message)).build();
    }
}
