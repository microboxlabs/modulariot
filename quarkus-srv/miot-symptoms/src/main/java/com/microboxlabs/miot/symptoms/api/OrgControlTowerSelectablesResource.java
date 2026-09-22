package com.microboxlabs.miot.symptoms.api;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.symptoms.dto.SelectableBindingsRequest;
import com.microboxlabs.miot.symptoms.dto.SelectableRequest;
import com.microboxlabs.miot.symptoms.service.SelectableService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
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
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** Option lists behind the treatment forms, and which form field uses which list. */
@Path(ControlTowerResourceSupport.BASE_PATH + "/selectables")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Control Tower — Selectables", description = "Editable option lists: call result, tags, ignore and invalidate reasons")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class OrgControlTowerSelectablesResource extends ControlTowerResourceSupport {

    private final SelectableService selectables;

    @Inject
    public OrgControlTowerSelectablesResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity,
            SelectableService selectables) {
        super(tenantContext, organizationContext, roleService, identity);
        this.selectables = selectables;
    }

    @GET
    @Operation(operationId = "listSelectables", summary = "List selectables",
            description = "Seeds the platform defaults the first time an organization asks.")
    public Uni<Response> list(@PathParam("organizationId") String organizationId) {
        String tenant = tenantCode(organizationId);
        return memberWork(() -> Response.ok(selectables.list(tenant)).build());
    }

    @GET
    @Path("/bindings")
    @Operation(operationId = "getSelectableBindings", summary = "Form field to selectable key",
            description = "A field with no explicit binding uses the selectable whose key equals the field key.")
    public Uni<Response> bindings(@PathParam("organizationId") String organizationId) {
        String tenant = tenantCode(organizationId);
        return memberWork(() -> Response.ok(selectables.bindings(tenant)).build());
    }

    @PUT
    @Path("/bindings")
    @Operation(operationId = "updateSelectableBindings", summary = "Bind form fields to selectables")
    public Uni<Response> updateBindings(
            @PathParam("organizationId") String organizationId,
            SelectableBindingsRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return ownerWork(organizationId, () -> Response.ok(selectables.updateBindings(tenant, actor, body)).build());
    }

    @POST
    @Path("/reset")
    @Operation(operationId = "resetSelectables", summary = "Restore the default lists",
            description = "Drops every list and binding of the organization and puts the defaults back.")
    public Uni<Response> reset(@PathParam("organizationId") String organizationId) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return ownerWork(organizationId, () -> Response.ok(selectables.reset(tenant, actor)).build());
    }

    @GET
    @Path("/{key}")
    @Operation(operationId = "getSelectable", summary = "Get one selectable")
    public Uni<Response> get(
            @PathParam("organizationId") String organizationId,
            @PathParam("key") String key) {
        String tenant = tenantCode(organizationId);
        return memberWork(() -> Response.ok(selectables.get(tenant, key)).build());
    }

    @PUT
    @Path("/{key}")
    @Operation(operationId = "replaceSelectable", summary = "Create or replace a selectable",
            description = "Whole-list replacement. Keep option ids stable so past actions keep pointing at the same outcome.")
    public Uni<Response> replace(
            @PathParam("organizationId") String organizationId,
            @PathParam("key") String key,
            SelectableRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return ownerWork(organizationId, () -> Response.ok(selectables.replace(tenant, actor, key, body)).build());
    }

    @DELETE
    @Path("/{key}")
    @Operation(operationId = "deleteSelectable", summary = "Delete a selectable")
    public Uni<Response> delete(
            @PathParam("organizationId") String organizationId,
            @PathParam("key") String key) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return ownerWork(organizationId, () -> selectables.delete(tenant, actor, key)
                ? Response.noContent().build()
                : error(Response.Status.NOT_FOUND, "selectable not found"));
    }
}
