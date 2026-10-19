package com.microboxlabs.miot.integrations.api;

import static com.microboxlabs.miot.integrations.api.OrgActorRequests.found;
import static com.microboxlabs.miot.integrations.api.OrgActorRequests.noContentOr404;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.integrations.dto.StoryDtos.CreateStoryRequest;
import com.microboxlabs.miot.integrations.dto.StoryDtos.PatchStoryRequest;
import com.microboxlabs.miot.integrations.dto.StoryDtos.SetCurrentVersionRequest;
import com.microboxlabs.miot.integrations.dto.StoryDtos.StoryShareRequest;
import com.microboxlabs.miot.integrations.dto.StoryDtos.VersionInput;
import com.microboxlabs.miot.integrations.service.StoryService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * Stories: versioned documents kept from chat sessions. User-authed like chat
 * threads; the actor comes from the session, never from the body.
 */
@Path("/api/v1/orgs/{organizationId}/stories")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Stories", description = "Versioned documents kept from chat sessions")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class OrgStoriesResource {

    private static final String NOT_FOUND = "story not found";
    private static final String ORGANIZATION_ID = "organizationId";
    private static final String STORY_ID = "storyId";

    private final StoryService service;
    private final OrgActorRequests requests;

    @Inject
    public OrgStoriesResource(
            StoryService service,
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            SecurityIdentity identity) {
        this.service = service;
        this.requests = new OrgActorRequests(tenantContext, organizationContext, identity);
    }

    @GET
    @Operation(summary = "List the caller's stories and the ones shared with them")
    public Uni<Response> listStories(
            @PathParam(ORGANIZATION_ID) String organizationId,
            @QueryParam("kind") String kind,
            @QueryParam("search") String search,
            @QueryParam("limit") Integer limit) {
        return requests.run(organizationId, (tenant, userId) ->
                Response.ok(service.list(tenant, userId, kind, search, limit)).build());
    }

    @POST
    @Operation(summary = "Create a story with its first version")
    public Uni<Response> createStory(
            @PathParam(ORGANIZATION_ID) String organizationId,
            CreateStoryRequest request) {
        return requests.run(organizationId, (tenant, userId) ->
                found(service.create(tenant, userId, request), Response.Status.CREATED, NOT_FOUND));
    }

    @GET
    @Path("/{storyId}")
    @Operation(summary = "Read a story with its current version")
    public Uni<Response> getStory(
            @PathParam(ORGANIZATION_ID) String organizationId,
            @PathParam(STORY_ID) String storyId) {
        return requests.run(organizationId, (tenant, userId) ->
                found(service.get(tenant, userId, storyId), Response.Status.OK, NOT_FOUND));
    }

    @PATCH
    @Path("/{storyId}")
    @Operation(summary = "Change a story's title or description")
    public Uni<Response> patchStory(
            @PathParam(ORGANIZATION_ID) String organizationId,
            @PathParam(STORY_ID) String storyId,
            PatchStoryRequest request) {
        return requests.run(organizationId, (tenant, userId) ->
                found(service.patch(tenant, userId, storyId, request), Response.Status.OK, NOT_FOUND));
    }

    @DELETE
    @Path("/{storyId}")
    @Operation(summary = "Delete a story the caller owns")
    public Uni<Response> deleteStory(
            @PathParam(ORGANIZATION_ID) String organizationId,
            @PathParam(STORY_ID) String storyId) {
        return requests.run(organizationId, (tenant, userId) ->
                noContentOr404(service.delete(tenant, userId, storyId), NOT_FOUND));
    }

    @GET
    @Path("/{storyId}/versions")
    @Operation(summary = "List a story's versions, without their content")
    public Uni<Response> listVersions(
            @PathParam(ORGANIZATION_ID) String organizationId,
            @PathParam(STORY_ID) String storyId) {
        return requests.run(organizationId, (tenant, userId) ->
                found(service.listVersions(tenant, userId, storyId).orElse(null), Response.Status.OK, NOT_FOUND));
    }

    @POST
    @Path("/{storyId}/versions")
    @Operation(summary = "Add a version and make it current")
    public Uni<Response> addVersion(
            @PathParam(ORGANIZATION_ID) String organizationId,
            @PathParam(STORY_ID) String storyId,
            VersionInput request) {
        return requests.run(organizationId, (tenant, userId) ->
                found(service.addVersion(tenant, userId, storyId, request), Response.Status.CREATED, NOT_FOUND));
    }

    @GET
    @Path("/{storyId}/versions/{versionId}")
    @Operation(summary = "Read one version with its content")
    public Uni<Response> getVersion(
            @PathParam(ORGANIZATION_ID) String organizationId,
            @PathParam(STORY_ID) String storyId,
            @PathParam("versionId") String versionId) {
        return requests.run(organizationId, (tenant, userId) ->
                found(service.getVersion(tenant, userId, storyId, versionId), Response.Status.OK, NOT_FOUND));
    }

    @PUT
    @Path("/{storyId}/current-version")
    @Operation(summary = "Make an existing version the current one")
    public Uni<Response> setCurrentVersion(
            @PathParam(ORGANIZATION_ID) String organizationId,
            @PathParam(STORY_ID) String storyId,
            SetCurrentVersionRequest request) {
        return requests.run(organizationId, (tenant, userId) -> found(
                service.setCurrentVersion(tenant, userId, storyId, request == null ? null : request.versionId()),
                Response.Status.OK, NOT_FOUND));
    }

    @POST
    @Path("/{storyId}/shares")
    @Operation(summary = "Give one other person read or write access to a story")
    public Uni<Response> shareStory(
            @PathParam(ORGANIZATION_ID) String organizationId,
            @PathParam(STORY_ID) String storyId,
            StoryShareRequest request) {
        return requests.run(organizationId, (tenant, userId) ->
                found(service.share(tenant, userId, storyId, request), Response.Status.CREATED, NOT_FOUND));
    }

    @DELETE
    @Path("/{storyId}/shares/{principal}")
    @Operation(summary = "Revoke one person's access to a story")
    public Uni<Response> revokeShare(
            @PathParam(ORGANIZATION_ID) String organizationId,
            @PathParam(STORY_ID) String storyId,
            @PathParam("principal") String principal) {
        return requests.run(organizationId, (tenant, userId) ->
                noContentOr404(service.revokeShare(tenant, userId, storyId, principal), NOT_FOUND));
    }
}
