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
    private static final String SUR = "000000035";

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
        String beto = add("Beto", " conductor ", "000000027", SUR, true);
        String gerente = add("Gerente", "Gerente de Seguridad", null, SUR, true);
        add("Otro conductor", "Conductor", "000000049", "000000050", true);
        add("Inactivo", "Gerente de Seguridad", null, SUR, false);

        TripContactsView view = service.tripContacts(TENANT,
                TripPeople.of("00.000.001-9", "00.000.002-7", "00.000.003-5"));

        assertEquals(List.of("000000019", "000000027"), view.driverRuts());
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
    @Test
    void identifierTypesDistinguishDniDriversAndRucCarriersFromEqualRutText() {
        Contact dni = store.insert(new Contact(null, TENANT, "DNI driver", "Conductor", "+12025550101",
                List.of(CallMethod.PHONE), true, null, "t", null, null, "12345674", "DNI", "Peru", null,
                ContactChannels.NONE, List.of(), null, false, "20100000009", "RUC"));

        TripContactsView view = service.tripContacts(TENANT, TripPeople.of("12345674", null, "20100000009"));
        assertEquals(List.of(dni.id()), view.drivers());
        assertEquals(List.of(dni.id()), view.carrierContacts());
        store.update(new Contact(dni.id(), TENANT, "Other identifier", "Conductor", "+12025550102",
                List.of(CallMethod.PHONE), true, null, "t", null, null, "12345674", "RUT", "Other", null,
                ContactChannels.NONE, List.of(), null, false, "20100000009", "RUT"));
        TripContactsView wrongType = service.tripContacts(TENANT, TripPeople.of("12345674", null, "20100000009"));
        assertEquals(List.of(), wrongType.drivers());
        assertEquals(List.of(), wrongType.carrierContacts());
    }

}
