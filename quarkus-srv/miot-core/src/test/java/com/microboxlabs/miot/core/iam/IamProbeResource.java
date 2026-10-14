package com.microboxlabs.miot.core.iam;

import io.quarkus.security.PermissionsAllowed;
import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

/**
 * Test-only endpoint guarded the way module endpoints are, so the permission check runs end to end. Returns
 * {@link Uni} like every org-scoped endpoint: the org filter needs the event loop.
 */
@Path("/api/v1/orgs/{organizationId}/iam-probe")
@Produces(MediaType.TEXT_PLAIN)
public class IamProbeResource {

    @GET
    @PermissionsAllowed(value = CoreAccessCatalog.MEMBERS_INVITE, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<String> invite(@PathParam("organizationId") String organizationId) {
        return Uni.createFrom().item("ok:" + organizationId);
    }
}
