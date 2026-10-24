package com.microboxlabs.miot.fleet.resources.api;

import com.microboxlabs.miot.core.api.OrgResourceSupport;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.fleet.access.FleetAccessCatalog;
import com.microboxlabs.miot.fleet.resources.dto.AttributeRequest;
import com.microboxlabs.miot.fleet.resources.dto.AttributeView;
import com.microboxlabs.miot.fleet.resources.service.AccreditationService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.quarkus.security.PermissionsAllowed;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** Accreditation: attributes with validity per resource; the feed upserts by natural key. */
@Path("/api/v1/orgs/{organizationId}/fleet/accreditation")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Fleet — Accreditation", description = "Resource attributes: site accreditations, certifications, insurances, licenses")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.fleet.enabled", stringValue = "true")
public class OrgFleetAccreditationResource extends OrgResourceSupport {

    private static final String ORG = "organizationId";

    private final AccreditationService accreditation;

    @Inject
    public OrgFleetAccreditationResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity,
            AccreditationService accreditation) {
        super(tenantContext, organizationContext, roleService, identity);
        this.accreditation = accreditation;
    }

    @POST
    @Operation(operationId = "upsertAttribute",
            summary = "Upserts the attribute by (resource, attributeType, attributeKey); versioning keeps history")
    @PermissionsAllowed(value = FleetAccessCatalog.ACCREDITATION_WRITE, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> upsert(@PathParam(ORG) String organizationId, AttributeRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.ok(AttributeView.of(accreditation.upsert(tenant, actor, body))).build());
    }

    @GET
    @Path("/{resourceType}/{resourceId}")
    @Operation(operationId = "listResourceAttributes", summary = "The resource's attributes, current versions")
    @PermissionsAllowed(value = FleetAccessCatalog.RESOURCES_VIEW, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> listByResource(@PathParam(ORG) String organizationId,
            @PathParam("resourceType") String resourceType, @PathParam("resourceId") String resourceId) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(
                accreditation.listByResource(tenant, resourceType, uuid(resourceId, "resourceId"))
                        .stream().map(AttributeView::of).toList())
                .build());
    }

    @GET
    @Path("/accredited")
    @Operation(operationId = "listAccredited",
            summary = "Resources accredited for a key (default SITE_ACCREDITATION, values ACCREDITED/VALID, now)")
    @PermissionsAllowed(value = FleetAccessCatalog.RESOURCES_VIEW, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> accredited(@PathParam(ORG) String organizationId,
            @QueryParam("attributeType") String attributeType,
            @QueryParam("attributeKey") String attributeKey,
            @QueryParam("values") String values,
            @QueryParam("at") String at) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(
                accreditation.accredited(tenant, attributeType, attributeKey, values, at)).build());
    }
}
