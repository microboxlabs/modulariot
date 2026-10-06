package com.microboxlabs.miot.symptoms.catalog.mcp;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.core.auth.OrganizationAccess;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.mcp.McpCaller;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.core.selectable.SelectableOption;
import com.microboxlabs.miot.core.iam.Access;
import com.microboxlabs.miot.core.iam.BaseRole;
import com.microboxlabs.miot.core.iam.AccessRegistry;
import com.microboxlabs.miot.core.iam.AccessRules;
import com.microboxlabs.miot.core.iam.Caller;
import com.microboxlabs.miot.core.iam.CoreAccessCatalog;
import com.microboxlabs.miot.symptoms.access.ControlTowerAccessCatalog;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.domain.VersionBump;
import com.microboxlabs.miot.symptoms.catalog.service.DataSourceService;
import com.microboxlabs.miot.symptoms.catalog.service.InMemoryCatalog;
import com.microboxlabs.miot.symptoms.catalog.service.PreviewService;
import com.microboxlabs.miot.symptoms.catalog.service.SpecValidator.Severity;
import com.microboxlabs.miot.symptoms.catalog.service.Specs;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService.CreateRequest;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomFamilies;
import com.microboxlabs.miot.symptoms.engine.DemoSymptomEngine;
import com.microboxlabs.miot.symptoms.service.AuditService;
import com.microboxlabs.miot.symptoms.store.InMemoryAuditStore;
import io.quarkiverse.mcp.server.ToolCallException;
import io.quarkus.security.runtime.QuarkusSecurityIdentity;
import io.smallrye.jwt.auth.principal.DefaultJWTCallerPrincipal;
import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.core.Response;
import java.lang.reflect.RecordComponent;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.jose4j.jwt.JwtClaims;
import org.junit.jupiter.api.Test;

class SymptomToolsTest {

    private static final String ORG = "acme";
    private static final String TENANT = "tenant-acme";
    private static final String OWNER = "owner@acme.test";
    private static final String MEMBER = "member@acme.test";

    private final InMemoryCatalog store = new InMemoryCatalog();
    private final DataSourceService sources = new DataSourceService(store, new DemoSymptomEngine());
    private final SymptomCatalogService catalog =
            new SymptomCatalogService(store, sources, new AuditService(new InMemoryAuditStore()));
    private final String speeding = catalog.create(TENANT, OWNER, new CreateRequest("speeding",
            "Exceso de velocidad", "driving_safety", "speed", null, "gps_signal", 9, Specs.speeding()))
            .definition().id().toString();

    private SymptomTools toolsFor(String email) {
        JwtClaims claims = new JwtClaims();
        claims.setSubject("auth0|" + email);
        claims.setClaim("email", email);
        QuarkusSecurityIdentity identity = QuarkusSecurityIdentity.builder()
                .setPrincipal(new DefaultJWTCallerPrincipal(claims))
                .build();
        TenantContext tenant = new TenantContext();
        OrganizationContext organization = new OrganizationContext();
        FakeRoles roles = new FakeRoles(organization);
        McpCaller caller = new McpCaller(identity, new FakeAccess(tenant, organization), roles,
                tenant, List.of("azp", "aud"));
        return new SymptomTools(caller, catalog, sources, new PreviewService(catalog, sources),
                new SymptomFamilies(t -> List.of(SelectableOption.of("driving_safety", "Seguridad de conducción",
                        "Driving safety"))));
    }

    private static <T> T await(Uni<T> call) {
        return call.await().indefinitely();
    }

    private static ToolCallException failure(Uni<?> call) {
        var awaiting = call.await();
        return assertThrows(ToolCallException.class, awaiting::indefinitely);
    }

    private static SymptomSpec raisedCodigoNegro() {
        return Specs.withLevels(Specs.speeding(), Specs.levels("medida > 0 && medida < 5",
                "medida >= 5 && medida < 11", "medida >= 11 && medida < 25", "medida >= 25 && sostenido_s >= 60"));
    }

    @Test
    void aMemberReadsTheCatalogAndItsSources() {
        SymptomTools tools = toolsFor(MEMBER);

        SymptomTools.Symptoms list = await(tools.list(ORG));
        assertEquals(1, list.symptoms().size());
        assertTrue(list.symptoms().get(0).hasDraft());
        assertEquals("speeding", await(tools.get(ORG, speeding)).definition().key());

        assertEquals("driving_safety", await(tools.families(ORG)).families().get(0).value());
        SymptomTools.Sources all = await(tools.sources(ORG, null));
        assertNull(all.source());
        assertTrue(all.sources().stream().anyMatch(s -> s.key().equals("gps_signal") && s.fieldCount() > 0));
        SymptomTools.Sources gps = await(tools.sources(ORG, "gps_signal"));
        assertNull(gps.sources());
        assertFalse(gps.source().samples().isEmpty(), "engine samples for the GPS signal");
    }

    @Test
    void aMemberChecksAndPreviewsASpecOrTheDraft() {
        SymptomTools tools = toolsFor(MEMBER);

        assertTrue(await(tools.validate(ORG, speeding, null)).findings().stream()
                .noneMatch(f -> f.severity() == Severity.ERROR), "the draft is valid");
        assertTrue(await(tools.validate(ORG, speeding, Specs.with(Specs.speeding(), "signal.trip.activo")))
                .findings().stream().anyMatch(f -> f.severity() == Severity.ERROR));

        PreviewService.Preview preview = await(tools.preview(ORG, speeding, raisedCodigoNegro()));
        assertEquals("gps_signal", preview.source());
        assertEquals(3, preview.samples().get(0).level(), "22 km/h over is no longer código negro");
    }

    @Test
    void aMemberCannotChangeTheCatalog() {
        SymptomTools tools = toolsFor(MEMBER);

        assertEquals("Permission required: controltower:symptom.edit",
                failure(tools.saveDraft(ORG, speeding, raisedCodigoNegro())).getMessage());
        assertEquals("Permission required: controltower:symptom.publish",
                failure(tools.publish(ORG, speeding, "Primera", null, null)).getMessage());
        assertEquals("Permission required: controltower:symptom.publish",
                failure(tools.setState(ORG, speeding, SymptomState.OFF)).getMessage());
    }

    @Test
    void anOwnerProposesPlansAndPublishesWithAReason() {
        SymptomTools tools = toolsFor(OWNER);
        assertEquals("1.0.0", await(tools.publish(ORG, speeding, "Primera versión", null, SymptomState.ACTIVE))
                .version());

        await(tools.saveDraft(ORG, speeding, raisedCodigoNegro()));
        SymptomCatalogService.PublishPlan plan = await(tools.plan(ORG, speeding));
        assertEquals(VersionBump.MINOR, plan.bump());
        assertEquals("1.1.0", plan.nextVersion());

        assertEquals("reason is required", failure(tools.publish(ORG, speeding, " ", null, null)).getMessage());
        assertEquals("1.1.0", await(tools.publish(ORG, speeding, "Umbral más alto", null, null)).version());
        assertEquals("there is no draft to publish", failure(tools.plan(ORG, speeding)).getMessage());
    }

    @Test
    void anOwnerRollsBackAndChangesTheState() {
        SymptomTools tools = toolsFor(OWNER);
        await(tools.publish(ORG, speeding, "Primera", null, null));
        await(tools.saveDraft(ORG, speeding, raisedCodigoNegro()));
        await(tools.publish(ORG, speeding, "Umbral más alto", null, null));

        var restored = await(tools.rollback(ORG, speeding, "1.0.0", null));
        assertEquals("1.2.0", restored.version());
        assertEquals("1.0.0", restored.rolledBackFrom());
        assertEquals("1.2.0 is already the version in force",
                failure(tools.rollback(ORG, speeding, "1.2.0", "x")).getMessage());

        assertEquals(SymptomState.OFF, await(tools.setState(ORG, speeding, SymptomState.OFF)).state());
    }

    @Test
    void badInputAndOutsidersGetAToolError() {
        SymptomTools owner = toolsFor(OWNER);

        assertEquals("symptomId must be a UUID", failure(owner.get(ORG, "speeding")).getMessage());
        assertTrue(failure(owner.get(ORG, UUID.randomUUID().toString())).getMessage()
                .startsWith("symptom not found"));
        assertEquals("data source not found: nope", failure(owner.sources(ORG, "nope")).getMessage());
        assertEquals("publish a version before turning the symptom on",
                failure(owner.setState(ORG, speeding, SymptomState.ACTIVE)).getMessage());
        assertEquals("User is not a member of organization: other",
                failure(owner.list("other")).getMessage());
        assertEquals("User is not a member of organization: acme",
                failure(toolsFor("intruder@example.test").list(ORG)).getMessage());
    }

    @Test
    void aSpecTheModelSendsAsJsonReadsIntoTheRecord() throws Exception {
        String json = """
                {"source": "gps_signal", "activation": "signal.trip.active",
                 "measure": {"expression": "signal.gps.speed_kmh - signal.road.maxspeed_osm", "unit": "km/h"},
                 "levels": [{"icu": 4, "applies": true, "when": "medida >= 25 && sostenido_s >= 60",
                             "response": {"operator": true, "slaMinutes": 2}}],
                 "lifecycle": {"open": "caso.condicion_s >= 0", "close": "caso.normal_s >= 120"},
                 "somethingElse": 1}
                """;

        SymptomSpec spec = new ObjectMapper().readValue(json, SymptomSpec.class);

        assertEquals(4, spec.levels().get(0).icu());
        assertEquals(2, spec.levels().get(0).response().slaMinutes());
        assertEquals("caso.normal_s >= 120", spec.lifecycle().close());
    }

    @Test
    void theSpecDescriptionNamesEveryField() {
        for (Class<?> type : List.of(SymptomSpec.class, SymptomSpec.Measure.class, SymptomSpec.Level.class,
                SymptomSpec.Response.class, SymptomSpec.Step.class, SymptomSpec.Notice.class,
                SymptomSpec.Lifecycle.class, SymptomSpec.Recurrence.class)) {
            for (RecordComponent c : type.getRecordComponents()) {
                assertTrue(SymptomTools.SPEC.contains(c.getName()), type.getSimpleName() + "." + c.getName());
            }
        }
    }

    static final class FakeAccess extends OrganizationAccess {
        final TenantContext tenant;
        final OrganizationContext organization;

        FakeAccess(TenantContext tenant, OrganizationContext organization) {
            super(tenant, organization, null);
            this.tenant = tenant;
            this.organization = organization;
        }

        @Override
        public Uni<Refusal> enter(String slug, String email, String m2mClientId) {
            if (!ORG.equals(slug) || !Set.of(OWNER, MEMBER).contains(email)) {
                return Uni.createFrom().item(new Refusal(Response.Status.FORBIDDEN,
                        "User is not a member of organization: " + slug));
            }
            tenant.setTenantCode("tenant-" + slug);
            organization.setUserEmail(email);
            return Uni.createFrom().nullItem();
        }
    }

    static final AccessRegistry REGISTRY =
            new AccessRegistry(List.of(new CoreAccessCatalog(), new ControlTowerAccessCatalog()));

    static final class FakeRoles extends OrganizationRoleService {
        final OrganizationContext organization;

        FakeRoles(OrganizationContext organization) {
            super(organization, null, null);
            this.organization = organization;
        }

        /** The real rules: the owner is an Owner; anyone else an Alfresco member with the legacy Operator role. */
        @Override
        public Uni<Access> access(String organizationSlug, Caller caller) {
            AccessRules.Facts facts = new AccessRules.Facts(false, OWNER.equals(caller.email()) ? BaseRole.OWNER : null,
                    true, false, false, Set.of(), null);
            return Uni.createFrom().item(AccessRules.resolve(1L, organizationSlug, caller, facts, REGISTRY));
        }
    }
}
