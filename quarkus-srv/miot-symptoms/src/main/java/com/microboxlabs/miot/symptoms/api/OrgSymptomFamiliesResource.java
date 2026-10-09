package com.microboxlabs.miot.symptoms.api;

import io.quarkus.security.PermissionsAllowed;
import com.microboxlabs.miot.symptoms.access.ControlTowerAccessCatalog;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomFamilies;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** The families a symptom can belong to, from Ajustes › Seleccionables › Familias de síntomas. */
@Path("/api/v1/orgs/{organizationId}/control-tower/symptom-families")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "Control Tower — Symptom definitions",
        description = "Symptom rules in CEL, drafts, validation and semantic versions")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class OrgSymptomFamiliesResource extends ControlTowerResourceSupport {

    private final SymptomFamilies families;

    @Inject
    public OrgSymptomFamiliesResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity,
            SymptomFamilies families) {
        super(tenantContext, organizationContext, roleService, identity);
        this.families = families;
    }

    @GET
    @Operation(operationId = "listSymptomFamilies",
            summary = "The organization's symptom families: value and label per language, as in its selectable list;"
                    + " 404 when it has no such list")
    @PermissionsAllowed(value = ControlTowerAccessCatalog.VIEW, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> list(@PathParam("organizationId") String organizationId) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(families.options(tenant)).build());
    }
}
