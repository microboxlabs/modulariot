package com.microboxlabs.miot.symptoms.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.microboxlabs.miot.core.event.ContactConditions;
import com.microboxlabs.miot.core.event.TextKey;
import com.microboxlabs.miot.symptoms.dto.TripContactsView;
import com.microboxlabs.miot.symptoms.dto.TripPeople;
import com.microboxlabs.miot.symptoms.dto.TripRoute;
import com.microboxlabs.miot.symptoms.store.InMemoryAuditStore;
import com.microboxlabs.miot.symptoms.store.InMemoryContactStore;
import com.microboxlabs.miot.symptoms.store.InMemoryTreatmentStore;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** A case's steps resolved against the book: the trip's RUTs become event.data for each step's condition. */
class TripContactsTest {

    private static final String TENANT = "tenant-a";

    /** Records what it was asked and answers one id per condition. */
    private static final class Recording implements ContactConditions {
        Map<String, Object> data;
        final List<String> asked = new ArrayList<>();

        @Override
        public Optional<String> problem(String condition) {
            return condition.contains("(") ? Optional.of("La condición no es válida") : Optional.empty();
        }

        @Override
        public List<List<String>> match(String tenantCode, List<String> conditions, Map<String, Object> data) {
            this.data = data;
            asked.addAll(conditions);
            return conditions.stream().map(c -> List.of("id-" + c.length())).toList();
        }
    }

    private ContactService service;

    @BeforeEach
    void setUp() {
        var store = new InMemoryContactStore();
        var treatments = new InMemoryTreatmentStore();
        service = new ContactService(store, treatments, new DemoSeeder(false, store, treatments),
                new AuditService(new InMemoryAuditStore()));
    }

    @Test
    void theTripsRutsAreNormalizedIntoEventData() {
        Recording evaluator = new Recording();
        TripContactsView view = service.tripContacts(TENANT,
                TripPeople.of("00.000.001-9", "00.000.002-k", "00.000.003-0"),
                List.of("contact.role == 'Conductor'", "contact.companyRut == event.data.carrierRut"), evaluator);

        assertEquals(Map.of("driverRut", "000000019", "secondDriverRut", "00000002K", "carrierRut", "000000030", "driverIdType", "RUT"),
                view.data());
        assertEquals(view.data(), evaluator.data);
        assertEquals(List.of(List.of("id-27"), List.of("id-43")), view.matches());
        assertEquals(Arrays.asList((String) null, null), view.problems());
    }

    @Test
    void aCaseWithoutATripHasEmptyEventDataAndReportsBadConditions() {
        Recording evaluator = new Recording();
        TripContactsView view = service.tripContacts(TENANT, TripPeople.NONE, List.of("contact.role == ("),
                evaluator);

        assertEquals(Map.of(), view.data());
        assertEquals(List.of("La condición no es válida"), view.problems());
    }

    @Test
    void tooManyConditionsAreRefused() {
        List<String> many = Collections.nCopies(ContactService.MAX_CONDITIONS + 1, "true");
        Recording evaluator = new Recording();
        assertThrows(IllegalArgumentException.class,
                () -> service.tripContacts(TENANT, TripPeople.NONE, many, evaluator));
    }

    @Test
    void tripPeopleDropsBlankAndRepeatedRuts() {
        assertEquals(List.of("1-9"), TripPeople.of(" 1-9 ", "1-9", "  ").driverRuts());
        assertEquals(Map.of("secondDriverRut", "00000002K"),
                ContactService.tripData(TripPeople.of(null, "00.000.002-k", null)));
        assertEquals(Map.of("driverRut", "19", "secondDriverRut", "19", "driverIdType", "RUT", "secondDriverIdType", "RUT"),
                ContactService.tripData(TripPeople.of("1-9", "1-9", null)));
        assertEquals(new TripPeople(List.of(), "76"), TripPeople.of(null, "", "76"));
    }
    @Test
    void tripDataPreservesExpectedIdentifierTypesForLegacyConditions() {
        assertEquals(Map.of("driverRut", "12345674", "driverIdType", "DNI", "carrierRut", "20100000009", "carrierIdType", "RUC"),
                ContactService.tripData(TripPeople.of("12345674", null, "20100000009")));
    }

    @Test
    void tripDataHasTheOriginAndDestinationWithTheirKeysAndGeofences() {
        TripPeople trip = TripPeople.of(null, null, null)
                .withRoute(TripRoute.of("  Planta  Peñón ", 12, "Bodega Sur", null));

        assertEquals(Map.of("origin", "Planta  Peñón", "originKey", "planta penon", "originId", 12,
                "destination", "Bodega Sur", "destinationKey", "bodega sur"), ContactService.tripData(trip));
    }

    @Test
    void tripDataLeavesOutAMissingOrBlankOriginAndDestination() {
        assertEquals(Map.of(), ContactService.tripData(TripPeople.NONE));
        assertEquals(Map.of("destinationId", 7),
                ContactService.tripData(TripPeople.NONE.withRoute(TripRoute.of(" ", null, null, 7))));
        assertEquals(TripRoute.NONE, new TripPeople(List.of(), null, null, null, null).route());
    }

    @Test
    void textKeysIgnoreCaseAccentsAndSpacing() {
        assertEquals("planta norte", TextKey.of("  PLANTA \t Norte "));
        assertEquals("penon", TextKey.of("Peñón"));
        assertEquals("", TextKey.of(null));
    }
}
