package com.microboxlabs.miot.core.api;

import com.microboxlabs.miot.core.alfresco.AlfrescoPerson;
import com.microboxlabs.miot.core.alfresco.IAlfrescoDirectoryClient;
import com.microboxlabs.miot.core.alfresco.IAlfrescoGroupAdminClient;
import com.microboxlabs.miot.core.api.dto.AddMemberRequest;
import com.microboxlabs.miot.core.auth.WriteAuthorizer;
import com.microboxlabs.miot.core.model.Organization;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * List, add and remove the members of an organization's Alfresco group.
 *
 * <p>Read access is gated by {@code OrganizationRequestFilter}: any
 * member of the org can see the roster. Write access requires
 * {@code SITE_MANAGER} on the parent (see {@link WriteAuthorizer}).
 */
@Path("/api/v1/orgs/{organizationId}/members")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Organization Members",
        description = "List and mutate members of an organization's Alfresco group or site")
@SecurityRequirement(name = "oidc")
public class OrgMembersResource {

    private final IAlfrescoDirectoryClient directoryClient;
    private final IAlfrescoGroupAdminClient groupAdmin;
    private final WriteAuthorizer writeAuthorizer;

    @Inject
    public OrgMembersResource(IAlfrescoDirectoryClient directoryClient,
                              IAlfrescoGroupAdminClient groupAdmin,
                              WriteAuthorizer writeAuthorizer) {
        this.directoryClient = directoryClient;
        this.groupAdmin = groupAdmin;
        this.writeAuthorizer = writeAuthorizer;
    }

    @GET
    @Operation(summary = "List members of an organization")
    public Uni<List<AlfrescoPerson>> list(
            @PathParam("organizationId") String organizationId,
            @QueryParam("maxItems") @DefaultValue("50") int maxItems,
            @QueryParam("skipCount") @DefaultValue("0") int skipCount) {
        return Panache.withSession(() ->
                Organization.findBySlug(organizationId)
                        .flatMap(org -> {
                            if (org == null || org.alfrescoGroupId == null) {
                                return Uni.createFrom().item(List.<AlfrescoPerson>of());
                            }
                            return directoryClient.listGroupMembers(
                                    org.alfrescoGroupId, maxItems, skipCount);
                        }));
    }

    @POST
    @Operation(summary = "Add a person to an organization's Alfresco group")
    public Uni<Response> add(@PathParam("organizationId") String organizationId,
                             AddMemberRequest body) {
        if (body == null || body.personId() == null || body.personId().isBlank()) {
            throw new BadRequestException("personId is required");
        }
        String personId = body.personId().trim();
        return Panache.withSession(() ->
                Organization.findBySlug(organizationId)
                        .flatMap(org -> {
                            if (org == null) {
                                return Uni.createFrom().failure(new NotFoundException(
                                        "Organization not found: " + organizationId));
                            }
                            if (org.alfrescoGroupId == null) {
                                return Uni.createFrom().failure(new BadRequestException(
                                        "Organization has no Alfresco group binding"));
                            }
                            return writeAuthorizer.requireParentSiteManager(org)
                                    .flatMap(ignored -> groupAdmin
                                            .addGroupMember(org.alfrescoGroupId, personId));
                        }))
                .map(v -> Response.noContent().build());
    }

    @DELETE
    @Path("/{personId}")
    @Operation(summary = "Remove a person from an organization's Alfresco group")
    public Uni<Response> remove(@PathParam("organizationId") String organizationId,
                                @PathParam("personId") String personId) {
        return Panache.withSession(() ->
                Organization.findBySlug(organizationId)
                        .flatMap(org -> {
                            if (org == null) {
                                return Uni.createFrom().failure(new NotFoundException(
                                        "Organization not found: " + organizationId));
                            }
                            if (org.alfrescoGroupId == null) {
                                return Uni.createFrom().failure(new BadRequestException(
                                        "Organization has no Alfresco group binding"));
                            }
                            return writeAuthorizer.requireParentSiteManager(org)
                                    .flatMap(ignored -> groupAdmin
                                            .removeGroupMember(org.alfrescoGroupId, personId));
                        }))
                .map(v -> Response.noContent().build());
    }
}
