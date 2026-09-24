package com.microboxlabs.miot.symptoms.api;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.symptoms.dto.ContactRequest;
import com.microboxlabs.miot.symptoms.service.ContactService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PATCH;
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

/**
 * The organization's "who to call" list. Any member can read, add and edit
 * contacts (operators add them from the call panel); deleting needs an owner.
 */
@Path(ControlTowerResourceSupport.BASE_PATH + "/contacts")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Control Tower — Contacts", description = "People the tower can call about a symptom, with their call history")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class OrgControlTowerContactsResource extends ControlTowerResourceSupport {

    private final ContactService contacts;

    @Inject
    public OrgControlTowerContactsResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity,
            ContactService contacts) {
        super(tenantContext, organizationContext, roleService, identity);
        this.contacts = contacts;
    }

    @GET
    @Operation(operationId = "listContacts", summary = "List contacts with call statistics")
    public Uni<Response> list(
            @PathParam("organizationId") String organizationId,
            @QueryParam("active") Boolean active) {
        String tenant = tenantCode(organizationId);
        return memberWork(() -> Response.ok(contacts.list(tenant, active)).build());
    }

    @GET
    @Path("/{contactId}")
    @Operation(operationId = "getContact", summary = "Get a contact")
    public Uni<Response> get(
            @PathParam("organizationId") String organizationId,
            @PathParam("contactId") String contactId) {
        String tenant = tenantCode(organizationId);
        return memberWork(() -> Response.ok(contacts.get(tenant, contactId)).build());
    }

    @POST
    @Operation(operationId = "createContact", summary = "Create a contact")
    public Uni<Response> create(
            @PathParam("organizationId") String organizationId,
            ContactRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return memberWork(() -> Response.status(Response.Status.CREATED)
                .entity(contacts.create(tenant, actor, body))
                .build());
    }

    @PATCH
    @Path("/{contactId}")
    @Operation(operationId = "updateContact", summary = "Update a contact (partial)")
    public Uni<Response> update(
            @PathParam("organizationId") String organizationId,
            @PathParam("contactId") String contactId,
            ContactRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return memberWork(() -> Response.ok(contacts.update(tenant, actor, contactId, body)).build());
    }

    @DELETE
    @Path("/{contactId}")
    @Operation(operationId = "deleteContact", summary = "Delete a contact",
            description = "Past call actions keep the contact's name and phone as they were at the time.")
    public Uni<Response> delete(
            @PathParam("organizationId") String organizationId,
            @PathParam("contactId") String contactId) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return ownerWork(organizationId, () -> contacts.delete(tenant, actor, contactId)
                ? Response.noContent().build()
                : error(Response.Status.NOT_FOUND, "contact not found"));
    }
}
