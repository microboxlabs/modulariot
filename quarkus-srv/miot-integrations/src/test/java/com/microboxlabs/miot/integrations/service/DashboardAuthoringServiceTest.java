package com.microboxlabs.miot.integrations.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.domain.IntegrationOperation;
import com.microboxlabs.miot.integrations.persistence.IntegrationOperationRepository;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class DashboardAuthoringServiceTest {
    private final DashboardAuthoringService service =
            new DashboardAuthoringService(null, null, null, null, 1_000_000_000L);

    private static DashboardAuthoringService.Content content() {
        return new DashboardAuthoringService.Content("Daily trips", "Trips per day", "analytics-prod", "US",
                "SELECT day, trips FROM `fleet.daily` WHERE day >= @since", 100_000_000L,
                List.of(new DashboardAuthoringService.Parameter("since", "DATE", "2026-10-01")),
                List.of(new DashboardAuthoringService.Column("day", "DATE", "NULLABLE")));
    }

    private static IntegrationOperation operation(Map<String, Object> schema) {
        return new IntegrationOperation("6f1c3a52-6a37-4a1e-9b5e-3f0e8d1d6c11", "c", "Daily trips", "POST",
                DashboardAuthoringService.OPERATION_PATH, schema, Map.of(), false);
    }

    @Test
    void savesAQueryDashboardsCanRun() {
        Map<String, Object> schema = service.requestSchema(content(), "ana");
        IntegrationOperation saved = operation(schema);
        assertTrue(DashboardOperationPolicy.eligible(saved));
        var plan = DashboardOperationPolicy.prepare(saved, "tenant", Map.of("since", "2026-10-01"));
        var checked = new BigQueryDashboardPlan(plan, 1_000_000_000L);
        assertEquals("analytics-prod", checked.project);
        assertEquals(100_000_000L, checked.maximumBytesBilled);
    }

    @Test
    void readsBackWhatWasSaved() {
        OffsetDateTime at = OffsetDateTime.parse("2026-10-27T12:00:00.123456Z");
        var plan = DashboardAuthoringService.toPlan("c",
                new IntegrationOperationRepository.Versioned(operation(service.requestSchema(content(), "ana")), at));
        assertEquals("Daily trips", plan.name());
        assertEquals("Trips per day", plan.description());
        assertEquals("SELECT day, trips FROM `fleet.daily` WHERE day >= @since", plan.sql());
        assertEquals(List.of(new DashboardAuthoringService.Parameter("since", "DATE", "2026-10-01")),
                plan.parameters());
        assertEquals(List.of(new DashboardAuthoringService.Column("day", "DATE", "NULLABLE")), plan.columns());
        assertEquals("1793102400123456", plan.revision());
        assertEquals("ana", plan.updatedBy());
    }

    @Test
    void leavesOutOperationsThatAreNotBigQueryQueries() {
        var other = new IntegrationOperationRepository.Versioned(
                operation(Map.of("type", "object")), OffsetDateTime.parse("2026-01-01T00:00:00Z"));
        assertNull(DashboardAuthoringService.toPlan("c", other));
    }

    @Test
    void refusesAnInvalidQuery() {
        var base = content();
        assertThrows(IllegalArgumentException.class, () -> service.requestSchema(
                new DashboardAuthoringService.Content(" ", null, base.projectId(), base.location(), base.sql(),
                        base.maximumBytesBilled(), base.parameters(), null), "ana"));
        assertThrows(IllegalArgumentException.class, () -> service.requestSchema(
                new DashboardAuthoringService.Content(base.name(), null, base.projectId(), base.location(), base.sql(),
                        2_000_000_000L, base.parameters(), null), "ana"));
        assertThrows(IllegalArgumentException.class, () -> service.requestSchema(
                new DashboardAuthoringService.Content(base.name(), null, base.projectId(), base.location(), base.sql(),
                        base.maximumBytesBilled(),
                        List.of(new DashboardAuthoringService.Parameter("x", "GEOGRAPHY", null)), null), "ana"));
    }
    @Test
    void preservesSqlCoordinatesWhenSavingAndReading() {
        var base = content();
        String sql = "\n\n  SELECT 1\n";
        var input = new DashboardAuthoringService.Content(base.name(), null, base.projectId(), base.location(), sql,
                base.maximumBytesBilled(), List.of(), List.of());
        var saved = operation(service.requestSchema(input, "demo-author"));
        var plan = DashboardAuthoringService.toPlan("demo-source", new IntegrationOperationRepository.Versioned(saved, OffsetDateTime.parse("2026-01-01T00:00:00Z")));
        assertEquals(sql, plan.sql());
    }

    @Test
    void savedNumericsRetainExactStringValuesAndAbsentParametersBindNull() {
        var base = content();
        for (String type : List.of("INT64", "NUMERIC", "BIGNUMERIC")) {
            var input = new DashboardAuthoringService.Content(base.name(), null, base.projectId(), base.location(),
                    "SELECT @value", base.maximumBytesBilled(), List.of(new DashboardAuthoringService.Parameter("value", type, null)), null);
            var saved = operation(service.requestSchema(input, "demo-author"));
            String exact = type.equals("INT64") ? "9007199254740993" : "12345678901234567890.123456789";
            var checked = new BigQueryDashboardPlan(DashboardOperationPolicy.prepare(saved, "demo-tenant", Map.of("value", exact)), 1_000_000_000L);
            assertEquals(exact, checked.query.path("queryParameters").get(0).path("parameterValue").path("value").asText());
            var missing = new BigQueryDashboardPlan(DashboardOperationPolicy.prepare(saved, "demo-tenant", java.util.Collections.singletonMap("value", null)), 1_000_000_000L);
            assertTrue(missing.query.path("queryParameters").get(0).path("parameterValue").path("value").isNull());
        }
    }

    @Test
    void rejectsReservedNamesAndOversizedDashboardSchemasAtSaveTime() {
        var base = content();
        for (String name : List.of("pattern", "patternProperties")) {
            var input = new DashboardAuthoringService.Content(base.name(), null, base.projectId(), base.location(),
                    "SELECT @" + name, base.maximumBytesBilled(), List.of(new DashboardAuthoringService.Parameter(name, "STRING", null)), null);
            assertThrows(IllegalArgumentException.class, () -> service.requestSchema(input, "demo-author"));
        }
        var oversized = new DashboardAuthoringService.Content(base.name(), null, base.projectId(), base.location(),
                "SELECT '" + "界".repeat(30_000) + "'", base.maximumBytesBilled(), List.of(), null);
        assertThrows(IllegalArgumentException.class, () -> service.requestSchema(oversized, "demo-author"));
    }

    @Test
    void duplicateNameRacesReturnConflictsWithoutHidingOtherDatabaseErrors() {
        String sourceId = "67548594-b798-418e-a23d-923899f7a9d9";
        var connections = new com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository(null) {
            @Override public com.microboxlabs.miot.integrations.domain.IntegrationConnection findByTenantAndId(String tenant, String id) {
                return new com.microboxlabs.miot.integrations.domain.IntegrationConnection(id, tenant, "Demo source",
                        com.microboxlabs.miot.integrations.domain.ProviderType.CUSTOM_HTTP, java.net.URI.create(BigQueryProbe.BASE_URL), null,
                        com.microboxlabs.miot.integrations.domain.ConnectionStatus.ACTIVE, null, null, Map.of());
            }
        };
        class Operations extends IntegrationOperationRepository {
            io.vertx.pgclient.PgException failure = new io.vertx.pgclient.PgException("demo duplicate", "ERROR", "23505", "demo") {
                @Override public String getConstraint() { return "idx_integration_operations_connection_name_active"; }
            };
            Operations() { super(null); }
            @Override public IntegrationOperation findByConnectionAndName(String connection, String name) { return null; }
            @Override public Versioned findVersioned(String connection, String id) {
                return new Versioned(operation(service.requestSchema(content(), "demo-author")), OffsetDateTime.parse("2026-01-01T00:00:00Z"));
            }
            @Override public IntegrationOperation create(IntegrationOperation operation) { throw failure; }
            @Override public Versioned updateIfUnchanged(String connection, String id, String name, Map<String, Object> schema, OffsetDateTime expected) { throw failure; }
        }
        var operations = new Operations();
        var authoring = new DashboardAuthoringService(connections, null, operations, null, 1_000_000_000L);
        assertThrows(DashboardAuthoringService.ConflictException.class, () -> authoring.create("demo-tenant", sourceId, content(), "demo-author"));
        assertThrows(DashboardAuthoringService.ConflictException.class, () -> authoring.update("demo-tenant", sourceId, "demo-plan", content(), "1767225600000000", "demo-author"));
        operations.failure = new io.vertx.pgclient.PgException("demo database failure", "ERROR", "08006", "demo");
        org.junit.jupiter.api.Assertions.assertSame(operations.failure, assertThrows(io.vertx.pgclient.PgException.class,
                () -> authoring.create("demo-tenant", sourceId, content(), "demo-author")));
    }

    @Test
    void excludesTenantBoundAndArrayOperationsThatAuthoringCannotPreserve() {
        var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        var schema = mapper.valueToTree(service.requestSchema(content(), "demo-author"));
        var dashboard = (com.fasterxml.jackson.databind.node.ObjectNode) schema.path("x-dashboard");
        dashboard.remove("credentialScoped");
        dashboard.put("tenantParameter", "tenant");
        var timestamp = OffsetDateTime.parse("2026-01-01T00:00:00Z");
        assertNull(DashboardAuthoringService.toPlan("demo-source", new IntegrationOperationRepository.Versioned(operation(mapper.convertValue(schema, Map.class)), timestamp)));
        dashboard.remove("tenantParameter");
        dashboard.put("credentialScoped", true);
        ((com.fasterxml.jackson.databind.node.ObjectNode) dashboard.path("parameterTypes")).put("since", "ARRAY<DATE>");
        assertNull(DashboardAuthoringService.toPlan("demo-source", new IntegrationOperationRepository.Versioned(operation(mapper.convertValue(schema, Map.class)), timestamp)));
    }

}
