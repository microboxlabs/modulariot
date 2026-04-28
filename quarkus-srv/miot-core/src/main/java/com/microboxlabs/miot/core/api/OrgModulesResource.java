package com.microboxlabs.miot.core.api;

import com.microboxlabs.miot.core.api.dto.SetModulesRequest;
import com.microboxlabs.miot.core.auth.WriteAuthorizer;
import com.microboxlabs.miot.core.model.Organization;
import com.microboxlabs.miot.core.model.OrganizationModule;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * Read and mutate the enabled product module codes for an organization.
 *
 * <p>Read ({@code GET}) is gated by {@code OrganizationRequestFilter}:
 * any member of the org may see the enabled modules.
 *
 * <p>Write ({@code PUT}) replaces the full set of enabled module codes
 * for the org and requires {@code SITE_MANAGER} on the parent.
 * Disabled modules are deleted outright rather than flagged — the
 * {@code enabled} column exists for forward-compat but we treat the
 * row's presence as authoritative for now.
 */
@Path("/api/v1/orgs/{organizationId}/modules")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Organization Modules",
        description = "Per-organization product module entitlements")
@SecurityRequirement(name = "oidc")
public class OrgModulesResource {

    private final WriteAuthorizer writeAuthorizer;

    @Inject
    public OrgModulesResource(WriteAuthorizer writeAuthorizer) {
        this.writeAuthorizer = writeAuthorizer;
    }

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

    @PUT
    @Operation(summary = "Replace the enabled module set for an organization")
    public Uni<List<String>> setModules(@PathParam("organizationId") String organizationId,
                                        SetModulesRequest body) {
        if (body == null || body.modules() == null) {
            throw new BadRequestException("modules list is required (can be empty)");
        }
        Set<String> requested = body.modules().stream()
                .filter(s -> s != null && !s.isBlank())
                .map(s -> s.trim().toUpperCase(Locale.ROOT))
                .collect(Collectors.toSet());

        return Panache.withTransaction(() ->
                Organization.findBySlug(organizationId)
                        .flatMap(org -> {
                            if (org == null) {
                                return Uni.createFrom().failure(new NotFoundException(
                                        "Organization not found: " + organizationId));
                            }
                            return writeAuthorizer.requireParentSiteManager(org)
                                    .flatMap(ignored -> replaceModules(org.id, requested));
                        }));
    }

    @SuppressWarnings("java:S3252") // PanacheEntityBase.delete(Class, ...) is not available in Reactive Panache here.
    private Uni<List<String>> replaceModules(Long organizationId, Set<String> requested) {
        // Sequential chain — no parallel Panache queries on the same session.
        return OrganizationModule.delete("id.organizationId = ?1", organizationId)
                .flatMap(deleted -> persistRequested(organizationId, requested))
                .map(x -> requested.stream().sorted().toList());
    }

    private Uni<Void> persistRequested(Long organizationId, Set<String> requested) {
        if (requested.isEmpty()) {
            return Uni.createFrom().voidItem();
        }
        // Chain inserts sequentially. The set is small (handful of module codes)
        // so this costs nothing, and it sidesteps Hibernate Reactive's
        // no-concurrent-queries constraint.
        Uni<Void> chain = Uni.createFrom().voidItem();
        for (String code : requested) {
            chain = chain.flatMap(ignored -> {
                OrganizationModule row = new OrganizationModule(organizationId, code, true);
                return row.persist().replaceWithVoid();
            });
        }
        return chain;
    }
}
