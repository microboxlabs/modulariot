package com.microboxlabs.miot.symptoms.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.microboxlabs.miot.symptoms.domain.CallMethod;
import com.microboxlabs.miot.symptoms.domain.Contact;
import com.microboxlabs.miot.symptoms.domain.ContactChannels;
import com.microboxlabs.miot.symptoms.dto.TripContactsView;
import com.microboxlabs.miot.symptoms.dto.TripPeople;
import com.microboxlabs.miot.symptoms.store.InMemoryAuditStore;
import com.microboxlabs.miot.symptoms.store.InMemoryContactStore;
import com.microboxlabs.miot.symptoms.store.InMemoryTreatmentStore;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** The book's people for a trip, found by RUT only. */
class TripContactsTest {

    private static final String TENANT = "tenant-a";
    private static final String SUR = "761112228";

    private InMemoryContactStore store;
    private ContactService service;

    @BeforeEach
    void setUp() {
        store = new InMemoryContactStore();
        var treatments = new InMemoryTreatmentStore();
        service = new ContactService(store, treatments, new DemoSeeder(false, store, treatments),
                new AuditService(new InMemoryAuditStore()));
    }

    private String add(String name, String role, String nationalId, String companyRut, boolean active) {
        return store.insert(new Contact(null, TENANT, name, role, "+56900000101", List.of(CallMethod.PHONE), active,
                null, "t", null, null, nationalId, "RUT", companyRut == null ? null : "Transportes Sur", null,
                ContactChannels.NONE, List.of(), null, false, companyRut)).id();
    }

    @Test
    void findsBothDriversAndTheCarriersPeopleByRut() {
        String ana = add("Ana", "Conductor", "123456785", SUR, true);
        String beto = add("Beto", " conductor ", "98765432K", SUR, true);
        String gerente = add("Gerente", "Gerente de Seguridad", null, SUR, true);
        add("Otro conductor", "Conductor", "111111111", "769999999", true);
        add("Inactivo", "Gerente de Seguridad", null, SUR, false);

        TripContactsView view = service.tripContacts(TENANT,
                TripPeople.of("12.345.678-5", "98.765.432-k", "76.111.222-8"));

        assertEquals(List.of("123456785", "98765432K"), view.driverRuts());
        assertEquals(SUR, view.carrierRut());
        assertEquals(List.of(ana, beto), view.drivers());
        assertEquals(List.of(ana, beto, gerente), view.carrierContacts());
    }

    @Test
    void aTripWithoutRutsOrWithoutMatchesFindsNobody() {
        add("Ana", "Conductor", "123456785", SUR, true);

        TripContactsView none = service.tripContacts(TENANT, TripPeople.NONE);
        assertEquals(List.of(), none.driverRuts());
        assertNull(none.carrierRut());
        assertEquals(List.of(), none.drivers());
        assertEquals(List.of(), none.carrierContacts());

        TripContactsView noMatch = service.tripContacts(TENANT, TripPeople.of("22222222-2", " ", "770000000"));
        assertEquals(List.of("222222222"), noMatch.driverRuts());
        assertEquals(List.of(), noMatch.drivers());
        assertEquals(List.of(), noMatch.carrierContacts());
    }

    @Test
    void tripPeopleDropsBlankAndRepeatedRuts() {
        assertEquals(new TripPeople(List.of("1-9"), null), TripPeople.of(" 1-9 ", "1-9", "  "));
        assertEquals(new TripPeople(List.of(), "76"), TripPeople.of(null, "", "76"));
    }
}
