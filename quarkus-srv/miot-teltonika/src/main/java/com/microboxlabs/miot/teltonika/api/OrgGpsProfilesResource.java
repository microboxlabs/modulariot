package com.microboxlabs.miot.teltonika.api;

import com.microboxlabs.miot.core.api.OrgResourceSupport;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.teltonika.access.DevicesAccessCatalog;
import com.microboxlabs.miot.teltonika.service.ProfileService;
import com.microboxlabs.miot.teltonika.service.ProfileService.ConfigRequest;
import com.microboxlabs.miot.teltonika.service.ProfileService.InputRequest;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.quarkus.security.PermissionsAllowed;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.UUID;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * The organization's device profiles. Configuration profiles: the parameters its devices should carry
 * (frequency, ignition source, sleep, I/O), shown in the connection guide and sendable to a device.
 * Input profiles: what is wired to each input (door, panic button, PTO...) and which events it
 * produces, for every brand.
 */
@Path("/api/v1/orgs/{organizationId}/gps")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "GPS — Device profiles", description = "Configuration and input profiles of direct devices")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.teltonika.enabled", stringValue = "true")
public class OrgGpsProfilesResource extends OrgResourceSupport {

    private static final String ORG = "organizationId";

    private final ProfileService profiles;

    @Inject
    public OrgGpsProfilesResource(TenantContext tenantContext, OrganizationContext organizationContext,
            OrganizationRoleService roleService, SecurityIdentity identity, ProfileService profiles) {
        super(tenantContext, organizationContext, roleService, identity);
        this.profiles = profiles;
    }

    @GET
    @Path("/config-profiles")
    @Operation(operationId = "listConfigProfiles", summary = "Configuration profiles, with how many devices use each")
    @PermissionsAllowed(value = DevicesAccessCatalog.VIEW, permission = OrgPermission.class, params = ORG)
    public Uni<Response> listConfig(@PathParam(ORG) String organizationId) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(profiles.configProfiles(tenant)).build());
    }

    @GET
    @Path("/config-profiles/{id}")
    @Operation(operationId = "getConfigProfile", summary = "One configuration profile")
    @PermissionsAllowed(value = DevicesAccessCatalog.VIEW, permission = OrgPermission.class, params = ORG)
    public Uni<Response> getConfig(@PathParam(ORG) String organizationId, @PathParam("id") UUID id) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(profiles.configProfile(tenant, id)).build());
    }

    @POST
    @Path("/config-profiles")
    @Operation(operationId = "createConfigProfile", summary = "Creates a configuration profile")
    @PermissionsAllowed(value = DevicesAccessCatalog.WRITE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> createConfig(@PathParam(ORG) String organizationId, ConfigRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.status(Response.Status.CREATED)
                .entity(profiles.saveConfig(tenant, null, body, actor)).build());
    }

    @PUT
    @Path("/config-profiles/{id}")
    @Operation(operationId = "updateConfigProfile", summary = "Replaces a configuration profile")
    @PermissionsAllowed(value = DevicesAccessCatalog.WRITE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> updateConfig(@PathParam(ORG) String organizationId, @PathParam("id") UUID id,
            ConfigRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.ok(profiles.saveConfig(tenant, id, body, actor)).build());
    }

    @DELETE
    @Path("/config-profiles/{id}")
    @Operation(operationId = "deleteConfigProfile", summary = "Deletes a configuration profile no device uses")
    @PermissionsAllowed(value = DevicesAccessCatalog.WRITE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> deleteConfig(@PathParam(ORG) String organizationId, @PathParam("id") UUID id) {
        String tenant = tenantCode(organizationId);
        return work(() -> {
            profiles.deleteConfig(tenant, id);
            return Response.noContent().build();
        });
    }

    @GET
    @Path("/input-profiles")
    @Operation(operationId = "listInputProfiles", summary = "Input profiles, with how many devices use each")
    @PermissionsAllowed(value = DevicesAccessCatalog.VIEW, permission = OrgPermission.class, params = ORG)
    public Uni<Response> listInput(@PathParam(ORG) String organizationId) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(profiles.inputProfiles(tenant)).build());
    }

    @GET
    @Path("/input-profiles/meanings")
    @Operation(operationId = "listInputMeanings", summary = "What an input can mean and the events it produces")
    @PermissionsAllowed(value = DevicesAccessCatalog.VIEW, permission = OrgPermission.class, params = ORG)
    public Uni<Response> meanings(@PathParam(ORG) String organizationId) {
        tenantCode(organizationId);
        return work(() -> Response.ok(ProfileService.meanings()).build());
    }

    @GET
    @Path("/input-profiles/{id}")
    @Operation(operationId = "getInputProfile", summary = "One input profile")
    @PermissionsAllowed(value = DevicesAccessCatalog.VIEW, permission = OrgPermission.class, params = ORG)
    public Uni<Response> getInput(@PathParam(ORG) String organizationId, @PathParam("id") UUID id) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(profiles.inputProfile(tenant, id)).build());
    }

    @POST
    @Path("/input-profiles")
    @Operation(operationId = "createInputProfile", summary = "Creates an input profile")
    @PermissionsAllowed(value = DevicesAccessCatalog.WRITE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> createInput(@PathParam(ORG) String organizationId, InputRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.status(Response.Status.CREATED)
                .entity(profiles.saveInput(tenant, null, body, actor)).build());
    }

    @PUT
    @Path("/input-profiles/{id}")
    @Operation(operationId = "updateInputProfile", summary = "Replaces an input profile and its mappings")
    @PermissionsAllowed(value = DevicesAccessCatalog.WRITE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> updateInput(@PathParam(ORG) String organizationId, @PathParam("id") UUID id,
            InputRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.ok(profiles.saveInput(tenant, id, body, actor)).build());
    }

    @DELETE
    @Path("/input-profiles/{id}")
    @Operation(operationId = "deleteInputProfile", summary = "Deletes an input profile no device uses")
    @PermissionsAllowed(value = DevicesAccessCatalog.WRITE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> deleteInput(@PathParam(ORG) String organizationId, @PathParam("id") UUID id) {
        String tenant = tenantCode(organizationId);
        return work(() -> {
            profiles.deleteInput(tenant, id);
            return Response.noContent().build();
        });
    }
}
