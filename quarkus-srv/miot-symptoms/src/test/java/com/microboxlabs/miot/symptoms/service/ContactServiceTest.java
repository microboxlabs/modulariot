package com.microboxlabs.miot.symptoms.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.domain.CallMethod;
import com.microboxlabs.miot.symptoms.dto.ContactRequest;
import com.microboxlabs.miot.symptoms.dto.ContactView;
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
        assertThrows(IllegalArgumentException.class,
                () -> service.create(TENANT, "o", new ContactRequest(" ", null, null, null, null, null)));

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
}
