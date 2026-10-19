package com.microboxlabs.miot.core.gps;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.iam.OrgPermission;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

/**
 * Test-only stand-ins: {@code probe} for the GPS ingest, a listed path without an organization, and
 * {@code other} for any other.
 */
@Path("/api/v1/gps-test")
@Produces(MediaType.TEXT_PLAIN)
public class GpsProbeResource {

    @Inject
    SecurityIdentity identity;

    @Inject
    TenantContext tenant;

    @Inject
    OrganizationContext organization;

    @POST
    @Path("/probe")
    public Uni<Response> track() {
        return identity.checkPermission(OrgPermission.of(GpsAccessCatalog.TRACK_WRITE,
                        organization.getOrganizationId()))
                .map(allowed -> Boolean.TRUE.equals(allowed)
                        ? Response.ok(tenant.getClientId()).build()
                        : Response.status(Response.Status.FORBIDDEN).build());
    }

    /** A path that is not on the list: an API key gets no tenant here. */
    @POST
    @Path("/other")
    public Uni<String> unlisted() {
        return Uni.createFrom().item(String.valueOf(tenant.getClientId()));
    }
}
