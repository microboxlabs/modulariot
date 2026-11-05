package com.microboxlabs.miot.fleet.api;

import com.microboxlabs.miot.core.auth.PlatformAuthorizer;
import com.microboxlabs.miot.fleet.directory.FleetUnavailableException;
import com.microboxlabs.miot.fleet.sharing.SharingProducer;
import com.microboxlabs.miot.fleet.sharing.SharingService;
import com.microboxlabs.miot.fleet.sharing.SharingService.CreateShare;
import com.microboxlabs.miot.fleet.sharing.SharingService.ShareRejected;
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
import java.util.UUID;
import java.util.function.Function;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * Data shares between organizations. Under {@code /api/v1/platform/}: a share spans two organizations, and only a
 * platform owner creates or revokes one.
 */
@Path("/api/v1/platform/data-sharing")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Platform Data Sharing", description = "Which organization sees another's GPS assets")
@SecurityRequirement(name = "oidc")
@IfBuildProperty(name = "miot.component.fleet.enabled", stringValue = "true")
public class PlatformDataSharingResource {

    private final PlatformAuthorizer authorizer;
    private final SharingService sharing;
    private final SharingProducer producer;

    @Inject
    public PlatformDataSharingResource(PlatformAuthorizer authorizer, SharingService sharing,
            SharingProducer producer) {
        this.authorizer = authorizer;
        this.sharing = sharing;
        this.producer = producer;
    }

    @GET
    @Path("/orgs")
    @Operation(summary = "Organizations, with the assets they can share and what they do")
    public Uni<Response> organizations() {
        return owner(actor -> sharing.organizations());
    }

    @GET
    @Path("/orgs/{slug}/assets")
    @Operation(summary = "The assets an organization can share")
    public Uni<Response> assets(@PathParam("slug") String slug) {
        return owner(actor -> sharing.assets(slug));
    }

    @GET
    @Path("/shares")
    @Operation(summary = "Every share, with its status and how many assets it covers today")
    public Uni<Response> shares() {
        return owner(actor -> sharing.shares());
    }

    @GET
    @Path("/summary")
    @Operation(summary = "Active shares, connected organizations, shared assets, shares ending within 30 days")
    public Uni<Response> summary() {
        return owner(actor -> sharing.figures());
    }

    @POST
    @Path("/shares")
    @Operation(summary = "Create a share")
    public Uni<Response> create(CreateShare request) {
        return owner(actor -> {
            Object created = sharing.create(request, actor);
            producer.syncSoon();
            return created;
        });
    }

    @POST
    @Path("/shares/{id}/revoke")
    @Operation(summary = "Revoke a share; the receiver stops seeing the assets at the next sync")
    public Uni<Response> revoke(@PathParam("id") UUID id) {
        return owner(actor -> {
            Object revoked = sharing.revoke(id, actor);
            producer.syncSoon();
            return revoked;
        });
    }

    private Uni<Response> owner(Function<String, Object> work) {
        return authorizer.requirePlatformOwner().flatMap(actor -> Uni.createFrom().item(() -> answer(work, actor))
                .runSubscriptionOn(Infrastructure.getDefaultWorkerPool()));
    }

    private static Response answer(Function<String, Object> work, String actor) {
        try {
            return Response.ok(work.apply(actor)).build();
        } catch (ShareRejected e) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", e.getMessage(), "code", e.code())).build();
        } catch (NoSuchElementException e) {
            return error(Response.Status.NOT_FOUND, e.getMessage());
        } catch (FleetUnavailableException e) {
            return error(Response.Status.SERVICE_UNAVAILABLE, e.getMessage());
        }
    }

    private static Response error(Response.Status status, String message) {
        return Response.status(status).entity(Map.of("error", message)).build();
    }
}
