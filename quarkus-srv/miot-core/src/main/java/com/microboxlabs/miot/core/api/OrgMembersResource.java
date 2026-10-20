package com.microboxlabs.miot.core.api;

import com.microboxlabs.miot.core.iam.CoreAccessCatalog;
import com.microboxlabs.miot.core.alfresco.AlfrescoPerson;
import com.microboxlabs.miot.core.alfresco.IAlfrescoDirectoryClient;
import com.microboxlabs.miot.core.alfresco.IAlfrescoGroupAdminClient;
import com.microboxlabs.miot.core.api.dto.AddMemberRequest;
import com.microboxlabs.miot.core.auth.WriteAuthorizer;
import com.microboxlabs.miot.core.iam.AccessEvaluator;
import com.microboxlabs.miot.core.iam.model.IamMembership;
import com.microboxlabs.miot.core.iam.model.IamUser;
import com.microboxlabs.miot.core.model.Organization;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.ClientErrorException;
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
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * List, add and remove the members of an organization's Alfresco group.
 *
 * <p>Read access is gated by {@code OrganizationRequestFilter}: any
 * member of the org can see the roster. Adding needs {@code members:invite} and removing
 * {@code members:remove} on the top-level organization (see {@link WriteAuthorizer}).
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
    private final AccessEvaluator evaluator;

    @Inject
    public OrgMembersResource(IAlfrescoDirectoryClient directoryClient,
                              IAlfrescoGroupAdminClient groupAdmin,
                              WriteAuthorizer writeAuthorizer,
                              AccessEvaluator evaluator) {
        this.directoryClient = directoryClient;
        this.groupAdmin = groupAdmin;
        this.writeAuthorizer = writeAuthorizer;
        this.evaluator = evaluator;
    }

    /** The org for a change, refused with 409 when its membership is native: those members are managed on the Team page. */
    private Uni<Organization> alfrescoSourced(Organization org) {
        if (org == null) {
            return Uni.createFrom().nullItem();
        }
        return evaluator.membershipNative(org).map(nativeMembership -> {
            if (Boolean.TRUE.equals(nativeMembership)) {
                throw new ClientErrorException(
                        "The organization's membership is native: manage members on the Team page",
                        Response.Status.CONFLICT);
            }
            return org;
        });
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
                            if (org == null) {
                                return Uni.createFrom().item(List.<AlfrescoPerson>of());
                            }
                            return evaluator.membershipNative(org).flatMap(nativeMembership -> {
                                if (Boolean.TRUE.equals(nativeMembership)) {
                                    return nativeMembers(org, maxItems, skipCount);
                                }
                                if (org.alfrescoGroupId == null) {
                                    return Uni.createFrom().item(List.<AlfrescoPerson>of());
                                }
                                return directoryClient.listGroupMembers(
                                        org.alfrescoGroupId, maxItems, skipCount);
                            });
                        }));
    }

    /** Active IAM members of the org's top-level organization, in the shape the Alfresco roster has. */
    private Uni<List<AlfrescoPerson>> nativeMembers(Organization org, int maxItems, int skipCount) {
        return evaluator.root(org)
                .flatMap(root -> IamMembership.findByOrganization(root.id))
                .flatMap(memberships -> {
                    List<UUID> ids = memberships.stream()
                            .filter(m -> "ACTIVE".equals(m.status))
                            .skip(Math.max(skipCount, 0))
                            .limit(Math.max(maxItems, 0))
                            .map(m -> m.userId)
                            .toList();
                    // Keep the page in membership order: the id lookup returns users in any order.
                    return IamUser.findByIds(ids).map(users -> users.stream()
                            .sorted(Comparator.comparingInt(u -> ids.indexOf(u.id)))
                            .map(u -> new AlfrescoPerson(u.email, u.email, null, null, u.name))
                            .toList());
                });
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
                        .flatMap(this::alfrescoSourced)
                        .flatMap(org -> {
                            if (org == null) {
                                return Uni.createFrom().failure(new NotFoundException(
                                        "Organization not found: " + organizationId));
                            }
                            if (org.alfrescoGroupId == null) {
                                return Uni.createFrom().failure(new BadRequestException(
                                        "Organization has no Alfresco group binding"));
                            }
                            return writeAuthorizer.require(org, CoreAccessCatalog.MEMBERS_INVITE)
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
                        .flatMap(this::alfrescoSourced)
                        .flatMap(org -> {
                            if (org == null) {
                                return Uni.createFrom().failure(new NotFoundException(
                                        "Organization not found: " + organizationId));
                            }
                            if (org.alfrescoGroupId == null) {
                                return Uni.createFrom().failure(new BadRequestException(
                                        "Organization has no Alfresco group binding"));
                            }
                            return writeAuthorizer.require(org, CoreAccessCatalog.MEMBERS_REMOVE)
                                    .flatMap(ignored -> groupAdmin
                                            .removeGroupMember(org.alfrescoGroupId, personId));
                        }))
                .map(v -> Response.noContent().build());
    }
}
