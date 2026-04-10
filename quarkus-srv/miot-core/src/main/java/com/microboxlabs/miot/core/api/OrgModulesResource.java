package com.microboxlabs.miot.core.api;

import com.microboxlabs.miot.core.model.Organization;
import com.microboxlabs.miot.core.model.OrganizationModule;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.util.List;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * Returns the enabled product module codes for an organization.
 * Gated by {@code OrganizationRequestFilter} via the {@code /api/v1/orgs/}
 * path prefix — the caller must be a member of the org.
 */
@Path("/api/v1/orgs/{organizationId}/modules")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "Organization Modules",
        description = "Per-organization product module entitlements")
@SecurityRequirement(name = "oidc")
public class OrgModulesResource {

    @GET
    @Operation(summary = "List enabled module codes for an organization")
    public Uni<List<String>> list(@PathParam("organizationId") String organizationId) {
        return Panache.withSession(() ->
                Organization.findBySlug(organizationId)
                        .flatMap(org -> {
                            if (org == null) {
                                return Uni.createFrom().item(List.<String>of());
                            }
                            return OrganizationModule.findEnabledByOrganization(org.id)
                                    .map(list -> list.stream()
                                            .map(m -> m.id.moduleCode)
                                            .toList());
                        }));
    }
}
