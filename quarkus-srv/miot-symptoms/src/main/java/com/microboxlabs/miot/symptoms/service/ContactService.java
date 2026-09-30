package com.microboxlabs.miot.symptoms.service;

import com.microboxlabs.miot.symptoms.domain.CallMethod;
import com.microboxlabs.miot.symptoms.domain.Contact;
import com.microboxlabs.miot.symptoms.domain.ContactCallStats;
import com.microboxlabs.miot.symptoms.domain.ContactChannels;
import com.microboxlabs.miot.symptoms.dto.ContactImportResult;
import com.microboxlabs.miot.symptoms.dto.ContactImportResult.Status;
import com.microboxlabs.miot.symptoms.dto.ContactRequest;
import com.microboxlabs.miot.symptoms.dto.ContactView;
import com.microboxlabs.miot.symptoms.store.ContactStore;
import com.microboxlabs.miot.symptoms.store.ContactStore.DuplicateNationalIdException;
import com.microboxlabs.miot.symptoms.store.TreatmentStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/** Tenant contact list ("a quién llamar") with call statistics derived from call actions. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class ContactService {

    private static final String CONTACT_NOT_FOUND = "contact not found";

    static final String ENTITY = "contact";
    static final int MAX_IMPORT_ROWS = 1000;
    /** Full international number: plus sign, then 8 to 15 digits. */
    private static final Pattern E164 = Pattern.compile("^\\+[1-9]\\d{7,14}$");
    /** A RUT without dots or dash: up to 8 digits, then the check digit. */
    private static final Pattern RUT = Pattern.compile("^(\\d{1,8})([\\dK])$");
    private static final Pattern ID_TYPE = Pattern.compile("^[A-Z][A-Z0-9_]{0,15}$");

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
        Contact c = contacts.find(tenantCode, id).orElseThrow(() -> new NoSuchElementException(CONTACT_NOT_FOUND));
        return ContactView.of(c, statsByContact(tenantCode).get(c.id()));
    }

    public ContactView create(String tenantCode, String actor, ContactRequest req) {
        Contact saved = insert(newContact(tenantCode, actor, req));
        audit.log(tenantCode, actor, "contact.created", ENTITY, saved.id(), null, createdDetails(saved, "api"));
        return ContactView.of(saved, null);
    }

    /**
     * Creates each row on its own: a row with a national id already in the
     * book, or repeated earlier in the same request, is skipped; an invalid
     * row is an error. Neither stops the rest.
     */
    public ContactImportResult importContacts(String tenantCode, String actor, List<ContactRequest> rows) {
        if (rows == null || rows.isEmpty()) {
            throw new IllegalArgumentException("contacts is required");
        }
        if (rows.size() > MAX_IMPORT_ROWS) {
            throw new IllegalArgumentException("at most " + MAX_IMPORT_ROWS + " contacts per import");
        }
        List<ContactImportResult.Row> results = new ArrayList<>();
        Set<String> seenIds = new HashSet<>();
        int created = 0;
        int skipped = 0;
        for (int i = 0; i < rows.size(); i++) {
            ContactImportResult.Row row = importRow(tenantCode, actor, i, rows.get(i), seenIds);
            results.add(row);
            if (row.status() == Status.CREATED) {
                created++;
            } else if (row.status() == Status.SKIPPED) {
                skipped++;
            }
        }
        return new ContactImportResult(created, skipped, rows.size() - created - skipped, results);
    }

    private ContactImportResult.Row importRow(
            String tenantCode, String actor, int index, ContactRequest req, Set<String> seenIds) {
        try {
            Contact draft = newContact(tenantCode, actor, req);
            if (draft.nationalId() != null && !seenIds.add(draft.nationalId())) {
                return new ContactImportResult.Row(index, Status.SKIPPED, "national id repeated in this import", null);
            }
            Contact saved = insert(draft);
            audit.log(tenantCode, actor, "contact.created", ENTITY, saved.id(), null,
                    createdDetails(saved, "import"));
            return new ContactImportResult.Row(index, Status.CREATED, null, ContactView.of(saved, null));
        } catch (DuplicateNationalIdException e) {
            return new ContactImportResult.Row(index, Status.SKIPPED, e.getMessage(), null);
        } catch (IllegalArgumentException e) {
            return new ContactImportResult.Row(index, Status.ERROR, e.getMessage(), null);
        }
    }

    public ContactView update(String tenantCode, String actor, String id, ContactRequest req) {
        if (req == null) {
            throw new IllegalArgumentException("body is required");
        }
        Contact current = contacts.find(tenantCode, id)
                .orElseThrow(() -> new NoSuchElementException(CONTACT_NOT_FOUND));
        String name = req.name() == null ? current.name() : req.name().trim();
        if (name.isBlank()) {
            throw new IllegalArgumentException("name must not be blank");
        }
        String idType = req.nationalIdType() == null ? current.nationalIdType() : idType(req.nationalIdType());
        String nationalId = req.nationalId() == null && req.nationalIdType() == null
                ? current.nationalId()
                : nationalId(req.nationalId() == null ? current.nationalId() : req.nationalId(), idType);
        ContactChannels channels = req.channels() == null ? current.channels() : channels(req.channels());
        String phone = req.phone() == null
                ? (req.channels() == null ? current.phone() : phoneFrom(channels))
                : normalizePhone(req.phone());
        List<CallMethod> methods = req.methods() == null
                ? (req.channels() == null ? current.methods() : methodsFrom(channels))
                : req.methods();
        Contact next = new Contact(
                current.id(), tenantCode, name,
                req.role() == null ? current.role() : trimOrNull(req.role()),
                phone, methods,
                req.active() == null ? current.active() : req.active(),
                req.notes() == null ? current.notes() : trimOrNull(req.notes()),
                current.createdBy(), current.createdAt(), null,
                nationalId, idType,
                req.company() == null ? current.company() : trimOrNull(req.company()),
                req.position() == null ? current.position() : trimOrNull(req.position()),
                channels,
                req.tags() == null ? current.tags() : tags(req.tags()),
                req.memberUserId() == null ? current.memberUserId() : trimOrNull(req.memberUserId()),
                req.provisional() == null ? current.provisional() : req.provisional());
        requireFreeNationalId(next);
        Contact updated = contacts.update(next).orElseThrow(() -> new NoSuchElementException(CONTACT_NOT_FOUND));
        audit.log(tenantCode, actor, "contact.updated", ENTITY, updated.id(), null,
                Map.of("name", updated.name(), "active", updated.active()));
        return ContactView.of(updated, statsByContact(tenantCode).get(updated.id()));
    }

    public boolean delete(String tenantCode, String actor, String id) {
        boolean deleted = contacts.delete(tenantCode, id);
        if (deleted) {
            audit.log(tenantCode, actor, "contact.deleted", ENTITY, id, null, Map.of());
        }
        return deleted;
    }

    private Contact newContact(String tenantCode, String actor, ContactRequest req) {
        if (req == null || blank(req.name())) {
            throw new IllegalArgumentException("name is required");
        }
        String idType = req.nationalIdType() == null ? Contact.DEFAULT_NATIONAL_ID_TYPE : idType(req.nationalIdType());
        ContactChannels channels = channels(req.channels());
        String phone = req.phone() == null ? phoneFrom(channels) : normalizePhone(req.phone());
        List<CallMethod> methods = req.methods() == null ? methodsFrom(channels) : req.methods();
        return new Contact(
                null, tenantCode, req.name().trim(), trimOrNull(req.role()), phone, methods,
                req.active() == null || req.active(), trimOrNull(req.notes()), actor, null, null,
                nationalId(req.nationalId(), idType), idType, trimOrNull(req.company()), trimOrNull(req.position()),
                channels, tags(req.tags()), trimOrNull(req.memberUserId()), Boolean.TRUE.equals(req.provisional()));
    }

    /** Checks first for a clear message; the store's unique index still catches a race. */
    private Contact insert(Contact contact) {
        requireFreeNationalId(contact);
        return contacts.insert(contact);
    }

    private void requireFreeNationalId(Contact contact) {
        contacts.findByNationalId(contact.tenantCode(), contact.nationalId())
                .filter(other -> !Objects.equals(other.id(), contact.id()))
                .ifPresent(other -> {
                    throw new DuplicateNationalIdException(contact.nationalId());
                });
    }

    private static Map<String, Object> createdDetails(Contact c, String source) {
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("name", c.name());
        details.put("role", c.role() == null ? "" : c.role());
        details.put("source", source);
        details.put("provisional", c.provisional());
        return details;
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

    /** The id without dots, dashes or spaces, upper case: "12.345.678-k" becomes "12345678K". Blank is null. */
    static String normalizeNationalId(String nationalId) {
        if (blank(nationalId)) {
            return null;
        }
        return nationalId.replaceAll("[.\\-\\s]", "").toUpperCase(Locale.ROOT);
    }

    /** Normalises the id and, for a RUT, checks its check digit. */
    static String nationalId(String raw, String type) {
        String id = normalizeNationalId(raw);
        if (id == null) {
            return null;
        }
        if (id.length() > 32) {
            throw new IllegalArgumentException("nationalId is too long");
        }
        if (Contact.DEFAULT_NATIONAL_ID_TYPE.equals(type) && !isValidRut(id)) {
            throw new IllegalArgumentException("nationalId is not a valid RUT");
        }
        return id;
    }

    static boolean isValidRut(String normalized) {
        var m = RUT.matcher(normalized);
        if (!m.matches()) {
            return false;
        }
        String digits = m.group(1);
        int sum = 0;
        int factor = 2;
        for (int i = digits.length() - 1; i >= 0; i--) {
            sum += (digits.charAt(i) - '0') * factor;
            factor = factor == 7 ? 2 : factor + 1;
        }
        int rest = 11 - (sum % 11);
        String expected = switch (rest) {
            case 11 -> "0";
            case 10 -> "K";
            default -> Integer.toString(rest);
        };
        return expected.equals(m.group(2));
    }

    private static String idType(String raw) {
        String type = blank(raw) ? Contact.DEFAULT_NATIONAL_ID_TYPE : raw.trim().toUpperCase(Locale.ROOT);
        if (!ID_TYPE.matcher(type).matches()) {
            throw new IllegalArgumentException("nationalIdType must be a short code such as RUT");
        }
        return type;
    }

    private static ContactChannels channels(ContactChannels raw) {
        if (raw == null) {
            return ContactChannels.NONE;
        }
        return new ContactChannels(normalizePhone(raw.phone()), normalizePhone(raw.whatsapp()),
                trimOrNull(raw.meet()), trimOrNull(raw.teams()));
    }

    private static String phoneFrom(ContactChannels channels) {
        return channels.phone() != null ? channels.phone() : channels.whatsapp();
    }

    private static List<CallMethod> methodsFrom(ContactChannels channels) {
        List<CallMethod> methods = new ArrayList<>();
        if (channels.phone() != null) {
            methods.add(CallMethod.PHONE);
        }
        if (channels.whatsapp() != null) {
            methods.add(CallMethod.WHATSAPP);
        }
        if (channels.meet() != null) {
            methods.add(CallMethod.MEET);
        }
        if (channels.teams() != null) {
            methods.add(CallMethod.TEAMS);
        }
        return methods;
    }

    /** Trimmed, blanks dropped, and each tag once regardless of case. */
    static List<String> tags(List<String> raw) {
        if (raw == null) {
            return List.of();
        }
        Map<String, String> byKey = new LinkedHashMap<>();
        for (String tag : raw) {
            if (!blank(tag)) {
                byKey.putIfAbsent(tag.trim().toLowerCase(Locale.ROOT), tag.trim());
            }
        }
        return List.copyOf(byKey.values());
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private static String trimOrNull(String value) {
        return blank(value) ? null : value.trim();
    }
}
