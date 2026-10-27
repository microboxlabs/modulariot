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
                operation(Map.of("type", "object")), OffsetDateTime.now());
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
}
