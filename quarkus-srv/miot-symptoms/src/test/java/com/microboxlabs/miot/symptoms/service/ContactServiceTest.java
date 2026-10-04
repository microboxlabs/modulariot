package com.microboxlabs.miot.symptoms.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.domain.CallMethod;
import com.microboxlabs.miot.symptoms.domain.ContactChannels;
import com.microboxlabs.miot.symptoms.dto.ContactImportResult;
import com.microboxlabs.miot.symptoms.dto.ContactImportResult.Status;
import com.microboxlabs.miot.symptoms.dto.ContactRequest;
import com.microboxlabs.miot.symptoms.dto.ContactView;
import com.microboxlabs.miot.symptoms.store.DuplicateNationalIdException;
import com.microboxlabs.miot.symptoms.store.InMemoryAuditStore;
import com.microboxlabs.miot.symptoms.store.InMemoryContactStore;
import com.microboxlabs.miot.symptoms.store.InMemoryTreatmentStore;
import java.util.List;
import org.junit.jupiter.api.Test;

class ContactServiceTest {

    private static final String TENANT = "tenant-a";

    private static ContactService service(boolean demo) {
        var contacts = new InMemoryContactStore();
        var treatments = new InMemoryTreatmentStore();
        return new ContactService(contacts, treatments, new DemoSeeder(demo, contacts, treatments),
                new AuditService(new InMemoryAuditStore()));
    }

    @Test
    void phoneIsNormalisedToBareE164() {
        assertEquals("+56912345678", ContactService.normalizePhone("+56 9 1234 5678"));
        assertEquals("+56912345678", ContactService.normalizePhone("+56-9-1234-5678"));
        assertNull(ContactService.normalizePhone("  "));
        assertThrows(IllegalArgumentException.class, () -> ContactService.normalizePhone("912345678"));
    }

    @Test
    void createRequiresANameAndUpdateKeepsWhatIsNotSent() {
        var service = service(false);
        ContactRequest blankName = new ContactRequest(" ", null, null, null, null, null);
        assertThrows(IllegalArgumentException.class, () -> service.create(TENANT, "o", blankName));

        ContactView created = service.create(TENANT, "o",
                new ContactRequest(" Camila ", "Jefe", "+56 9 0000 0101", List.of(CallMethod.PHONE), null, null));
        ContactView updated = service.update(TENANT, "o", created.id(),
                new ContactRequest(null, null, null, null, false, null));

        assertEquals("Camila", updated.name());
        assertEquals("Jefe", updated.role());
        assertEquals("+56900000101", updated.phone());
        assertFalse(updated.active());
        assertEquals(1, service.list(TENANT, true).size() + service.list(TENANT, false).size());
    }

    @Test
    void demoSeedGivesEachOrganizationItsOwnList() {
        var service = service(true);
        List<ContactView> a = service.list(TENANT, null);
        List<ContactView> b = service.list("tenant-b", null);

        assertEquals(4, a.size());
        assertEquals(4, b.size());
        assertTrue(a.stream().noneMatch(x -> b.stream().anyMatch(y -> y.id().equals(x.id()))));
        assertTrue(service.delete(TENANT, "o", a.get(0).id()));
        assertEquals(3, service.list(TENANT, null).size(), "a deleted demo contact is not reseeded");
    }

    @Test
    void nationalIdIsNormalisedAndRutIsChecked() {
        assertEquals("111111111", ContactService.normalizeNationalId(" 11.111.111-1 "));
        assertEquals("12345678K", ContactService.normalizeNationalId("12.345.678-k"));
        assertNull(ContactService.normalizeNationalId(" "));
        assertTrue(ContactService.isValidRut("111111111"));
        assertTrue(ContactService.isValidRut("222222222"));
        assertFalse(ContactService.isValidRut("111111112"));
        assertFalse(ContactService.isValidRut("ABC"));
        assertEquals("AB12", ContactService.nationalId("ab-12", "PASSPORT"), "other id types are only normalised");
    }

    @Test
    void duplicateNationalIdInAnotherFormatIsRefused() {
        var service = service(false);
        ContactView first = service.create(TENANT, "o", book("Persona Uno", "11.111.111-1"));
        assertEquals("111111111", first.nationalId());
        assertEquals("RUT", first.nationalIdType());

        for (String sameId : List.of("111111111", "11111111-1", "11.111.111-1")) {
            ContactRequest again = book("Persona Dos", sameId);
            DuplicateNationalIdException e = assertThrows(DuplicateNationalIdException.class,
                    () -> service.create(TENANT, "o", again));
            assertTrue(e.getMessage().contains("already exists"));
        }
        ContactView second = service.create(TENANT, "o", book("Persona Dos", "22.222.222-2"));
        ContactRequest clash = new ContactRequest(null, null, null, null, null, null, "11111111-1", null, null, null,
                null, null, null, null);
        String secondId = second.id();
        assertThrows(DuplicateNationalIdException.class, () -> service.update(TENANT, "o", secondId, clash));
        assertEquals("111111111", service.create("tenant-b", "o", book("Persona Uno", "111111111")).nationalId(),
                "another organization may have the same person");
        ContactRequest badRut = book("Mal", "11.111.111-2");
        assertThrows(IllegalArgumentException.class, () -> service.create(TENANT, "o", badRut));
    }

    @Test
    void contactBookFieldsAreSavedAndPhoneAndMethodsFollowTheChannels() {
        var service = service(false);
        ContactRequest req = new ContactRequest("Persona Tres", null, null, null, null, "Descripción", "33.333.333-3",
                null, "Empresa Ejemplo", "Supervisor",
                new ContactChannels(null, "+56 9 0000 0131", "persona@example.com", " "),
                List.of("transporte", " Transporte ", "", "turno"), "member-3", true);

        ContactView created = service.create(TENANT, "o", req);
        assertEquals("+56900000131", created.phone(), "the WhatsApp number when there is no phone");
        assertEquals(List.of(CallMethod.WHATSAPP, CallMethod.MEET), created.methods());
        assertEquals(new ContactChannels(null, "+56900000131", "persona@example.com", null), created.channels());
        assertEquals(List.of("transporte", "turno"), created.tags());
        assertEquals("Empresa Ejemplo", created.company());
        assertEquals("member-3", created.memberUserId());
        assertTrue(created.provisional());

        ContactView completed = service.update(TENANT, "o", created.id(), new ContactRequest(null, null, null, null,
                null, null, null, null, "", null, null, null, null, false));
        assertFalse(completed.provisional());
        assertNull(completed.company(), "an empty string clears the field");
        assertEquals("333333333", completed.nationalId(), "fields not sent stay");
        assertEquals(List.of("transporte", "turno"), completed.tags());
    }

    @Test
    void importCreatesSkipsAndReportsEachRow() {
        var service = service(false);
        service.create(TENANT, "o", book("Ya existe", "11.111.111-1"));

        ContactImportResult result = service.importContacts(TENANT, "o", List.of(
                book("Persona Nueva", "22.222.222-2"),
                book("Mismo RUT", "111111111"),
                book("Repetida", "22222222-2"),
                book(" ", null),
                new ContactRequest("Teléfono malo", null, "123", null, null, null),
                book("Sin RUT", null)));

        assertEquals(2, result.created());
        assertEquals(2, result.skipped());
        assertEquals(2, result.errors());
        assertEquals(List.of(Status.CREATED, Status.SKIPPED, Status.SKIPPED, Status.ERROR, Status.ERROR,
                Status.CREATED), result.rows().stream().map(ContactImportResult.Row::status).toList());
        assertEquals(List.of(0, 1, 2, 3, 4, 5), result.rows().stream().map(ContactImportResult.Row::index).toList());
        assertEquals("Persona Nueva", result.rows().get(0).contact().name());
        assertTrue(result.rows().get(1).reason().contains("already exists"));
        assertTrue(result.rows().get(2).reason().contains("repeated"));
        assertEquals("name is required", result.rows().get(3).reason());
        assertTrue(result.rows().get(4).reason().contains("phone"));
        assertEquals(3, service.list(TENANT, null).size());

        assertThrows(IllegalArgumentException.class, () -> service.importContacts(TENANT, "o", List.of()));
        assertThrows(IllegalArgumentException.class, () -> service.importContacts(TENANT, "o", null));
    }

    private static ContactRequest book(String name, String nationalId) {
        return new ContactRequest(name, null, null, null, null, null, nationalId, null, null, null, null, null, null,
                null);
    }
}
