package com.microboxlabs.miot.symptoms.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.domain.CallMethod;
import com.microboxlabs.miot.symptoms.domain.Contact;
import com.microboxlabs.miot.symptoms.domain.ContactCallStats;
import com.microboxlabs.miot.symptoms.dto.ContactRequest;
import com.microboxlabs.miot.symptoms.dto.ContactView;
import com.microboxlabs.miot.symptoms.persistence.ContactRepository;
import com.microboxlabs.miot.symptoms.persistence.TreatmentRepository;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ContactServiceTest {

    private static final String TENANT = "tenant-a";

    @Test
    void phoneIsNormalisedToBareE164() {
        assertEquals("+56912345678", ContactService.normalizePhone("+56 9 1234 5678"));
        assertEquals("+56912345678", ContactService.normalizePhone("+56-9-1234-5678"));
        assertNull(ContactService.normalizePhone("  "));
        assertThrows(IllegalArgumentException.class, () -> ContactService.normalizePhone("912345678"));
        assertThrows(IllegalArgumentException.class, () -> ContactService.normalizePhone("+56 9 abc"));
    }

    @Test
    void createRequiresANameAndDefaultsToActive() {
        var repo = new FakeContacts();
        var audit = new TreatmentServiceTest.FakeAudit();
        var service = new ContactService(repo, new FakeStats(List.of()), new AuditService(audit));

        assertThrows(IllegalArgumentException.class,
                () -> service.create(TENANT, "o", new ContactRequest(" ", null, null, null, null, null)));

        ContactView created = service.create(TENANT, "o",
                new ContactRequest(" Camila ", "Jefe", "+56 9 1234 5678", List.of(CallMethod.PHONE), null, null));
        assertEquals("Camila", created.name());
        assertTrue(created.active());
        assertEquals("+56912345678", created.phone());
        assertEquals("contact.created", audit.events.get(0).action());
    }

    @Test
    void updateKeepsFieldsThatAreNotSent() {
        var repo = new FakeContacts();
        var service = new ContactService(repo, new FakeStats(List.of()), new AuditService(new TreatmentServiceTest.FakeAudit()));
        ContactView created = service.create(TENANT, "o",
                new ContactRequest("Camila", "Jefe", "+56912345678", List.of(CallMethod.PHONE), true, "n"));

        ContactView updated = service.update(TENANT, "o", created.id(),
                new ContactRequest(null, null, null, null, false, null));

        assertEquals("Camila", updated.name());
        assertEquals("Jefe", updated.role());
        assertEquals("+56912345678", updated.phone());
        assertEquals(List.of(CallMethod.PHONE), updated.methods());
        assertTrue(!updated.active());
    }

    @Test
    void listMergesCallStatistics() {
        var repo = new FakeContacts();
        var service = new ContactService(repo, new FakeStats(List.of()), new AuditService(new TreatmentServiceTest.FakeAudit()));
        ContactView created = service.create(TENANT, "o", new ContactRequest("Camila", null, null, null, null, null));
        OffsetDateTime when = OffsetDateTime.now();
        var withStats = new ContactService(repo,
                new FakeStats(List.of(new ContactCallStats(created.id(), when, 3, 1))),
                new AuditService(new TreatmentServiceTest.FakeAudit()));

        List<ContactView> listed = withStats.list(TENANT, null);

        assertEquals(1, listed.size());
        assertEquals(3, listed.get(0).answered());
        assertEquals(1, listed.get(0).missed());
        assertEquals(when, listed.get(0).lastCalledAt());
    }

    private static final class FakeContacts extends ContactRepository {
        final List<Contact> rows = new ArrayList<>();

        FakeContacts() {
            super(null);
        }

        @Override
        public Contact insert(Contact c) {
            Contact saved = new Contact(UUID.randomUUID().toString(), c.tenantCode(), c.name(), c.role(), c.phone(),
                    c.methods(), c.active(), c.notes(), c.createdBy(), OffsetDateTime.now(), OffsetDateTime.now());
            rows.add(saved);
            return saved;
        }

        @Override
        public Optional<Contact> update(Contact c) {
            for (int i = 0; i < rows.size(); i++) {
                if (rows.get(i).id().equals(c.id())) {
                    Contact saved = new Contact(c.id(), c.tenantCode(), c.name(), c.role(), c.phone(), c.methods(),
                            c.active(), c.notes(), c.createdBy(), c.createdAt(), OffsetDateTime.now());
                    rows.set(i, saved);
                    return Optional.of(saved);
                }
            }
            return Optional.empty();
        }

        @Override
        public Optional<Contact> findById(String tenantCode, String id) {
            return rows.stream().filter(c -> c.id().equals(id)).findFirst();
        }

        @Override
        public List<Contact> list(String tenantCode, Boolean active) {
            return rows.stream().filter(c -> active == null || c.active() == active).toList();
        }
    }

    private static final class FakeStats extends TreatmentRepository {
        private final List<ContactCallStats> stats;

        FakeStats(List<ContactCallStats> stats) {
            super(null);
            this.stats = stats;
        }

        @Override
        public List<ContactCallStats> contactStats(String tenantCode) {
            return stats;
        }
    }
}
