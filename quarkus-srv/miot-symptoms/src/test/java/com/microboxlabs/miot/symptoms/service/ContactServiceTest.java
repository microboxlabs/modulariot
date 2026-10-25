package com.microboxlabs.miot.symptoms.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.domain.CallMethod;
import com.microboxlabs.miot.symptoms.domain.ContactChannels;
import com.microboxlabs.miot.symptoms.domain.ContactFacets;
import com.microboxlabs.miot.symptoms.domain.ContactFilter;
import com.microboxlabs.miot.symptoms.dto.ContactImportResult;
import com.microboxlabs.miot.symptoms.dto.ContactPage;
import com.microboxlabs.miot.symptoms.dto.ContactImportResult.Status;
import com.microboxlabs.miot.symptoms.dto.ContactRequest;
import com.microboxlabs.miot.symptoms.dto.ContactView;
import com.microboxlabs.miot.symptoms.store.DuplicateMemberException;
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
    void theEmailAndTheCompanysRutAreNormalisedAndChecked() {
        var service = service(false);
        ContactView created = service.create(TENANT, "o", new ContactRequest("Despacho", null, null, null, null, null,
                null, null, "Transportes Sur", null, new ContactChannels(null, null, null, null, " Despacho@Example.com "),
                null, null, null, "76.111.222-8"));
        assertEquals("despacho@example.com", created.channels().email());
        assertEquals("761112228", created.companyRut());

        ContactView cleared = service.update(TENANT, "o", created.id(), new ContactRequest(null, null, null, null,
                null, null, null, null, null, null, null, null, null, null, ""));
        assertNull(cleared.companyRut());
        assertEquals("despacho@example.com", cleared.channels().email(), "channels not sent stay");

        ContactRequest badCompanyRut = new ContactRequest("X", null, null, null, null, null, null, null, null, null,
                null, null, null, null, "76.111.222-3");
        ContactRequest badEmail = new ContactRequest("Y", null, null, null, null, null, null, null, null, null,
                new ContactChannels(null, null, null, null, "no-at"), null, null, null, null);
        assertThrows(IllegalArgumentException.class, () -> service.create(TENANT, "o", badCompanyRut));
        assertThrows(IllegalArgumentException.class, () -> service.create(TENANT, "o", badEmail));
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

    @Test
    void aPeruvianCompanyHasARucAndAPersonADni() {
        var service = service(false);
        ContactRequest peru = new ContactRequest("Persona Perú", null, null, null, null, null, "12345678", "DNI",
                "Transportes Lima", null, null, null, null, null, "20100070970", "ruc");
        ContactView saved = service.create(TENANT, "o", peru);
        assertEquals("12345678", saved.nationalId());
        assertEquals("20100070970", saved.companyRut());
        assertEquals("RUC", saved.companyTaxIdType());

        ContactRequest badRuc = new ContactRequest("Mal", null, null, null, null, null, null, null, null, null, null,
                null, null, null, "20100070971", "RUC");
        assertThrows(IllegalArgumentException.class, () -> service.create(TENANT, "o", badRuc));
        ContactRequest badDni = new ContactRequest("Mal", null, null, null, null, null, "1234567", "DNI", null, null,
                null, null, null, null, null, null);
        assertThrows(IllegalArgumentException.class, () -> service.create(TENANT, "o", badDni));
        ContactRequest unknownType = new ContactRequest("Mal", null, null, null, null, null, null, null, null, null,
                null, null, null, null, "123", "NIT");
        assertThrows(IllegalArgumentException.class, () -> service.create(TENANT, "o", unknownType));

        String id = saved.id();
        ContactView chilean = service.update(TENANT, "o", id, new ContactRequest(null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, "76.111.222-8", "RUT"));
        assertEquals("761112228", chilean.companyRut());
        assertEquals("RUT", chilean.companyTaxIdType());
        ContactView other = service.update(TENANT, "o", id, new ContactRequest(null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, "ab-123", "OTRO"));
        assertEquals("AB123", other.companyRut());
        assertTrue(ContactService.isValidRuc("20100070970"));
        assertFalse(ContactService.isValidRuc("30100070970"));
    }

    @Test
    void aMemberIsInTheBookOnce() {
        var service = service(false);
        service.create(TENANT, "o", member("Persona Uno", "user-1"));
        ContactRequest again = member("Persona Uno", "user-1");
        assertThrows(DuplicateMemberException.class, () -> service.create(TENANT, "o", again));

        ContactView other = service.create(TENANT, "o", member("Persona Dos", "user-2"));
        String otherId = other.id();
        ContactRequest clash = member("Persona Dos", "user-1");
        assertThrows(DuplicateMemberException.class, () -> service.update(TENANT, "o", otherId, clash));
        assertEquals("Persona Dos", service.update(TENANT, "o", otherId, member("Persona Dos", "user-2")).name(),
                "saving the same member again is not a duplicate");
        assertEquals("Persona Uno", service.create("tenant-b", "o", member("Persona Uno", "user-1")).name(),
                "another organization may have the same member");
    }

    @Test
    void theBookComesInPagesThatFollowEachOther() {
        var service = service(false);
        for (String name : List.of("Persona Uno", "Persona Dos", "Persona Tres")) {
            service.create(TENANT, "o", new ContactRequest(name, null, null, null, null, null));
        }

        ContactPage first = service.page(TENANT, ContactFilter.ALL, null, 2);
        assertEquals(List.of("Persona Uno", "Persona Dos"), first.items().stream().map(ContactView::name).toList());
        ContactPage last = service.page(TENANT, ContactFilter.ALL, first.next(), 2);
        assertEquals(List.of("Persona Tres"), last.items().stream().map(ContactView::name).toList());
        assertNull(last.next());
        assertThrows(IllegalArgumentException.class, () -> service.page(TENANT, ContactFilter.ALL, "nope", 2));
        assertThrows(IllegalArgumentException.class, () -> service.page(TENANT, ContactFilter.ALL, null, 500));
    }

    @Test
    void aPageKeepsOnlyTheContactsThatPassTheFilter() {
        var service = service(false);
        service.create(TENANT, "o", new ContactRequest("Persona Uno", "Supervisor", null, null, null, null, null,
                null, "Empresa Ejemplo", null, null, List.of("Turno"), "user-1", null));
        service.create(TENANT, "o", new ContactRequest("Persona Dos", "Chofer", null, null, null, null, null,
                null, "Otra Empresa", null, null, List.of("turno"), null, null));

        assertEquals(List.of("Persona Uno"), names(service, new ContactFilter(null, true, null, null, null, null)));
        assertEquals(List.of("Persona Dos"), names(service, new ContactFilter(null, false, null, null, null, null)));
        assertEquals(List.of("Persona Uno"),
                names(service, new ContactFilter(null, null, "supervisor", null, null, null)));
        assertEquals(List.of("Persona Dos"),
                names(service, new ContactFilter(null, null, null, "otra empresa", null, null)));
        assertEquals(2, names(service, new ContactFilter(null, null, null, null, "TURNO", null)).size());
        assertEquals(List.of("Persona Dos"), names(service, new ContactFilter("dos", null, null, null, null, null)));
    }

    @Test
    void theFacetsListEachRoleCompanyAndTagOnce() {
        var service = service(false);
        service.create(TENANT, "o", new ContactRequest("Persona Uno", "Supervisor", null, null, null, null, null,
                null, "Empresa Ejemplo", null, null, List.of("Turno"), "user-1", null));
        ContactView two = service.create(TENANT, "o", new ContactRequest("Persona Dos", "supervisor", null, null,
                null, null, null, null, "empresa ejemplo", null, null, List.of("turno", "Noche"), null, null,
                "11.111.111-1"));

        ContactFacets facets = service.facets(TENANT);
        assertEquals(2, facets.total());
        assertEquals(List.of("Supervisor"), facets.roles());
        assertEquals(List.of(new ContactFacets.Company("Empresa Ejemplo", "111111111", "RUT")), facets.companies(),
                "the company keeps the tax id one of its contacts gave");
        assertEquals(List.of("Noche", "Turno"), facets.tags());
        assertEquals(1, facets.members().size());
        assertEquals("user-1", facets.members().get(0).memberUserId());
        assertFalse(facets.members().stream().anyMatch(m -> m.contactId().equals(two.id())));
    }

    private static List<String> names(ContactService service, ContactFilter filter) {
        return service.page(TENANT, filter, null, 10).items().stream().map(ContactView::name).toList();
    }

    private static ContactRequest member(String name, String memberUserId) {
        return new ContactRequest(name, null, null, null, null, null, null, null, null, null, null, null,
                memberUserId, null);
    }

    private static ContactRequest book(String name, String nationalId) {
        return new ContactRequest(name, null, null, null, null, null, nationalId, null, null, null, null, null, null,
                null);
    }
}
