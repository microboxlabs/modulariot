package com.microboxlabs.miot.core.api;

import com.microboxlabs.miot.core.alfresco.AlfrescoPerson;
import com.microboxlabs.miot.core.alfresco.IAlfrescoDirectoryClient;
import com.microboxlabs.miot.core.model.Organization;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import java.util.List;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * Lists the members of an organization by delegating to Alfresco's group/site
 * membership directory. Access is already enforced by
 * {@code OrganizationRequestFilter} (the caller must be a member of the org
 * whose {@code organizationId} slug appears in the path), so this resource
 * only needs to resolve the org's {@code alfrescoGroupId} and fetch.
 */
@Path("/api/v1/orgs/{organizationId}/members")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "Organization Members",
        description = "List members of an organization's Alfresco group or site")
@SecurityRequirement(name = "oidc")
public class OrgMembersResource {

    private final IAlfrescoDirectoryClient directoryClient;

    @Inject
    public OrgMembersResource(IAlfrescoDirectoryClient directoryClient) {
        this.directoryClient = directoryClient;
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
}
