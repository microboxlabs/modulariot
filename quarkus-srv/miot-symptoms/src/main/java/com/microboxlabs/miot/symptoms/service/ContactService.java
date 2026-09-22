package com.microboxlabs.miot.symptoms.service;

import com.microboxlabs.miot.symptoms.domain.CallMethod;
import com.microboxlabs.miot.symptoms.domain.Contact;
import com.microboxlabs.miot.symptoms.domain.ContactCallStats;
import com.microboxlabs.miot.symptoms.dto.ContactRequest;
import com.microboxlabs.miot.symptoms.dto.ContactView;
import com.microboxlabs.miot.symptoms.store.ContactStore;
import com.microboxlabs.miot.symptoms.store.TreatmentStore;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/** Tenant contact list ("a quién llamar") with call statistics derived from call actions. */
@ApplicationScoped
public class ContactService {

    static final String ENTITY = "contact";
    /** Full international number: plus sign, then 8 to 15 digits. */
    private static final Pattern E164 = Pattern.compile("^\\+[1-9]\\d{7,14}$");

    private final ContactStore contacts;
    private final TreatmentStore treatments;
    private final DemoSeeder seeder;
    private final AuditService audit;

    @Inject
    public ContactService(ContactStore contacts, TreatmentStore treatments, DemoSeeder seeder, AuditService audit) {
        this.contacts = contacts;
        this.treatments = treatments;
        this.seeder = seeder;
        this.audit = audit;
    }

    public List<ContactView> list(String tenantCode, Boolean active) {
        seeder.ensureContacts(tenantCode);
        Map<String, ContactCallStats> stats = statsByContact(tenantCode);
        return contacts.list(tenantCode, active).stream()
                .map(c -> ContactView.of(c, stats.get(c.id())))
                .toList();
    }

    public ContactView get(String tenantCode, String id) {
        Contact c = contacts.find(tenantCode, id).orElseThrow(() -> new NoSuchElementException("contact not found"));
        return ContactView.of(c, statsByContact(tenantCode).get(c.id()));
    }

    public ContactView create(String tenantCode, String actor, ContactRequest req) {
        if (req == null || blank(req.name())) {
            throw new IllegalArgumentException("name is required");
        }
        Contact saved = contacts.insert(new Contact(
                null, tenantCode, req.name().trim(), trimOrNull(req.role()), normalizePhone(req.phone()),
                req.methods() == null ? List.of() : req.methods(),
                req.active() == null || req.active(), trimOrNull(req.notes()), actor, null, null));
        audit.record(tenantCode, actor, "contact.created", ENTITY, saved.id(), null,
                Map.of("name", saved.name(), "role", saved.role() == null ? "" : saved.role()));
        return ContactView.of(saved, null);
    }

    public ContactView update(String tenantCode, String actor, String id, ContactRequest req) {
        if (req == null) {
            throw new IllegalArgumentException("body is required");
        }
        Contact current = contacts.find(tenantCode, id)
                .orElseThrow(() -> new NoSuchElementException("contact not found"));
        String name = req.name() == null ? current.name() : req.name().trim();
        if (name.isBlank()) {
            throw new IllegalArgumentException("name must not be blank");
        }
        List<CallMethod> methods = req.methods() == null ? current.methods() : req.methods();
        Contact updated = contacts.update(new Contact(
                        current.id(), tenantCode, name,
                        req.role() == null ? current.role() : trimOrNull(req.role()),
                        req.phone() == null ? current.phone() : normalizePhone(req.phone()),
                        methods,
                        req.active() == null ? current.active() : req.active(),
                        req.notes() == null ? current.notes() : trimOrNull(req.notes()),
                        current.createdBy(), current.createdAt(), null))
                .orElseThrow(() -> new NoSuchElementException("contact not found"));
        audit.record(tenantCode, actor, "contact.updated", ENTITY, updated.id(), null,
                Map.of("name", updated.name(), "active", updated.active()));
        return ContactView.of(updated, statsByContact(tenantCode).get(updated.id()));
    }

    public boolean delete(String tenantCode, String actor, String id) {
        boolean deleted = contacts.delete(tenantCode, id);
        if (deleted) {
            audit.record(tenantCode, actor, "contact.deleted", ENTITY, id, null, Map.of());
        }
        return deleted;
    }

    private Map<String, ContactCallStats> statsByContact(String tenantCode) {
        return treatments.contactStats(tenantCode).stream()
                .collect(Collectors.toMap(ContactCallStats::contactId, Function.identity(), (a, b) -> a));
    }

    /** Accepts a full international number with spaces or dashes; stores the bare E.164 form. */
    static String normalizePhone(String phone) {
        if (blank(phone)) {
            return null;
        }
        String compact = phone.replaceAll("[\\s\\-()]", "");
        if (!E164.matcher(compact).matches()) {
            throw new IllegalArgumentException("phone must be a full international number, e.g. +56912345678");
        }
        return compact;
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private static String trimOrNull(String value) {
        return blank(value) ? null : value.trim();
    }
}
