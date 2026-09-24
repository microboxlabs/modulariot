package com.microboxlabs.miot.core.api;

import com.microboxlabs.miot.core.api.dto.SelectableBindingsRequest;
import com.microboxlabs.miot.core.api.dto.SelectableRequest;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.core.selectable.SelectableService;
import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.function.Supplier;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * Per-organization option lists behind form fields, and which field uses
 * which list. Any member reads; writes need an organization owner.
 *
 * <p>Endpoints return {@link Uni} so the request stays on the event loop for
 * the reactive {@code OrganizationRequestFilter}; the service call runs on the
 * worker pool. The tenant comes from the resolved organization and the actor
 * from the session, never from the body.
 */
@Path("/api/v1/orgs/{organizationId}/selectables")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Organization Selectables", description = "Editable option lists behind form fields")
@SecurityRequirement(name = "oidc")
@Authenticated
public class OrgSelectablesResource {

    private final TenantContext tenantContext;
    private final OrganizationContext organizationContext;
    private final OrganizationRoleService roleService;
    private final SecurityIdentity identity;
    private final SelectableService selectables;

    @Inject
    public OrgSelectablesResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity,
            SelectableService selectables) {
        this.tenantContext = tenantContext;
        this.organizationContext = organizationContext;
        this.roleService = roleService;
        this.identity = identity;
        this.selectables = selectables;
    }

    @GET
    @Operation(operationId = "listSelectables", summary = "List selectables",
            description = "Seeds the defaults the enabled components provide the first time an organization asks.")
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
            description = "Whole-list replacement. Keep option ids stable so records that point at an option keep resolving.")
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
    @Operation(operationId = "deleteSelectable", summary = "Delete a selectable",
            description = "Also removes the bindings that pointed at it.")
    public Uni<Response> delete(
            @PathParam("organizationId") String organizationId,
            @PathParam("key") String key) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return ownerWork(organizationId, () -> selectables.delete(tenant, actor, key)
                ? Response.noContent().build()
                : error(Response.Status.NOT_FOUND, "selectable not found"));
    }

    private Uni<Response> memberWork(Supplier<Response> work) {
        return Uni.createFrom().item(() -> guarded(work))
                .runSubscriptionOn(Infrastructure.getDefaultWorkerPool());
    }

    private Uni<Response> ownerWork(String organizationId, Supplier<Response> work) {
        return roleService.requireOwner(organizationId).flatMap(ignored -> memberWork(work));
    }

    private String tenantCode(String organizationId) {
        if (!Objects.equals(organizationId, organizationContext.getOrganizationId())) {
            throw new WebApplicationException(error(Response.Status.FORBIDDEN,
                    "Organization context does not match request path"));
        }
        return tenantContext.getTenantCode() != null ? tenantContext.getTenantCode() : tenantContext.getClientId();
    }

    /** The user's email for a session token, the client id for an M2M token. */
    private String actor() {
        String email = organizationContext.getUserEmail();
        if (email != null && !email.isBlank()) {
            return email;
        }
        if (identity != null && identity.getPrincipal() != null) {
            return identity.getPrincipal().getName();
        }
        return null;
    }

    /** {@link IllegalArgumentException} is a 400, {@link NoSuchElementException} a 404. */
    private static Response guarded(Supplier<Response> work) {
        try {
            return work.get();
        } catch (IllegalArgumentException e) {
            return error(Response.Status.BAD_REQUEST, e.getMessage());
        } catch (NoSuchElementException e) {
            return error(Response.Status.NOT_FOUND, e.getMessage());
        }
    }

    private static Response error(Response.Status status, String message) {
        return Response.status(status)
                .type(MediaType.APPLICATION_JSON)
                .entity(Map.of("error", message == null ? status.getReasonPhrase() : message))
                .build();
    }
}
