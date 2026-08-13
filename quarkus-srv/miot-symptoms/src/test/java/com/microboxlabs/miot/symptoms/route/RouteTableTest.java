package com.microboxlabs.miot.symptoms.route;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;

class RouteTableTest {

    @Test
    void dedicatedWinsOverCatchAll() {
        RouteTable table = RouteTable.of(List.of(
                route("off-hours", List.of("4"), List.of(), "process_symptoms_off_hours_driving", null),
                route("fwd-n8n", List.of("*"), List.of("4"), null, "http://n8n/webhook")));
        assertEquals("off-hours", table.match(4).orElseThrow().name());
        assertEquals("fwd-n8n", table.match(99).orElseThrow().name());
    }

    @Test
    void missingRuleIdGoesToCatchAllWhenNotExcluded() {
        RouteTable table = RouteTable.of(
                List.of(route("fwd-n8n", List.of("*"), List.of("4"), null, "http://n8n/webhook")));
        assertEquals("fwd-n8n", table.match(-1).orElseThrow().name());
    }

    @Test
    void excludedDedicatedIdIsSkippedWhenNoCatchAll() {
        RouteTable table = RouteTable.of(List.of(
                route("off-hours", List.of("4"), List.of(), "process_symptoms_off_hours_driving", null)));
        assertTrue(table.match(7).isEmpty());
    }

    @Test
    void zeroCatchAllAllowedForCanary() {
        RouteTable table = RouteTable.of(List.of(
                route("off-hours", List.of("4"), List.of(), "process_symptoms_off_hours_driving", null)));
        assertTrue(table.catchAll().isEmpty());
        assertEquals("off-hours", table.match(4).orElseThrow().name());
    }

    @Test
    void rejectsTwoCatchAlls() {
        assertThrows(IllegalArgumentException.class, () -> RouteTable.of(List.of(
                route("a", List.of("*"), List.of(), null, "http://a"),
                route("b", List.of("*"), List.of(), null, "http://b"))));
    }

    @Test
    void rejectsOverlappingDedicatedIds() {
        assertThrows(IllegalArgumentException.class, () -> RouteTable.of(List.of(
                route("a", List.of("4"), List.of(), "fn_a", null),
                route("b", List.of("4"), List.of(), "fn_b", null))));
    }

    @Test
    void catchAllMustExcludeDedicatedIds() {
        assertThrows(IllegalArgumentException.class, () -> RouteTable.of(List.of(
                route("off-hours", List.of("4"), List.of(), "fn", null),
                route("fwd-n8n", List.of("*"), List.of(), null, "http://n8n"))));
    }

    @Test
    void rejectsIllegalFunctionName() {
        assertThrows(IllegalArgumentException.class, () -> route(
                "x", List.of("1"), List.of(), "process_symptoms_off_hours_driving; drop table", null));
    }

    private static SymptomRoute route(
            String name, List<String> targets, List<String> excludes, String fn, String webhook) {
        return new SymptomRoute(name, targets, excludes, fn, webhook, 2, 30);
    }
}
