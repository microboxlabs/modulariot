package com.microboxlabs.miot.symptoms.api;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.symptoms.access.ControlTowerAccessCatalog;
import com.microboxlabs.miot.symptoms.signal.DeviceEvents;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.quarkus.security.PermissionsAllowed;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** Device events that do not travel in the GPS frames, for the symptom engine. EVENT_SEND sends them. */
@Path("/api/v1/orgs/{organizationId}/control-tower/device-events")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Control Tower — Device events", description = "Driver app, camera and sensor events for the symptoms")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class OrgControlTowerDeviceEventsResource extends ControlTowerResourceSupport {

    private final DeviceEvents events;

    @Inject
    public OrgControlTowerDeviceEventsResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity,
            DeviceEvents events) {
        super(tenantContext, organizationContext, roleService, identity);
        this.events = events;
    }

    @POST
    @Operation(operationId = "sendDeviceEvents",
            summary = "Send 1 to 100 device events; an event id already received is ignored (202)")
    @PermissionsAllowed(value = ControlTowerAccessCatalog.EVENT_SEND, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> send(@PathParam("organizationId") String organizationId, DeviceEvents.Request body) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.accepted(events.accept(tenant, body)).build());
    }

    @Override
    protected Response unmapped(RuntimeException e) {
        if (e instanceof DeviceEvents.UnavailableException) {
            return error(Response.Status.SERVICE_UNAVAILABLE, e.getMessage());
        }
        return super.unmapped(e);
    }
}
