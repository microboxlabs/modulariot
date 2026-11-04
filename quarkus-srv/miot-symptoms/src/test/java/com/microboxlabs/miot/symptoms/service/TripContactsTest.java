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
    private static final String SUR = "000000030";

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
        return store.insert(new Contact(null, TENANT, name, role, "+12025550101", List.of(CallMethod.PHONE), active,
                null, "t", null, null, nationalId, "RUT", companyRut == null ? null : "Transportes Sur", null,
                ContactChannels.NONE, List.of(), null, false, companyRut)).id();
    }

    @Test
    void findsBothDriversAndTheCarriersPeopleByRut() {
        String ana = add("Ana", "Conductor", "000000019", SUR, true);
        String beto = add("Beto", " conductor ", "00000002K", SUR, true);
        String gerente = add("Gerente", "Gerente de Seguridad", null, SUR, true);
        add("Otro conductor", "Conductor", "000000049", "000000050", true);
        add("Inactivo", "Gerente de Seguridad", null, SUR, false);

        TripContactsView view = service.tripContacts(TENANT,
                TripPeople.of("00.000.001-9", "00.000.002-k", "00.000.003-0"));

        assertEquals(List.of("000000019", "00000002K"), view.driverRuts());
        assertEquals(SUR, view.carrierRut());
        assertEquals(List.of(ana, beto), view.drivers());
        assertEquals(List.of(ana, beto, gerente), view.carrierContacts());
    }

    @Test
    void aTripWithoutRutsOrWithoutMatchesFindsNobody() {
        add("Ana", "Conductor", "000000019", SUR, true);

        TripContactsView none = service.tripContacts(TENANT, TripPeople.NONE);
        assertEquals(List.of(), none.driverRuts());
        assertNull(none.carrierRut());
        assertEquals(List.of(), none.drivers());
        assertEquals(List.of(), none.carrierContacts());

        TripContactsView noMatch = service.tripContacts(TENANT, TripPeople.of("00000006-0", " ", "000000070"));
        assertEquals(List.of("000000060"), noMatch.driverRuts());
        assertEquals(List.of(), noMatch.drivers());
        assertEquals(List.of(), noMatch.carrierContacts());
    }

    @Test
    void tripPeopleDropsBlankAndRepeatedRuts() {
        assertEquals(new TripPeople(List.of("1-9"), null), TripPeople.of(" 1-9 ", "1-9", "  "));
        assertEquals(new TripPeople(List.of(), "76"), TripPeople.of(null, "", "76"));
    }
}
