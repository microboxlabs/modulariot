package com.microboxlabs.miot.resource.sync;

import com.microboxlabs.miot.core.auth.TenantContext;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

@Path("/api/v1/sync/cursor")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Sync", description = "Source system sync cursor management")
@SecurityRequirement(name = "oidc")
public class SyncCursorResource {

    @Inject TenantContext tenantContext;
    @Inject SyncCursorService cursorService;

    @GET
    @Path("/{sourceSystem}/{entityType}")
    @Operation(summary = "Get current sync cursor")
    public Uni<Response> getCursor(
            @PathParam("sourceSystem") String sourceSystem,
            @PathParam("entityType") String entityType) {
        return cursorService.get(tenantContext.getClientId(), sourceSystem, entityType)
                .map(cursor -> cursor != null
                        ? Response.ok(cursor).build()
                        : Response.status(Response.Status.NOT_FOUND).build());
    }

    @PUT
    @Path("/{sourceSystem}/{entityType}")
    @Operation(summary = "Advance sync cursor")
    public Uni<Response> advanceCursor(
            @PathParam("sourceSystem") String sourceSystem,
            @PathParam("entityType") String entityType,
            AdvanceCursorRequest req) {
        return cursorService.advance(tenantContext.getClientId(), sourceSystem, entityType,
                        req.cursorType(), req.cursorValue(), req.entitiesSynced(), req.errors())
                .map(cursor -> Response.ok(cursor).build());
    }

    public record AdvanceCursorRequest(
        String cursorType,
        String cursorValue,
        Integer entitiesSynced,
        Integer errors
    ) {}
}
