package com.microboxlabs.miot.symptoms.api;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.fleet.FleetResources;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.symptoms.access.ControlTowerAccessCatalog;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.quarkus.security.PermissionsAllowed;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * The companies a contact can belong to that the organization works with: its own fleet carriers, by name and RUT.
 * Only the organization's carriers, never other organizations'. Needs the contact book's write permission, not
 * fleet access.
 */
@Path("/api/v1/orgs/{organizationId}/control-tower/contact-companies")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "Control Tower — Contacts", description = "People the tower can call about a symptom, with their call history")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class OrgContactCompaniesResource extends ControlTowerResourceSupport {

    private static final int LIMIT = 8;

    public record CompanyView(String name, String rut, String source) {
    }

    private final FleetResources fleet;

    @Inject
    public OrgContactCompaniesResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity,
            FleetResources fleet) {
        super(tenantContext, organizationContext, roleService, identity);
        this.fleet = fleet;
    }

    @GET
    @Operation(operationId = "listContactCompanies",
            summary = "The organization's carriers whose name or RUT contains q, from two characters")
    @PermissionsAllowed(value = ControlTowerAccessCatalog.CONTACT_WRITE, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> list(@PathParam("organizationId") String organizationId, @QueryParam("q") String q) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(companies(tenant, q)).build());
    }

    private List<CompanyView> companies(String tenant, String q) {
        if (q == null || q.trim().length() < 2) {
            return List.of();
        }
        return fleet.carriers(tenant, q, LIMIT).stream()
                .filter(c -> c.legalName() != null && !c.legalName().isBlank())
                .map(c -> new CompanyView(c.legalName().trim(), c.rut(), "carrier"))
                .toList();
    }
}
