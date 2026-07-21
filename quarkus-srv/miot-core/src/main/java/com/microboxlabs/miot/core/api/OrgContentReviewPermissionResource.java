package com.microboxlabs.miot.core.api;

import com.microboxlabs.miot.core.api.dto.ContentReviewPermissionDto;
import com.microboxlabs.miot.core.api.dto.SetContentReviewPermissionRequest;
import com.microboxlabs.miot.core.permission.ContentReviewPermissionService;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** Organization settings endpoint for multimedia review auto-approval. */
@Path("/api/v1/orgs/{organizationId}/permissions/content-review-auto-approval")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Organization Permissions")
@SecurityRequirement(name = "oidc")
public class OrgContentReviewPermissionResource {

    private final ContentReviewPermissionService service;

    @Inject
    public OrgContentReviewPermissionResource(ContentReviewPermissionService service) {
        this.service = service;
    }

    @GET
    @Operation(summary = "Get multimedia review auto-approval settings")
    public Uni<ContentReviewPermissionDto> get(
            @PathParam("organizationId") String organizationId) {
        return service.get(organizationId);
    }

    @PUT
    @Operation(summary = "Replace multimedia review auto-approval settings")
    public Uni<ContentReviewPermissionDto> replace(
            @PathParam("organizationId") String organizationId,
            SetContentReviewPermissionRequest request) {
        return service.replace(organizationId, request);
    }
}
