package com.microboxlabs.miot.symptoms.events;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.event.Participant;
import com.microboxlabs.miot.symptoms.cases.EngineCase;
import com.microboxlabs.miot.symptoms.cases.InMemoryEngineCases;
import com.microboxlabs.miot.symptoms.domain.CallMethod;
import com.microboxlabs.miot.symptoms.domain.Contact;
import com.microboxlabs.miot.symptoms.domain.ContactChannels;
import com.microboxlabs.miot.symptoms.store.InMemoryContactStore;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Who {@code driver} and the other roles are for a symptom case. Placeholder phones only. */
class SymptomParticipantsTest {

    private static final String TENANT = "tenant-1";
    private final InMemoryContactStore contacts = new InMemoryContactStore();
    private final InMemoryEngineCases cases = new InMemoryEngineCases();
    private final List<String> lookups = new ArrayList<>();
    private final SymptomParticipants participants = new SymptomParticipants((tenant, trip, asset) -> {
        lookups.add(tenant + "/" + trip + "/" + asset);
        return "T-1".equals(trip) ? Optional.of(new SymptomParticipants.Driver("Ana", "+56 9 0000 0001"))
                : Optional.empty();
    }, contacts, cases);

    @Test
    void supportsSymptomCasesOnly() {
        assertTrue(participants.supports("symptom_case"));
        assertEquals(false, participants.supports("service"));
    }

    @Test
    void theDriverIsTheDriverOfTheCasesTrip() {
        cases.add(new EngineCase(7, UUID.randomUUID(), "0.1.0", "Botón de pánico", "emergencies", "A-1",
                Instant.parse("2026-10-23T12:00:00Z"), 4, "T-1", null, null, null, null, 0, null, null));

        List<Participant> found = participants.resolve(TENANT, "symptom_case", "-7", "Driver",
                Map.of("tripId", "T-9", "assetId", "A-9"));

        assertEquals(List.of(new Participant("+56900000001", "whatsapp", "Ana", null, "driver")), found);
        assertEquals(List.of("tenant-1/T-1/A-1"), lookups, "the case's trip, not the one in the data");
    }

    @Test
    void theEventDataAloneNamesNoDriver() {
        List<Participant> found = participants.resolve(TENANT, "symptom_case", "-7", "driver",
                Map.of("tripId", "T-1", "assetId", "A-1"));

        assertTrue(found.isEmpty());
        assertTrue(lookups.isEmpty(), "no read of a trip the tenant's case does not name");
    }

    @Test
    void noTripNoDriver() {
        assertTrue(participants.resolve(TENANT, "symptom_case", "-8", "driver", Map.of("assetId", "A-1")).isEmpty());
        assertTrue(lookups.isEmpty());
    }

    @Test
    void otherRolesAreActiveContactsWithThatRole() {
        contacts.insert(contact("Jefa", "Jefe de torre", new ContactChannels(null, "+56900000002", null, null),
                null, true));
        contacts.insert(contact("Luis", "jefe de torre", ContactChannels.NONE, "+56900000003", true));
        contacts.insert(contact("Otra", "jefe de torre", ContactChannels.NONE, "+56900000004", false));
        contacts.insert(contact("Pedro", "Operador", ContactChannels.NONE, "+56900000005", true));

        List<Participant> found = participants.resolve(TENANT, "symptom_case", "-7", "JEFE DE TORRE", Map.of());

        assertEquals(List.of("+56900000002", "+56900000003"), found.stream().map(Participant::address).toList());
        assertEquals("whatsapp", found.get(0).channel());
        assertEquals("Jefa", found.get(0).name());
    }

    @Test
    void theKnownRolesAreDriverAndTheContactsRoles() {
        contacts.insert(contact("Jefa", "Jefe de torre", ContactChannels.NONE, "+56900000002", true));
        contacts.insert(contact("Luis", "jefe de torre", ContactChannels.NONE, "+56900000003", true));

        assertEquals(List.of("driver", "Jefe de torre"), participants.roles(TENANT, "symptom_case"));
    }

    @Test
    void anUnknownRoleIsEmpty() {
        assertTrue(participants.resolve(TENANT, "symptom_case", "-7", "carrier", Map.of()).isEmpty());
    }

    private static Contact contact(String name, String role, ContactChannels channels, String phone, boolean active) {
        return new Contact(null, TENANT, name, role, phone, List.of(CallMethod.PHONE), active, null, "test", null,
                null, null, Contact.DEFAULT_NATIONAL_ID_TYPE, null, null, channels, List.of(), null, false);
    }
}
