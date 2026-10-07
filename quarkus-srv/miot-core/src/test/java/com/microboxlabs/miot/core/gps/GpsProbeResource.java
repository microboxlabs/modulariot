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

/** Test-only stand-in for the GPS ingest: a path without an organization that an API key may call. */
@Path("/api/v1/gps-probe")
@Produces(MediaType.TEXT_PLAIN)
public class GpsProbeResource {

    @Inject
    SecurityIdentity identity;

    @Inject
    TenantContext tenant;

    @Inject
    OrganizationContext organization;

    @POST
    public Uni<Response> track() {
        return identity.checkPermission(OrgPermission.of(GpsAccessCatalog.TRACK_WRITE,
                        organization.getOrganizationId()))
                .map(allowed -> Boolean.TRUE.equals(allowed)
                        ? Response.ok(tenant.getClientId()).build()
                        : Response.status(Response.Status.FORBIDDEN).build());
    }
}
