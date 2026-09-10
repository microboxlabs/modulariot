package com.microboxlabs.miot.core.api;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.eclipse.microprofile.rest.client.inject.RestClient;

/**
 * Auth-gated proxy for the dashboard server's dashboard routes.
 *
 * <p>The {@code /api/v1/orgs/{slug}/...} prefix makes
 * {@code OrganizationRequestFilter} resolve the org membership before this
 * handler runs, so a non-member never reaches the upstream at all. The
 * caller's bearer token is then forwarded verbatim and the dashboard server
 * verifies it and applies its own tenant, scope and per-dashboard rules — the
 * same arrangement as {@link HarnessProxyResource}.
 *
 * <p><strong>This proxy asserts no identity.</strong> It narrows what is
 * reachable and maps the org onto the upstream's address space; it is not a
 * trusted party, and the upstream refuses a request whose token it cannot
 * verify whether or not this proxy allowed it. That is deliberate: the
 * dashboard server also runs with nothing in front of it, so its
 * authorization can never depend on this being here.
 */
@Path("/api/v1/orgs/{slug}/dashboards")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Dashboards", description = "Proxy to the dashboard server")
@SecurityRequirement(name = "oidc")
public class DashboardProxyResource {

    /** Alfresco's site groups are named for the site they belong to. */
    private static final String SITE_GROUP_PREFIX = "GROUP_site_";

    private final DashboardClient dashboards;
    private final OrganizationContext organizationContext;
    private final String defaultScopeId;

    @Inject
    public DashboardProxyResource(@RestClient DashboardClient dashboards,
                                  OrganizationContext organizationContext,
                                  @ConfigProperty(name = "miot.dashboards.default-scope",
                                          defaultValue = "default")
                                  String defaultScopeId) {
        this.dashboards = dashboards;
        this.organizationContext = organizationContext;
        this.defaultScopeId = defaultScopeId;
    }

    /**
     * The org slug, which is already the identifier in the request path and is
     * unique across organizations.
     *
     * <p>Not {@code tenantClientId}: that value is an OAuth client id, it
     * appears in tokens, and putting it in a URL the browser holds would leak
     * it into history and logs for no gain. The dashboard server's tenant is
     * host-defined, so the readable identifier is the better one.
     */
    private String tenantIdFor(String slug) {
        return slug;
    }

    /**
     * The Alfresco site behind the org, which is the closest thing the
     * modulith has to the upstream's scope.
     *
     * <p>An org holds exactly one group, so today this is one scope per org.
     * Orgs whose group is not a site group — and orgs with no group, which the
     * membership filter lets through when {@code alfrescoGroupId} is null —
     * have no site to name, and fall back to a configured scope id rather than
     * being refused: they are entitled to their dashboards, they simply have
     * one scope. The value is per-tenant in the upstream, so two orgs sharing
     * the fallback name address different scopes.
     */
    private String scopeIdFor() {
        return scopeIdFrom(organizationContext.getAlfrescoGroupId(), defaultScopeId);
    }

    /**
     * The mapping itself, static so it can be exercised without a container.
     * Everything else on this resource is pass-through; this is the one place
     * that decides what a scope is.
     */
    static String scopeIdFrom(String alfrescoGroupId, String defaultScopeId) {
        if (alfrescoGroupId != null && alfrescoGroupId.startsWith(SITE_GROUP_PREFIX)) {
            String siteId = alfrescoGroupId.substring(SITE_GROUP_PREFIX.length());
            if (!siteId.isBlank()) {
                return siteId;
            }
        }
        return defaultScopeId;
    }

    @GET
    public Uni<Response> list(@PathParam("slug") String slug,
                              @HeaderParam("Authorization") String authorization) {
        return passThrough(
                dashboards.list(tenantIdFor(slug), scopeIdFor(), authorization));
    }

    @GET
    @Path("/{dashboard}")
    public Uni<Response> get(@PathParam("slug") String slug,
                             @PathParam("dashboard") String dashboard,
                             @HeaderParam("Authorization") String authorization) {
        return passThrough(
                dashboards.get(tenantIdFor(slug), scopeIdFor(), dashboard, authorization));
    }

    @PUT
    @Path("/{dashboard}")
    public Uni<Response> save(@PathParam("slug") String slug,
                              @PathParam("dashboard") String dashboard,
                              @HeaderParam("Authorization") String authorization,
                              @HeaderParam("If-Match") String ifMatch,
                              Map<String, Object> body) {
        return passThrough(dashboards.save(
                tenantIdFor(slug), scopeIdFor(), dashboard, authorization, ifMatch, body));
    }

    @DELETE
    @Path("/{dashboard}")
    public Uni<Response> delete(@PathParam("slug") String slug,
                                @PathParam("dashboard") String dashboard,
                                @HeaderParam("Authorization") String authorization) {
        return passThrough(
                dashboards.delete(tenantIdFor(slug), scopeIdFor(), dashboard, authorization));
    }

    @GET
    @Path("/{dashboard}/capabilities")
    public Uni<Response> capabilities(@PathParam("slug") String slug,
                                      @PathParam("dashboard") String dashboard,
                                      @HeaderParam("Authorization") String authorization) {
        return passThrough(
                dashboards.capabilities(tenantIdFor(slug), scopeIdFor(), dashboard, authorization));
    }

    @GET
    @Path("/{dashboard}/permissions")
    public Uni<Response> getPermissions(@PathParam("slug") String slug,
                                        @PathParam("dashboard") String dashboard,
                                        @HeaderParam("Authorization") String authorization) {
        return passThrough(dashboards.getPermissions(
                tenantIdFor(slug), scopeIdFor(), dashboard, authorization));
    }

    @PUT
    @Path("/{dashboard}/permissions")
    public Uni<Response> setPermissions(@PathParam("slug") String slug,
                                        @PathParam("dashboard") String dashboard,
                                        @HeaderParam("Authorization") String authorization,
                                        Map<String, Object> body) {
        return passThrough(dashboards.setPermissions(
                tenantIdFor(slug), scopeIdFor(), dashboard, authorization, body));
    }

    /**
     * Pass the upstream status, body and headers through unchanged. Quarkus
     * REST Reactive throws {@link WebApplicationException} for any non-2xx
     * response; unwrap it so the original status reaches the caller instead of
     * becoming a proxy-side 500 — which matters more here than for a run API,
     * because 401, 403 and 409 are all load-bearing in the dashboard contract:
     * a stale write is a 409 the browser has to see to re-read and retry.
     *
     * <p>{@code Response.fromResponse} also carries response headers through.
     * The dashboard server does not currently set {@code ETag} — the revision
     * travels in the body and comes back as {@code If-Match} — so that costs
     * nothing today and is what keeps this honest if it ever does.
     */
    private static Uni<Response> passThrough(Uni<Response> upstream) {
        return upstream
                .onFailure(WebApplicationException.class)
                .recoverWithItem(DashboardProxyResource::unwrapResponse)
                .map(r -> Response.fromResponse(r).build());
    }

    private static Response unwrapResponse(Throwable err) {
        if (err instanceof WebApplicationException wae) {
            return wae.getResponse();
        }
        throw new IllegalStateException("Expected WebApplicationException from upstream", err);
    }
}
