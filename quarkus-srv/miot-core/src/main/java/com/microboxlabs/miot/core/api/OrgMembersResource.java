package com.microboxlabs.miot.core.api;

import com.microboxlabs.miot.core.alfresco.AlfrescoPerson;
import com.microboxlabs.miot.core.iam.AccessEvaluator;
import com.microboxlabs.miot.core.iam.model.IamMembership;
import com.microboxlabs.miot.core.iam.model.IamUser;
import com.microboxlabs.miot.core.model.Organization;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * The active members of an organization, for pickers. Read access is gated by {@code OrganizationRequestFilter}: any
 * member of the org can see the roster. Members are added and removed on the Team page.
 */
@Path("/api/v1/orgs/{organizationId}/members")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Organization Members", description = "List the members of an organization")
@SecurityRequirement(name = "oidc")
public class OrgMembersResource {

    private final AccessEvaluator evaluator;

    @Inject
    public OrgMembersResource(AccessEvaluator evaluator) {
        this.evaluator = evaluator;
    }

    @GET
    @Operation(summary = "List members of an organization")
    public Uni<List<AlfrescoPerson>> list(
            @PathParam("organizationId") String organizationId,
            @QueryParam("maxItems") @DefaultValue("50") int maxItems,
            @QueryParam("skipCount") @DefaultValue("0") int skipCount) {
        return Panache.withSession(() -> Organization.findBySlug(organizationId)
                .flatMap(org -> org == null
                        ? Uni.createFrom().item(List.<AlfrescoPerson>of())
                        : members(org, maxItems, skipCount)));
    }

    /** Active members of the org's top-level organization, in the shape the Alfresco roster had. */
    private Uni<List<AlfrescoPerson>> members(Organization org, int maxItems, int skipCount) {
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
}
