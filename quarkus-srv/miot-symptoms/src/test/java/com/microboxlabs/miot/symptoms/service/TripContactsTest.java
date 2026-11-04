package com.microboxlabs.miot.symptoms.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.microboxlabs.miot.core.event.ContactConditions;
import com.microboxlabs.miot.symptoms.dto.TripContactsView;
import com.microboxlabs.miot.symptoms.dto.TripPeople;
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
                TripPeople.of("12.345.678-5", "98.765.432-k", "76.111.222-8"),
                List.of("contact.role == 'Conductor'", "contact.companyRut == event.data.carrierRut"), evaluator);

        assertEquals(Map.of("driverRut", "123456785", "secondDriverRut", "98765432K", "carrierRut", "761112228"),
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
        assertThrows(IllegalArgumentException.class,
                () -> service.tripContacts(TENANT, TripPeople.NONE, many, new Recording()));
    }

    @Test
    void tripPeopleDropsBlankAndRepeatedRuts() {
        assertEquals(new TripPeople(List.of("1-9"), null), TripPeople.of(" 1-9 ", "1-9", "  "));
        assertEquals(new TripPeople(List.of(), "76"), TripPeople.of(null, "", "76"));
    }
}
