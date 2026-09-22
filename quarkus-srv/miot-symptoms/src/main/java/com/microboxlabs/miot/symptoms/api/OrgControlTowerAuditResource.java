package com.microboxlabs.miot.symptoms.api;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.symptoms.service.AuditService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
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
import org.eclipse.microprofile.openapi.annotations.parameters.Parameter;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** Who did what, when, through this API. */
@Path(ControlTowerResourceSupport.BASE_PATH + "/audit")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "Control Tower — Audit", description = "Append-only log of every write through the Control Tower API")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class OrgControlTowerAuditResource extends ControlTowerResourceSupport {

    private final AuditService audit;

    @Inject
    public OrgControlTowerAuditResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity,
            AuditService audit) {
        super(tenantContext, organizationContext, roleService, identity);
        this.audit = audit;
    }

    @GET
    @Operation(operationId = "listAuditEvents", summary = "List audit events, newest first",
            description = "Page backwards with `before` set to the createdAt of the last event received.")
    public Uni<Response> list(
            @PathParam("organizationId") String organizationId,
            @Parameter(description = "treatment, contact or selectable") @QueryParam("entityType") String entityType,
            @QueryParam("entityId") String entityId,
            @QueryParam("symptomId") Long symptomId,
            @QueryParam("before") String before,
            @QueryParam("limit") Integer limit) {
        String tenant = tenantCode(organizationId);
        return memberWork(() -> Response.ok(
                audit.list(tenant, entityType, entityId, symptomId, parseBefore(before), limit)).build());
    }

    private static OffsetDateTime parseBefore(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return OffsetDateTime.parse(raw);
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("before must be an ISO-8601 date-time with offset");
        }
    }
}
