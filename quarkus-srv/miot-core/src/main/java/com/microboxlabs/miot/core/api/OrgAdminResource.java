package com.microboxlabs.miot.core.api;

import com.microboxlabs.miot.core.alfresco.IAlfrescoGroupAdminClient;
import com.microboxlabs.miot.core.api.dto.CreateOrganizationRequest;
import com.microboxlabs.miot.core.api.dto.OrganizationDto;
import com.microboxlabs.miot.core.api.dto.PatchOrganizationRequest;
import com.microboxlabs.miot.core.auth.WriteAuthorizer;
import com.microboxlabs.miot.core.model.Organization;
import com.microboxlabs.miot.core.tax.ActiveTaxIdValidator;
import com.microboxlabs.miot.core.tax.TaxIdValidator;
import com.microboxlabs.miot.core.tax.TaxIdValidator.InvalidTaxIdException;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.jboss.logging.Logger;

/**
 * Admin write operations on organizations:
 *
 * <ul>
 *   <li>{@code POST   /api/v1/orgs/{parentSlug}/children} — create a sub-account.</li>
 *   <li>{@code PATCH  /api/v1/orgs/{slug}}               — rename / update tax id.</li>
 *   <li>{@code DELETE /api/v1/orgs/{slug}}               — soft delete ({@code active=false}).</li>
 * </ul>
 *
 * <p>All operations require {@code SITE_MANAGER} on the parent of
 * the target org (see {@link WriteAuthorizer}). The URL is still
 * {@code /api/v1/orgs/{slug}/...}, so the existing
 * {@code OrganizationRequestFilter} first ensures the caller is a
 * member of the target; the write authorizer then enforces the
 * stronger parent-manager rule.
 *
 * <p>All multi-step flows chain sequentially via {@code flatMap} to
 * respect the Hibernate Reactive one-session-no-parallel-queries rule.
 * Mixed Alfresco HTTP + Panache steps are safe in the same chain —
 * the HTTP step runs outside the reactive session boundary.
 */
@Path("/api/v1/orgs")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Organization Admin",
        description = "Create sub-accounts, edit and soft-delete organizations")
@SecurityRequirement(name = "oidc")
public class OrgAdminResource {

    private static final Logger LOG = Logger.getLogger(OrgAdminResource.class);

    private final IAlfrescoGroupAdminClient groupAdmin;
    private final TaxIdValidator taxIdValidator;
    private final WriteAuthorizer writeAuthorizer;

    @Inject
    public OrgAdminResource(IAlfrescoGroupAdminClient groupAdmin,
                            @ActiveTaxIdValidator TaxIdValidator taxIdValidator,
                            WriteAuthorizer writeAuthorizer) {
        this.groupAdmin = groupAdmin;
        this.taxIdValidator = taxIdValidator;
        this.writeAuthorizer = writeAuthorizer;
    }

    @POST
    @Path("/{parentSlug}/children")
    @Operation(summary = "Create a sub-account under the given parent organization")
    public Uni<Response> createChild(@PathParam("parentSlug") String parentSlug,
                                     CreateOrganizationRequest body) {
        validateCreatePayload(body);
        String normalizedTaxId;
        try {
            normalizedTaxId = taxIdValidator.normalize(body.taxId());
        } catch (InvalidTaxIdException e) {
            throw new BadRequestException("Invalid tax id: " + e.getMessage());
        }
        String newSlug = body.slug().trim();
        String newName = body.name().trim();
        String newDisplayName = (body.displayName() == null || body.displayName().isBlank())
                ? newName : body.displayName().trim();
        String derivedGroupId = body.alfrescoGroupId() != null && !body.alfrescoGroupId().isBlank()
                ? body.alfrescoGroupId().trim()
                : "GROUP_" + newSlug.toUpperCase().replace('-', '_');

        return Panache.withTransaction(() ->
                Organization.findBySlug(parentSlug)
                        .flatMap(parent -> {
                            if (parent == null) {
                                return Uni.createFrom().failure(new NotFoundException(
                                        "Parent organization not found: " + parentSlug));
                            }
                            if (parent.parent != null) {
                                return Uni.createFrom().failure(new BadRequestException(
                                        "Cannot nest sub-accounts beyond 2 levels"));
                            }
                            return writeAuthorizer.requireParentSiteManager(parent)
                                    .flatMap(ignored -> assertSlugAvailable(newSlug))
                                    .flatMap(ignored -> assertTaxIdAvailable(normalizedTaxId))
                                    .flatMap(ignored -> persistNewChild(
                                            parent, newSlug, newName, newDisplayName,
                                            normalizedTaxId, derivedGroupId))
                                    .flatMap(child -> groupAdmin
                                            .createGroup(derivedGroupId, newDisplayName)
                                            .onFailure().invoke(err ->
                                                    LOG.errorf(err,
                                                            "Alfresco group create failed for %s after persisting child %s",
                                                            derivedGroupId, newSlug))
                                            .replaceWith(child));
                        }))
                .map(org -> Response.status(Response.Status.CREATED)
                        .entity(OrganizationDto.from(org))
                        .build());
    }

    @PATCH
    @Path("/{slug}")
    @Operation(summary = "Update display name and/or tax id of an organization")
    public Uni<OrganizationDto> patch(@PathParam("slug") String slug, PatchOrganizationRequest body) {
        validatePatchPayload(body);
        String normalizedTaxId = normalizePatchTaxId(body.taxId());

        return Panache.withTransaction(() ->
                Organization.findBySlug(slug)
                        .flatMap(org -> {
                            if (org == null) {
                                return Uni.createFrom().failure(new NotFoundException(
                                        "Organization not found: " + slug));
                            }
                            return writeAuthorizer.requireParentSiteManager(org)
                                    .flatMap(ignored -> assertUpdatedTaxIdAvailable(org, normalizedTaxId))
                                    .map(ignored -> applyPatch(org, body, normalizedTaxId))
                                    .flatMap(updated -> updated.<Organization>persist());
                        }))
                .map(OrganizationDto::from);
    }

    @DELETE
    @Path("/{slug}")
    @Operation(summary = "Soft-delete an organization (sets active=false)")
    public Uni<Response> delete(@PathParam("slug") String slug) {
        return Panache.withTransaction(() ->
                Organization.findBySlug(slug)
                        .flatMap(org -> {
                            if (org == null) {
                                return Uni.createFrom().failure(new NotFoundException(
                                        "Organization not found: " + slug));
                            }
                            return writeAuthorizer.requireParentSiteManager(org)
                                    .flatMap(ignored -> {
                                        org.active = false;
                                        return org.<Organization>persist();
                                    });
                        }))
                .map(org -> Response.noContent().build());
    }

    private Uni<Organization> persistNewChild(Organization parent,
                                              String slug,
                                              String name,
                                              String displayName,
                                              String taxId,
                                              String alfrescoGroupId) {
        Organization child = new Organization();
        child.slug = slug;
        child.name = name;
        child.displayName = displayName;
        child.taxId = taxId;
        child.alfrescoGroupId = alfrescoGroupId;
        // New sub-accounts inherit the parent's Auth0 M2M client id. Pgrest
        // tenant filtering uses tax_id, not tenant_client_id, so this is fine.
        child.tenantClientId = parent.tenantClientId;
        child.parent = parent;
        child.active = true;
        return child.<Organization>persistAndFlush();
    }

    private Uni<Void> assertSlugAvailable(String slug) {
        return Organization.findBySlug(slug)
                .flatMap(existing -> existing == null
                        ? Uni.createFrom().voidItem()
                        : Uni.createFrom().failure(new WebApplicationException(
                                "Slug already in use: " + slug, Response.Status.CONFLICT)));
    }

    private Uni<Void> assertTaxIdAvailable(String taxId) {
        return Organization.find("taxId = ?1 and active = true", taxId).firstResult()
                .flatMap(existing -> existing == null
                        ? Uni.createFrom().voidItem()
                        : Uni.createFrom().failure(new WebApplicationException(
                                "Tax id already in use: " + taxId, Response.Status.CONFLICT)));
    }

    private static void validateCreatePayload(CreateOrganizationRequest body) {
        if (body == null) {
            throw new BadRequestException("Request body is required");
        }
        if (body.slug() == null || body.slug().isBlank()) {
            throw new BadRequestException("slug is required");
        }
        if (!body.slug().matches("[a-z0-9][a-z0-9-]{1,98}[a-z0-9]")) {
            throw new BadRequestException(
                    "slug must be 3-100 chars: lowercase letters, digits and hyphens");
        }
        if (body.name() == null || body.name().isBlank()) {
            throw new BadRequestException("name is required");
        }
        if (body.taxId() == null || body.taxId().isBlank()) {
            throw new BadRequestException("taxId is required for sub-accounts");
        }
    }

    private static void validatePatchPayload(PatchOrganizationRequest body) {
        if (body == null) {
            throw new BadRequestException("Request body is required");
        }
    }

    private String normalizePatchTaxId(String taxId) {
        if (taxId == null) {
            return null;
        }
        if (taxId.isBlank()) {
            throw new BadRequestException("taxId cannot be blank");
        }
        try {
            return taxIdValidator.normalize(taxId);
        } catch (InvalidTaxIdException e) {
            throw new BadRequestException("Invalid tax id: " + e.getMessage());
        }
    }

    private Uni<Void> assertUpdatedTaxIdAvailable(Organization org, String normalizedTaxId) {
        if (normalizedTaxId == null || normalizedTaxId.equals(org.taxId)) {
            return Uni.createFrom().voidItem();
        }
        return assertTaxIdAvailable(normalizedTaxId);
    }

    private static Organization applyPatch(Organization org,
                                           PatchOrganizationRequest body,
                                           String normalizedTaxId) {
        if (body.displayName() != null) {
            org.displayName = body.displayName().isBlank()
                    ? null : body.displayName().trim();
        }
        if (body.taxId() != null) {
            org.taxId = normalizedTaxId;
        }
        return org;
    }
}
