package com.microboxlabs.miot.symptoms.api;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.symptoms.dto.SymptomFilter;
import com.microboxlabs.miot.symptoms.service.SymptomQueryService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.parameters.Parameter;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** Tenant-scoped reads over the symptoms StreamHub detects for this organization. */
@Path(ControlTowerResourceSupport.BASE_PATH + "/symptoms")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "Control Tower — Symptoms", description = "Symptoms detected for the organization, with ICU severity and treatment state")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class OrgControlTowerSymptomsResource extends ControlTowerResourceSupport {

    private final SymptomQueryService symptoms;

    @Inject
    public OrgControlTowerSymptomsResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity,
            SymptomQueryService symptoms) {
        super(tenantContext, organizationContext, roleService, identity);
        this.symptoms = symptoms;
    }

    @GET
    @Operation(operationId = "listSymptoms", summary = "List symptoms",
            description = "Newest first by first signal. Dates are ISO-8601 with offset and bound the first signal time.")
    public Uni<Response> list(
            @PathParam("organizationId") String organizationId,
            @Parameter(description = "ICU code 1-4") @QueryParam("icuCode") Integer icuCode,
            @QueryParam("assetId") String assetId,
            @QueryParam("tripId") String tripId,
            @QueryParam("symptomName") String symptomName,
            @Parameter(description = "true = still active, false = finished, absent = both") @QueryParam("active") Boolean active,
            @QueryParam("from") String from,
            @QueryParam("to") String to,
            @DefaultValue("1") @QueryParam("page") int page,
            @DefaultValue("50") @QueryParam("pageSize") int pageSize) {
        String tenant = tenantCode(organizationId);
        return memberWork(() -> Response.ok(symptoms.list(
                tenant,
                new SymptomFilter(icuCode, assetId, tripId, symptomName, active, parseDate(from, "from"), parseDate(to, "to")),
                page, pageSize)).build());
    }

    @GET
    @Path("/summary")
    @Operation(operationId = "getSymptomsSummary", summary = "Live counts per ICU bucket",
            description = "Active, non-excluded symptoms grouped as the tower cards show them; a symptom with an open treatment counts as under treatment only.")
    public Uni<Response> summary(@PathParam("organizationId") String organizationId) {
        String tenant = tenantCode(organizationId);
        return memberWork(() -> Response.ok(symptoms.icuSummary(tenant)).build());
    }

    @GET
    @Path("/{symptomId}")
    @Operation(operationId = "getSymptom", summary = "Get one symptom")
    public Uni<Response> get(
            @PathParam("organizationId") String organizationId,
            @PathParam("symptomId") String symptomId) {
        String tenant = tenantCode(organizationId);
        return memberWork(() -> symptoms.get(tenant, parseSymptomId(symptomId))
                .map(s -> Response.ok(s).build())
                .orElseGet(() -> error(Response.Status.NOT_FOUND, "symptom not found")));
    }

    private static OffsetDateTime parseDate(String raw, String name) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return OffsetDateTime.parse(raw);
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException(name + " must be an ISO-8601 date-time with offset");
        }
    }
}
