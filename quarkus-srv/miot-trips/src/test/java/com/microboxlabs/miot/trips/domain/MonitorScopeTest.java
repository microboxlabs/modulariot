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

    private static final MonitorScope.Trip FEED_A_TO_DESTINATION_A = new MonitorScope.Trip("feed-a", "direct", "origin-a", "destination-a");

    private static MonitorScope feeds(String... v) {
        return new MonitorScope(List.of(v), List.of(), List.of(), List.of());
    }

    private static MonitorScope destinations(String... v) {
        return new MonitorScope(List.of(), List.of(), List.of(), List.of(v));
    }

    @Test
    void everyDimensionMustAcceptTheTripAndAnEmptyOneAcceptsAny() {
        assertTrue(MonitorScope.ANY.accepts(FEED_A_TO_DESTINATION_A));
        assertTrue(destinations("destination-a", "destination-b").accepts(FEED_A_TO_DESTINATION_A));
        assertFalse(new MonitorScope(List.of("feed-a"), List.of(), List.of(), List.of("destination-b")).accepts(FEED_A_TO_DESTINATION_A));
        assertFalse(feeds("feed-a").accepts(new MonitorScope.Trip(null, "direct", "origin-a", "destination-a")),
                "a trip without a feed is outside a scope that names feeds");
    }

    @Test
    void scopesAreDisjointNestedOrDuplicates() {
        assertEquals(Relation.DISJOINT, destinations("destination-a").relationTo(destinations("destination-b")));
        assertEquals(Relation.NARROWER, destinations("destination-a").relationTo(MonitorScope.ANY));
        assertEquals(Relation.BROADER, MonitorScope.ANY.relationTo(destinations("destination-a")));
        assertEquals(Relation.NARROWER, destinations("destination-a").relationTo(destinations("destination-a", "destination-b")));
        assertEquals(Relation.DUPLICATE, MonitorScope.ANY.relationTo(MonitorScope.ANY));
        assertEquals(Relation.DUPLICATE, destinations("destination-a").relationTo(feeds("feed-a")),
                "an feed-a trip to destination-a would be in both with neither narrower");
        assertEquals(Relation.DUPLICATE, destinations("destination-a", "destination-b").relationTo(destinations("destination-b", "destination-c")));
        assertEquals(Relation.DISJOINT, new MonitorScope(List.of("feed-a"), List.of(), List.of(), List.of("destination-a"))
                .relationTo(new MonitorScope(List.of("feed-b"), List.of(), List.of(), List.of("destination-a"))));
    }

    @Test
    void theNarrowestAcceptingScopeTakesTheTrip() {
        List<MonitorScope> scopes = List.of(MonitorScope.ANY, feeds("feed-a"),
                new MonitorScope(List.of("feed-a"), List.of(), List.of(), List.of("destination-a")), destinations("destination-b"));
        assertEquals(Optional.of(scopes.get(2)), MonitorScope.narrowest(scopes, Function.identity(), FEED_A_TO_DESTINATION_A));
        assertEquals(Optional.of(MonitorScope.ANY), MonitorScope.narrowest(scopes, Function.identity(),
                new MonitorScope.Trip(null, null, null, "destination-c")));
        assertEquals(Optional.empty(), MonitorScope.narrowest(List.of(destinations("destination-a"), feeds("feed-a")),
                Function.identity(), FEED_A_TO_DESTINATION_A), "two duplicates tie: no monitor");
    }

    @Test
    void valuesAreTrimmedSortedAndDeduplicated() {
        assertEquals(List.of("a", "b"), new MonitorScope(List.of(" b", "a", "b", ""), null, null, null).feeds());
    }
}
