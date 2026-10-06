package com.microboxlabs.miot.symptoms.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.symptoms.api.OrgSymptomDefinitionsResource.DescribeRequest;
import com.microboxlabs.miot.symptoms.api.OrgSymptomDefinitionsResource.ForkRequest;
import com.microboxlabs.miot.symptoms.api.OrgSymptomDefinitionsResource.FromTemplateRequest;
import com.microboxlabs.miot.symptoms.api.OrgSymptomDefinitionsResource.PublishRequest;
import com.microboxlabs.miot.symptoms.api.OrgSymptomDefinitionsResource.RollbackRequest;
import com.microboxlabs.miot.symptoms.api.OrgSymptomDefinitionsResource.StateRequest;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.service.DataSourceService;
import com.microboxlabs.miot.symptoms.catalog.service.EngineImportService;
import com.microboxlabs.miot.symptoms.catalog.service.InMemoryCatalog;
import com.microboxlabs.miot.symptoms.catalog.service.InMemoryRuleDescriptions;
import com.microboxlabs.miot.symptoms.catalog.service.PreviewService;
import com.microboxlabs.miot.symptoms.catalog.service.RuleDescriptionService;
import com.microboxlabs.miot.symptoms.catalog.service.Specs;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomStatsService;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService.CreateRequest;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService.SymptomSummary;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService.IdentityRequest;
import com.microboxlabs.miot.symptoms.catalog.service.TemplateService;
import com.microboxlabs.miot.symptoms.engine.DemoSymptomEngine;
import com.microboxlabs.miot.symptoms.service.AuditService;
import com.microboxlabs.miot.symptoms.service.TowerSettingsService;
import com.microboxlabs.miot.symptoms.store.InMemoryAuditStore;
import com.microboxlabs.miot.symptoms.store.InMemoryTowerSettingsStore;
import com.microboxlabs.miot.symptoms.store.InMemoryTreatmentStore;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.groups.UniAwait;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.time.Duration;
import java.util.List;
import java.util.Set;
import java.util.function.Supplier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Who may call which endpoint, and that the path's organization must be the session's. */
class OrgSymptomDefinitionsResourceTest {

    private static final String ORG = "org-a";
    private static final Duration WAIT = Duration.ofSeconds(5);

    private SymptomCatalogService catalog;
    private DataSourceService sources;
    private String id;
    private boolean harnessDown;

    /** The role service is not asked: permissions are checked by the annotations (ControlTowerPermissionsTest). */
    private static final class Roles extends OrganizationRoleService {
        Roles(boolean owner) {
            super(null, null, null);
        }
    }

    @BeforeEach
    void setUp() {
        InMemoryCatalog store = new InMemoryCatalog();
        sources = new DataSourceService(store, new DemoSymptomEngine());
        catalog = new SymptomCatalogService(store, sources, new AuditService(new InMemoryAuditStore()));
        id = catalog.create("tenant-a", "owner@example.com", new CreateRequest("speeding", "Exceso", null, null, null,
                "gps_signal", null, Specs.speeding())).definition().id().toString();
    }

    private OrgSymptomDefinitionsResource resource(boolean owner) {
        OrganizationContext org = new OrganizationContext();
        org.setOrganizationId(ORG);
        org.setUserEmail(owner ? "owner@example.com" : "member@example.com");
        TenantContext tenant = new TenantContext();
        tenant.setTenantCode("tenant-a");
        return new OrgSymptomDefinitionsResource(tenant, org, new Roles(owner), null, catalog,
                new PreviewService(catalog, sources), new EngineImportService(new DemoSymptomEngine(), catalog),
                new RuleDescriptionService(new InMemoryRuleDescriptions(), sources, (caller, body) -> {
                    if (harnessDown) {
                        throw new IllegalStateException("down");
                    }
                    return "Se activa <b>en viaje</b>";
                }), new TemplateService(), new SymptomStatsService(catalog, new DemoSymptomEngine(),
                        new InMemoryTreatmentStore(), new TowerSettingsService(new InMemoryTowerSettingsStore(),
                                new AuditService(new InMemoryAuditStore()))));
    }

    private static int status(Uni<Response> call) {
        return call.await().atMost(WAIT).getStatus();
    }

    @Test
    void membersRead() {
        OrgSymptomDefinitionsResource member = resource(false);
        assertEquals(200, status(member.list(ORG)));
        assertEquals(200, status(member.templates(ORG)));
        assertEquals(200, status(member.stats(ORG)));
        assertEquals(200, status(member.get(ORG, id)));
        assertEquals(200, status(member.preview(ORG, id, null)));
        assertEquals(200, status(member.describe(ORG, "Bearer t",
                new DescribeRequest("activation", "signal.trip.active", "gps_signal", null))));
    }

    @Test
    void ownersPublishAndErrorsMapToStatusCodes() {
        OrgSymptomDefinitionsResource owner = resource(true);

        assertEquals(200, status(owner.publish(ORG, id, new PublishRequest("Primera", null, SymptomState.ACTIVE))));
        assertEquals(409, status(owner.publish(ORG, id, new PublishRequest("Otra", null, null))), "no draft left");
        assertEquals(400, status(owner.get(ORG, "not-a-uuid")));
        assertEquals(404, status(owner.get(ORG, "00000000-0000-0000-0000-000000000000")));
        assertEquals(400, status(owner.describe(ORG, null, null)));

        harnessDown = true;
        assertEquals(503, status(owner.describe(ORG, null,
                new DescribeRequest("measure", "signal.gps.speed_kmh", "gps_signal", null))));
    }

    @Test
    void ownersCreateFromATemplate() {
        OrgSymptomDefinitionsResource owner = resource(true);

        assertEquals(201, status(owner.fromTemplate(ORG, new FromTemplateRequest("continuous-driving", null))));
        assertEquals(404, status(owner.fromTemplate(ORG, new FromTemplateRequest("nope", null))));
        assertEquals(400, status(owner.fromTemplate(ORG, new FromTemplateRequest(" ", null))));
    }

    @Test
    @SuppressWarnings("unchecked")
    void theListShowsTheActivationTextOnceItWasWritten() {
        OrgSymptomDefinitionsResource owner = resource(true);
        owner.publish(ORG, id, new PublishRequest("Primera", null, SymptomState.ACTIVE)).await().atMost(WAIT);
        Supplier<SymptomSummary> first = () -> ((List<SymptomSummary>) owner.list(ORG).await().atMost(WAIT)
                .getEntity()).get(0);
        assertNull(first.get().activationText(), "the list never calls the Harness");

        owner.describe(ORG, "Bearer t", new DescribeRequest("activation", Specs.ACTIVATION, "gps_signal", null))
                .await().atMost(WAIT);

        assertEquals("Se activa <b>en viaje</b>", first.get().activationText());
    }

    @Test
    void anotherOrganizationInThePathIsRefused() {
        OrgSymptomDefinitionsResource owner = resource(true);

        WebApplicationException e = assertThrows(WebApplicationException.class, () -> owner.list("org-b"));
        assertEquals(403, e.getResponse().getStatus());
    }
}
