package com.microboxlabs.miot.trips.api;

import com.microboxlabs.miot.core.api.OrgResourceSupport;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.trips.access.TripsAccessCatalog;
import com.microboxlabs.miot.trips.service.AuditService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.quarkus.security.PermissionsAllowed;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** Audit trail of the trips module, keyset-paginated (newest first). */
@Path("/api/v1/orgs/{organizationId}/trips/audit")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "Trips — Audit", description = "Audit events, keyset pagination")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class OrgTripsAuditResource extends OrgResourceSupport {

    private static final String ORG = "organizationId";

    private final AuditService audit;

    @Inject
    public OrgTripsAuditResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity,
            AuditService audit) {
        super(tenantContext, organizationContext, roleService, identity);
        this.audit = audit;
    }

    @GET
    @Operation(operationId = "listTripsAudit",
            summary = "Audit events newest first; filter by entityType/entityId, keyset with before+beforeId")
    @PermissionsAllowed(value = TripsAccessCatalog.VIEW, permission = OrgPermission.class, params = "organizationId")
    public Uni<Response> list(
            @PathParam(ORG) String organizationId,
            @QueryParam("entityType") String entityType,
            @QueryParam("entityId") String entityId,
            @QueryParam("before") String before,
            @QueryParam("beforeId") String beforeId,
            @QueryParam("limit") String limit) {
        String tenant = tenantCode(organizationId);
        return work(() -> {
            OffsetDateTime beforeTs = null;
            if (before != null && !before.isBlank()) {
                try {
                    beforeTs = OffsetDateTime.parse(before);
                } catch (DateTimeParseException e) {
                    throw new IllegalArgumentException("before must be an ISO-8601 timestamp");
                }
            }
            return Response.ok(audit.list(tenant, entityType, entityId, beforeTs, longParam(beforeId, "beforeId"),
                    integer(limit, "limit"))).build();
        });
    }
}
