package com.microboxlabs.miot.core.api;

import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;

/**
 * Reactive REST Client for the dashboard server
 * ({@code @microboxlabs/miot-dashboard-server}). The {@code "dashboards"}
 * binding name matches {@code quarkus.rest-client."dashboards".url}.
 *
 * <p>Its contract is {@code /tenants/{tenantId}/scopes/{scopeId}/dashboards},
 * and both identifiers are its own: it is a standalone service that also runs
 * with nothing in front of it, so this proxy maps an organization onto that
 * model rather than the other way round. See
 * {@link DashboardProxyResource#scopeIdFor}.
 *
 * <p>{@link DashboardProxyResource} forwards the caller's bearer token
 * verbatim, exactly as {@link HarnessProxyResource} does: the dashboard server
 * verifies it itself and re-derives the caller, so the proxy asserts no
 * identity and there is nothing for it to be trusted about.
 *
 * <p>Methods return {@code Uni<Response>} so upstream status codes reach the
 * caller unchanged — a stale write is a 409, and a dashboard the caller may
 * not see is a 200 with a null body rather than a 404, which is the upstream
 * refusing to say whether it exists.
 */
@RegisterRestClient(configKey = "dashboards")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Path("/tenants/{tenantId}/scopes/{scopeId}/dashboards")
public interface DashboardClient {

    @GET
    Uni<Response> list(
            @PathParam("tenantId") String tenantId,
            @PathParam("scopeId") String scopeId,
            @HeaderParam("Authorization") String authorization);

    @GET
    @Path("/{slug}")
    Uni<Response> get(
            @PathParam("tenantId") String tenantId,
            @PathParam("scopeId") String scopeId,
            @PathParam("slug") String slug,
            @HeaderParam("Authorization") String authorization);

    /**
     * {@code If-Match} carries the integer revision the caller believes it is
     * replacing. Forwarded rather than generated here: the precondition is
     * between the browser that read the dashboard and the store that holds it,
     * and a proxy inventing one would turn a conflict into a silent overwrite.
     */
    @PUT
    @Path("/{slug}")
    Uni<Response> save(
            @PathParam("tenantId") String tenantId,
            @PathParam("scopeId") String scopeId,
            @PathParam("slug") String slug,
            @HeaderParam("Authorization") String authorization,
            @HeaderParam("If-Match") String ifMatch,
            Map<String, Object> body);

    @DELETE
    @Path("/{slug}")
    Uni<Response> delete(
            @PathParam("tenantId") String tenantId,
            @PathParam("scopeId") String scopeId,
            @PathParam("slug") String slug,
            @HeaderParam("Authorization") String authorization);

    @GET
    @Path("/{slug}/capabilities")
    Uni<Response> capabilities(
            @PathParam("tenantId") String tenantId,
            @PathParam("scopeId") String scopeId,
            @PathParam("slug") String slug,
            @HeaderParam("Authorization") String authorization);

    @GET
    @Path("/{slug}/permissions")
    Uni<Response> getPermissions(
            @PathParam("tenantId") String tenantId,
            @PathParam("scopeId") String scopeId,
            @PathParam("slug") String slug,
            @HeaderParam("Authorization") String authorization);

    @PUT
    @Path("/{slug}/permissions")
    Uni<Response> setPermissions(
            @PathParam("tenantId") String tenantId,
            @PathParam("scopeId") String scopeId,
            @PathParam("slug") String slug,
            @HeaderParam("Authorization") String authorization,
            Map<String, Object> body);
}
