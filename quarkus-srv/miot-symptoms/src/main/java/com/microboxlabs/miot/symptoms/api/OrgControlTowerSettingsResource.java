package com.microboxlabs.miot.symptoms.api;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.symptoms.service.TowerSettingsService;
import com.microboxlabs.miot.symptoms.service.TowerSettingsService.SettingsRequest;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** The organization's operator team, used for the operator load card. Members read; owners save. */
@Path("/api/v1/orgs/{organizationId}/control-tower/settings")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Control Tower — Settings", description = "Operators, shift length and capacity per shift")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class OrgControlTowerSettingsResource extends ControlTowerResourceSupport {

    private static final String ORG = "organizationId";

    private final TowerSettingsService settings;

    @Inject
    public OrgControlTowerSettingsResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity,
            TowerSettingsService settings) {
        super(tenantContext, organizationContext, roleService, identity);
        this.settings = settings;
    }

    @GET
    @Operation(operationId = "getTowerSettings",
            summary = "The operator team; defaults (8-hour shifts, nothing else set) when never saved")
    public Uni<Response> get(@PathParam(ORG) String organizationId) {
        String tenant = tenantCode(organizationId);
        return memberWork(() -> Response.ok(settings.get(tenant)).build());
    }

    @PUT
    @Operation(operationId = "saveTowerSettings",
            summary = "Save the operator team. shiftHours 1-24 (default 8); operators and capacityPerShift may be"
                    + " null to clear them")
    public Uni<Response> save(@PathParam(ORG) String organizationId, SettingsRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return ownerWork(organizationId, () -> Response.ok(settings.save(tenant, actor, body)).build());
    }
}
