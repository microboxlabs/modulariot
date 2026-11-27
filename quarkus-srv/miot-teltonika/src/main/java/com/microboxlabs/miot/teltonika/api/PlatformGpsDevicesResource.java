package com.microboxlabs.miot.teltonika.api;

import com.microboxlabs.miot.core.auth.PlatformAuthorizer;
import com.microboxlabs.miot.teltonika.service.ActivationService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.function.Function;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * Claims of devices of every organization, for platform owners. A device that arrives through
 * Traccar cannot prove possession with a code, so its claim waits here for an owner's approval;
 * on approval, the positions kept while it waited are published.
 */
@Path("/api/v1/platform/gps/devices")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Platform GPS devices", description = "Pending device claims across organizations")
@SecurityRequirement(name = "oidc")
@IfBuildProperty(name = "miot.component.teltonika.enabled", stringValue = "true")
public class PlatformGpsDevicesResource {

    private final PlatformAuthorizer authorizer;
    private final ActivationService activation;

    @Inject
    public PlatformGpsDevicesResource(PlatformAuthorizer authorizer, ActivationService activation) {
        this.authorizer = authorizer;
        this.activation = activation;
    }

    @GET
    @Path("/pending")
    @Operation(operationId = "listPendingDeviceClaims", summary = "Pending claims, oldest first")
    public Uni<Response> pending() {
        return owner(actor -> activation.pendingClaims());
    }

    @POST
    @Path("/{id}/approve")
    @Operation(operationId = "approveDeviceClaim", summary = "Approves the claim of a device that arrives through Traccar")
    public Uni<Response> approve(@PathParam("id") String id) {
        return owner(actor -> {
            activation.approve(id, actor);
            return Map.of("id", id, "state", "active");
        });
    }

    private Uni<Response> owner(Function<String, Object> work) {
        return authorizer.requirePlatformOwner().flatMap(actor -> Uni.createFrom().item(() -> answer(work, actor))
                .runSubscriptionOn(Infrastructure.getDefaultWorkerPool()));
    }

    static Response answer(Function<String, Object> work, String actor) {
        try {
            return Response.ok(work.apply(actor)).build();
        } catch (IllegalArgumentException e) {
            return error(Response.Status.BAD_REQUEST, e.getMessage());
        } catch (NoSuchElementException e) {
            return error(Response.Status.NOT_FOUND, e.getMessage());
        } catch (IllegalStateException e) {
            return error(Response.Status.CONFLICT, e.getMessage());
        }
    }

    private static Response error(Response.Status status, String message) {
        return Response.status(status).type(MediaType.APPLICATION_JSON).entity(Map.of("error", message)).build();
    }
}
