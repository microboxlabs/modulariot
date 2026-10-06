package com.microboxlabs.miot.core.api;

import jakarta.ws.rs.PATCH;
import com.microboxlabs.miot.core.iam.model.IamProjectionChange;
import com.microboxlabs.miot.core.iam.model.IamAuditEvent;
import com.microboxlabs.miot.core.iam.AccessEvaluator;
import com.microboxlabs.miot.core.iam.AlfrescoBridge;
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
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.NoSuchElementException;
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
    private static final String NATIVE = "NATIVE";
    private static final String ALFRESCO = "ALFRESCO";

    /** {@code membershipSource}: ALFRESCO or NATIVE. */
    public record MembershipSourceRequest(String membershipSource) {
    }

    /**
     * One organization in the platform-wide list. {@code membershipSource} is the one in effect: the
     * top-level organization's, or NATIVE for a native deployment. {@code parentSlug} is null for a
     * top-level organization.
     */
    public record PlatformOrganizationView(String slug, String name, String displayName, String tenantClientId,
            String membershipSource, String taxId, String parentSlug) {
    }

    public record ProjectionView(Long id, String kind, String subject, String status, int attempts, String lastError,
            Instant createdAt, Instant updatedAt) {
    }

    private final PlatformAuthorizer authorizer;
    private final OrganizationRoleService roles;
    private final TaxIdValidator taxIdValidator;
    private final AlfrescoBridge bridge;
    private final AccessEvaluator access;

    @Inject
    public PlatformOrganizationsResource(PlatformAuthorizer authorizer, OrganizationRoleService roles,
            @ActiveTaxIdValidator TaxIdValidator taxIdValidator, AlfrescoBridge bridge, AccessEvaluator access) {
        this.authorizer = authorizer;
        this.roles = roles;
        this.taxIdValidator = taxIdValidator;
        this.bridge = bridge;
        this.access = access;
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
    @Operation(summary = "List every active organization")
    public Uni<List<PlatformOrganizationView>> list() {
        return authorizer.requirePlatformOwner()
                .flatMap(ignored -> Panache.withSession(Organization::listAllActiveWithParent))
                .map(organizations -> organizations.stream().map(this::view).toList());
    }

    private PlatformOrganizationView view(Organization org) {
        // Organizations are at most two levels deep, so the parent is the top-level one.
        Organization root = org.parent == null ? org : org.parent;
        String source = access.isNative(root) ? NATIVE : ALFRESCO;
        return new PlatformOrganizationView(org.slug, org.name, org.displayName, org.tenantClientId, source,
                org.taxId, org.parent == null ? null : org.parent.slug);
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
        return authorizer.requirePlatformOwner()
                .flatMap(actor -> roles.replaceAsPlatform(slug, roleCode, request, actor));
    }

    @POST
    @Path("/{slug}/alfresco-import")
    @Consumes(MediaType.WILDCARD)
    @Operation(summary = "Copy the organization's Alfresco group into memberships (managers as Admin). Run it before"
            + " switching the organization to NATIVE")
    public Uni<Response> importAlfresco(@PathParam("slug") String slug) {
        return authorizer.requirePlatformOwner()
                .flatMap(actor -> IamResponses.ok(() -> bridge.importMembers(slug, actor)));
    }

    @PATCH
    @Path("/{slug}/membership-source")
    @Operation(summary = "Switch a top-level organization between ALFRESCO and NATIVE membership")
    public Uni<Response> setMembershipSource(@PathParam("slug") String slug, MembershipSourceRequest body) {
        return authorizer.requirePlatformOwner().flatMap(actor -> IamResponses.ok(() -> {
            String source = parseMembershipSource(body == null ? null : body.membershipSource());
            if (source == null) {
                throw new IllegalArgumentException("membershipSource is required");
            }
            return switchMembershipSource(slug, source, actor);
        }));
    }

    @SuppressWarnings("java:S1612") // PanacheEntityBase::persist is ambiguous with Reactive Panache overloads.
    private static Uni<Map<String, String>> switchMembershipSource(String slug, String source, String actor) {
        return Panache.withTransaction(() -> Organization.findBySlug(slug).flatMap(org -> {
            if (org == null) {
                throw new NoSuchElementException("Organization not found: " + slug);
            }
            if (org.parent != null) {
                throw new IllegalArgumentException("Set it on the top-level organization");
            }
            org.membershipSource = source;
            return org.<Organization>persist()
                    .flatMap(saved -> IamAuditEvent.of(org.id, actor, "membership-source", source, Map.of())
                            .persist())
                    .map(ignored -> Map.of("organization", org.slug, "membershipSource", source));
        }));
    }

    @GET
    @Path("/{slug}/alfresco-projection")
    @Operation(summary = "The latest changes sent, or waiting to be sent, to the organization's Alfresco group")
    public Uni<Response> projection(@PathParam("slug") String slug) {
        return authorizer.requirePlatformOwner().flatMap(actor -> IamResponses.ok(() -> Panache.withSession(
                () -> Organization.findBySlug(slug).flatMap(org -> {
                    if (org == null) {
                        throw new NoSuchElementException("Organization not found: " + slug);
                    }
                    return IamProjectionChange.forOrganization(org.id, 100).map(rows -> rows.stream()
                            .map(c -> new ProjectionView(c.id, c.kind, c.subject, c.status, c.attempts, c.lastError,
                                    c.createdAt, c.updatedAt)).toList());
                }))));
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
        organization.membershipSource = membershipSource(body);
        organization.active = true;
        return organization;
    }

    /** As requested; otherwise ALFRESCO when the organization names an Alfresco group, else NATIVE. */
    static String membershipSource(CreateRootOrganizationRequest body) {
        String source = parseMembershipSource(body.membershipSource());
        if (source != null) {
            return source;
        }
        return isBlank(body.alfrescoGroupId()) ? NATIVE : ALFRESCO;
    }

    /** ALFRESCO or NATIVE, upper-cased; null when blank. */
    static String parseMembershipSource(String raw) {
        if (isBlank(raw)) {
            return null;
        }
        String source = raw.trim().toUpperCase(Locale.ROOT);
        if (!source.equals(ALFRESCO) && !source.equals(NATIVE)) {
            throw new BadRequestException("membershipSource must be ALFRESCO or NATIVE");
        }
        return source;
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
