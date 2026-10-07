package com.microboxlabs.miot.integrations.api;

import com.microboxlabs.miot.core.auth.PlatformAuthorizer;
import com.microboxlabs.miot.integrations.email.PlatformMailService;
import com.microboxlabs.miot.integrations.email.PlatformMailService.PlatformMailView;
import com.microboxlabs.miot.integrations.email.PlatformMailService.SetPlatformMailRequest;
import io.quarkus.arc.properties.IfBuildProperty;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import java.util.function.Supplier;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * The platform's email sender, used for invitations from organizations without their own. Only a
 * platform owner reads or changes it. The API key is write-only: responses carry a preview.
 */
@Path("/api/v1/platform/mail")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Platform Mail", description = "The platform's email sender")
@SecurityRequirement(name = "oidc")
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class PlatformMailResource {

    private final PlatformMailService service;
    private final PlatformAuthorizer authorizer;

    @Inject
    public PlatformMailResource(PlatformMailService service, PlatformAuthorizer authorizer) {
        this.service = service;
        this.authorizer = authorizer;
    }

    @GET
    @Operation(summary = "Get the platform email sender")
    public Uni<PlatformMailView> get() {
        return authorizer.requirePlatformOwner().flatMap(ignored -> onWorker(service::get));
    }

    @PUT
    @Operation(summary = "Set the platform email sender",
            description = "The API key is required the first time; leave it blank to keep the stored key.")
    public Uni<Response> put(SetPlatformMailRequest body) {
        return authorizer.requirePlatformOwner().flatMap(actor -> onWorker(() -> {
            try {
                return Response.ok(service.put(body, actor)).build();
            } catch (IllegalArgumentException e) {
                return error(Response.Status.BAD_REQUEST, e.getMessage());
            } catch (IllegalStateException e) {
                return error(Response.Status.CONFLICT, e.getMessage());
            }
        }));
    }

    @DELETE
    @Operation(summary = "Remove the platform email sender and its key")
    public Uni<Response> delete() {
        return authorizer.requirePlatformOwner().flatMap(actor -> onWorker(() -> {
            try {
                return service.delete(actor)
                        ? Response.noContent().build()
                        : error(Response.Status.NOT_FOUND, "No platform email sender");
            } catch (IllegalStateException e) {
                return error(Response.Status.CONFLICT, e.getMessage());
            }
        }));
    }

    @POST
    @Path("/test")
    @Consumes(MediaType.WILDCARD)
    @Operation(summary = "Check the platform sender's API key with Resend")
    public Uni<Response> test() {
        return authorizer.requirePlatformOwner().flatMap(ignored -> onWorker(() -> {
            var result = service.test();
            return result == null
                    ? error(Response.Status.NOT_FOUND, "No platform email sender")
                    : Response.ok(result).build();
        }));
    }

    private static Response error(Response.Status status, String message) {
        return Response.status(status).type(MediaType.APPLICATION_JSON).entity(Map.of("error", message)).build();
    }

    private static <T> Uni<T> onWorker(Supplier<T> work) {
        return Uni.createFrom().item(work).runSubscriptionOn(Infrastructure.getDefaultWorkerPool());
    }
}
