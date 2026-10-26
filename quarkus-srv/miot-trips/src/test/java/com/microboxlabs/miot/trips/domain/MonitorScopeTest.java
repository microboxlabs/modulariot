package com.microboxlabs.miot.trips.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.trips.domain.MonitorScope.Relation;
import java.util.List;
import java.util.Optional;
import java.util.function.Function;
import org.junit.jupiter.api.Test;

class MonitorScopeTest {

    private static final MonitorScope.Trip EXACTA_TO_ANF = new MonitorScope.Trip("exacta", "direct", "scl", "anf");

    private static MonitorScope feeds(String... v) {
        return new MonitorScope(List.of(v), List.of(), List.of(), List.of());
    }

    private static MonitorScope destinations(String... v) {
        return new MonitorScope(List.of(), List.of(), List.of(), List.of(v));
    }

    @Test
    void everyDimensionMustAcceptTheTripAndAnEmptyOneAcceptsAny() {
        assertTrue(MonitorScope.ANY.accepts(EXACTA_TO_ANF));
        assertTrue(destinations("anf", "cjc").accepts(EXACTA_TO_ANF));
        assertFalse(new MonitorScope(List.of("exacta"), List.of(), List.of(), List.of("cjc")).accepts(EXACTA_TO_ANF));
        assertFalse(feeds("exacta").accepts(new MonitorScope.Trip(null, "direct", "scl", "anf")),
                "a trip without a feed is outside a scope that names feeds");
    }

    @Test
    void scopesAreDisjointNestedOrDuplicates() {
        assertEquals(Relation.DISJOINT, destinations("anf").relationTo(destinations("cjc")));
        assertEquals(Relation.NARROWER, destinations("anf").relationTo(MonitorScope.ANY));
        assertEquals(Relation.BROADER, MonitorScope.ANY.relationTo(destinations("anf")));
        assertEquals(Relation.NARROWER, destinations("anf").relationTo(destinations("anf", "cjc")));
        assertEquals(Relation.DUPLICATE, MonitorScope.ANY.relationTo(MonitorScope.ANY));
        assertEquals(Relation.DUPLICATE, destinations("anf").relationTo(feeds("exacta")),
                "an Exacta trip to ANF would be in both with neither narrower");
        assertEquals(Relation.DUPLICATE, destinations("anf", "cjc").relationTo(destinations("cjc", "ari")));
        assertEquals(Relation.DISJOINT, new MonitorScope(List.of("exacta"), List.of(), List.of(), List.of("anf"))
                .relationTo(new MonitorScope(List.of("mintral"), List.of(), List.of(), List.of("anf"))));
    }

    @Test
    void theNarrowestAcceptingScopeTakesTheTrip() {
        List<MonitorScope> scopes = List.of(MonitorScope.ANY, feeds("exacta"),
                new MonitorScope(List.of("exacta"), List.of(), List.of(), List.of("anf")), destinations("cjc"));
        assertEquals(Optional.of(scopes.get(2)), MonitorScope.narrowest(scopes, Function.identity(), EXACTA_TO_ANF));
        assertEquals(Optional.of(MonitorScope.ANY), MonitorScope.narrowest(scopes, Function.identity(),
                new MonitorScope.Trip(null, null, null, "ari")));
        assertEquals(Optional.empty(), MonitorScope.narrowest(List.of(destinations("anf"), feeds("exacta")),
                Function.identity(), EXACTA_TO_ANF), "two duplicates tie: no monitor");
    }

    @Test
    void valuesAreTrimmedSortedAndDeduplicated() {
        assertEquals(List.of("a", "b"), new MonitorScope(List.of(" b", "a", "b", ""), null, null, null).feeds());
    }
}
