package com.microboxlabs.miot.core.api;

import com.microboxlabs.miot.core.api.dto.CreateRootOrganizationRequest;
import com.microboxlabs.miot.core.api.dto.OrganizationDto;
import com.microboxlabs.miot.core.api.dto.OrganizationRoleDto;
import com.microboxlabs.miot.core.api.dto.SetOrganizationRoleRequest;
import com.microboxlabs.miot.core.auth.PlatformAuthorizer;
import com.microboxlabs.miot.core.model.Organization;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.core.tax.ActiveTaxIdValidator;
import com.microboxlabs.miot.core.tax.TaxIdValidator;
import com.microboxlabs.miot.core.tax.TaxIdValidator.InvalidTaxIdException;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * Platform owners create top-level organizations and assign their roles. With native membership this is
 * how an organization gets its first owner: nobody belongs to it until a role is assigned.
 */
@Path("/api/v1/platform/orgs")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Platform Organizations")
@SecurityRequirement(name = "oidc")
public class PlatformOrganizationsResource {

    static final String SLUG = "[a-z0-9][a-z0-9-]{1,98}[a-z0-9]";

    private final PlatformAuthorizer authorizer;
    private final OrganizationRoleService roles;
    private final TaxIdValidator taxIdValidator;

    @Inject
    public PlatformOrganizationsResource(PlatformAuthorizer authorizer, OrganizationRoleService roles,
            @ActiveTaxIdValidator TaxIdValidator taxIdValidator) {
        this.authorizer = authorizer;
        this.roles = roles;
        this.taxIdValidator = taxIdValidator;
    }

    @POST
    @Operation(summary = "Create a top-level organization")
    @SuppressWarnings("java:S1612") // PanacheEntityBase::persist is ambiguous with Reactive Panache overloads.
    public Uni<Response> create(CreateRootOrganizationRequest body) {
        return authorizer.requirePlatformOwner()
                .map(ignored -> newOrganization(body))
                .flatMap(organization -> Panache.withTransaction(() -> Organization.findBySlug(organization.slug)
                        .flatMap(existing -> existing != null
                                ? Uni.createFrom().failure(new WebApplicationException(
                                        "Slug already in use: " + organization.slug, Response.Status.CONFLICT))
                                : organization.<Organization>persistAndFlush())))
                .map(created -> Response.status(Response.Status.CREATED)
                        .entity(OrganizationDto.from(created))
                        .build());
    }

    @GET
    @Path("/{slug}/roles/{roleCode}")
    @Operation(summary = "Get an organization role's assignees")
    public Uni<OrganizationRoleDto> getRole(@PathParam("slug") String slug, @PathParam("roleCode") String roleCode) {
        return authorizer.requirePlatformOwner().flatMap(ignored -> roles.getAsPlatform(slug, roleCode));
    }

    @PUT
    @Path("/{slug}/roles/{roleCode}")
    @Operation(summary = "Replace an organization role's assignees")
    public Uni<OrganizationRoleDto> replaceRole(@PathParam("slug") String slug,
            @PathParam("roleCode") String roleCode, SetOrganizationRoleRequest request) {
        return authorizer.requirePlatformOwner().flatMap(ignored -> roles.replaceAsPlatform(slug, roleCode, request));
    }

    private Organization newOrganization(CreateRootOrganizationRequest body) {
        if (body == null) {
            throw new BadRequestException("Request body is required");
        }
        if (body.slug() == null || !body.slug().trim().matches(SLUG)) {
            throw new BadRequestException("slug must be 3-100 chars: lowercase letters, digits and hyphens");
        }
        if (isBlank(body.name())) {
            throw new BadRequestException("name is required");
        }
        if (isBlank(body.tenantClientId())) {
            throw new BadRequestException("tenantClientId is required");
        }
        Organization organization = new Organization();
        organization.slug = body.slug().trim();
        organization.name = body.name().trim();
        organization.displayName = isBlank(body.displayName()) ? organization.name : body.displayName().trim();
        organization.tenantClientId = body.tenantClientId().trim();
        organization.alfrescoGroupId = isBlank(body.alfrescoGroupId()) ? null : body.alfrescoGroupId().trim();
        organization.taxId = isBlank(body.taxId()) ? null : normalizeTaxId(body.taxId());
        organization.active = true;
        return organization;
    }

    private String normalizeTaxId(String taxId) {
        try {
            return taxIdValidator.normalize(taxId);
        } catch (InvalidTaxIdException e) {
            throw new BadRequestException("Invalid tax id: " + e.getMessage());
        }
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
