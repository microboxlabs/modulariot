package com.microboxlabs.miot.symptoms.service;

import com.microboxlabs.miot.symptoms.domain.CallMethod;
import com.microboxlabs.miot.symptoms.domain.Contact;
import com.microboxlabs.miot.symptoms.domain.ContactCallStats;
import com.microboxlabs.miot.symptoms.domain.ContactChannels;
import com.microboxlabs.miot.symptoms.domain.ContactFacets;
import com.microboxlabs.miot.symptoms.domain.ContactFilter;
import com.microboxlabs.miot.symptoms.dto.ContactImportResult;
import com.microboxlabs.miot.symptoms.dto.ContactImportResult.Status;
import com.microboxlabs.miot.symptoms.dto.ContactPage;
import com.microboxlabs.miot.symptoms.dto.ContactRequest;
import com.microboxlabs.miot.symptoms.dto.ContactView;
import com.microboxlabs.miot.symptoms.store.ContactStore;
import com.microboxlabs.miot.symptoms.store.ContactStore.After;
import com.microboxlabs.miot.symptoms.store.DuplicateMemberException;
import com.microboxlabs.miot.symptoms.store.DuplicateNationalIdException;
import com.microboxlabs.miot.symptoms.store.TreatmentStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Base64;
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
    static final int PAGE_SIZE = 100;
    static final int MAX_PAGE_SIZE = 200;
    /** Full international number: plus sign, then 8 to 15 digits. */
    private static final Pattern E164 = Pattern.compile("^\\+[1-9]\\d{7,14}$");
    /** A RUT without dots or dash: up to 8 digits, then the check digit. */
    private static final Pattern RUT = Pattern.compile("^(\\d{1,8})([\\dK])$");
    private static final Pattern ID_TYPE = Pattern.compile("^[A-Z][A-Z0-9_]{0,15}$");
    private static final String RUC = "RUC";
    private static final Set<String> COMPANY_ID_TYPES = Set.of(Contact.DEFAULT_NATIONAL_ID_TYPE, RUC, "OTRO");

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

    /** Up to {@code limit} contacts (100 by default) that pass {@code filter}, from {@code cursor} on. */
    public ContactPage page(String tenantCode, ContactFilter filter, String cursor, Integer limit) {
        int size = limit == null ? PAGE_SIZE : limit;
        if (size < 1 || size > MAX_PAGE_SIZE) {
            throw new IllegalArgumentException("limit must be between 1 and " + MAX_PAGE_SIZE);
        }
        seeder.ensureContacts(tenantCode);
        List<Contact> found = contacts.page(tenantCode, filter, after(cursor), size + 1);
        List<Contact> items = found.subList(0, Math.min(size, found.size()));
        Map<String, ContactCallStats> stats = statsByContact(tenantCode);
        String next = found.size() > size ? cursor(items.get(items.size() - 1)) : null;
        return new ContactPage(items.stream().map(c -> ContactView.of(c, stats.get(c.id()))).toList(), next);
    }

    public ContactFacets facets(String tenantCode) {
        seeder.ensureContacts(tenantCode);
        return contacts.facets(tenantCode);
    }

    private static String cursor(Contact last) {
        String raw = last.createdAt() + "|" + last.id();
        return Base64.getUrlEncoder().withoutPadding().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

    private static After after(String cursor) {
        if (blank(cursor)) {
            return null;
        }
        try {
            String raw = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
            int bar = raw.indexOf('|');
            return new After(OffsetDateTime.parse(raw.substring(0, bar)), raw.substring(bar + 1));
        } catch (IllegalArgumentException | DateTimeParseException | StringIndexOutOfBoundsException e) {
            throw new IllegalArgumentException("cursor is not valid");
        }
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
        } catch (DuplicateNationalIdException | DuplicateMemberException e) {
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
        Contact next = merge(current, name, req);
        requireFreeNationalId(next);
        requireFreeMember(next);
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

    /** The current contact with every field the request sends. */
    private static Contact merge(Contact current, String name, ContactRequest req) {
        String idType = patch(req.nationalIdType(), current.nationalIdType(), ContactService::idType);
        String companyType = patch(req.companyTaxIdType(), current.companyTaxIdType(), ContactService::companyIdType);
        ContactChannels channels = patch(req.channels(), current.channels(), ContactService::channels);
        return new Contact(
                current.id(), current.tenantCode(), name,
                patch(req.role(), current.role(), ContactService::trimOrNull),
                mergedPhone(current, req, channels), mergedMethods(current, req, channels),
                patch(req.active(), current.active(), Function.identity()),
                patch(req.notes(), current.notes(), ContactService::trimOrNull),
                current.createdBy(), current.createdAt(), null,
                mergedNationalId(current, req, idType), idType,
                patch(req.company(), current.company(), ContactService::trimOrNull),
                patch(req.position(), current.position(), ContactService::trimOrNull),
                channels,
                patch(req.tags(), current.tags(), ContactService::tags),
                patch(req.memberUserId(), current.memberUserId(), ContactService::trimOrNull),
                patch(req.provisional(), current.provisional(), Function.identity()),
                mergedCompanyTaxId(current, req, companyType), companyType);
    }

    private static String mergedCompanyTaxId(Contact current, ContactRequest req, String type) {
        if (req.companyRut() == null && req.companyTaxIdType() == null) {
            return current.companyRut();
        }
        return companyTaxId(patch(req.companyRut(), current.companyRut(), Function.identity()), type);
    }

    /** A field the request leaves out keeps its current value. */
    private static <T, R> R patch(T sent, R current, Function<T, R> read) {
        return sent == null ? current : read.apply(sent);
    }

    private static String mergedNationalId(Contact current, ContactRequest req, String idType) {
        if (req.nationalId() == null && req.nationalIdType() == null) {
            return current.nationalId();
        }
        return nationalId(patch(req.nationalId(), current.nationalId(), Function.identity()), idType);
    }

    private static String mergedPhone(Contact current, ContactRequest req, ContactChannels channels) {
        if (req.phone() != null) {
            return normalizePhone(req.phone());
        }
        return req.channels() == null ? current.phone() : phoneFrom(channels);
    }

    private static List<CallMethod> mergedMethods(Contact current, ContactRequest req, ContactChannels channels) {
        if (req.methods() != null) {
            return req.methods();
        }
        return req.channels() == null ? current.methods() : methodsFrom(channels);
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
                channels, tags(req.tags()), trimOrNull(req.memberUserId()), Boolean.TRUE.equals(req.provisional()),
                companyTaxId(req.companyRut(), companyIdType(req.companyTaxIdType())),
                companyIdType(req.companyTaxIdType()));
    }

    /** Checks first for a clear message; the store's unique index still catches a race. */
    private Contact insert(Contact contact) {
        requireFreeNationalId(contact);
        requireFreeMember(contact);
        return contacts.insert(contact);
    }

    private void requireFreeMember(Contact contact) {
        if (contact.memberUserId() == null) {
            return;
        }
        boolean taken = contacts.findByMember(contact.tenantCode(), contact.memberUserId())
                .filter(other -> !Objects.equals(other.id(), contact.id()))
                .isPresent();
        if (taken) {
            throw new DuplicateMemberException();
        }
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
        if (!isValidId(type, id)) {
            throw new IllegalArgumentException("nationalId is not a valid " + type);
        }
        return id;
    }

    /** RUT and RUC check their digit, DNI is 8 digits, CE 8 to 12 letters or digits; other types any short code. */
    static boolean isValidId(String type, String normalized) {
        return switch (type == null ? Contact.DEFAULT_NATIONAL_ID_TYPE : type) {
            case Contact.DEFAULT_NATIONAL_ID_TYPE -> isValidRut(normalized);
            case RUC -> isValidRuc(normalized);
            case "DNI" -> normalized.matches("\\d{8}");
            case "CE" -> normalized.matches("[A-Z0-9]{8,12}");
            default -> normalized.matches("[A-Z0-9]{1,32}");
        };
    }

    /** Peru's RUC: 11 digits starting 10, 15, 17 or 20, with a mod-11 check digit. */
    static boolean isValidRuc(String normalized) {
        if (!normalized.matches("(10|15|17|20)\\d{9}")) {
            return false;
        }
        int[] weights = {5, 4, 3, 2, 7, 6, 5, 4, 3, 2};
        int sum = 0;
        for (int i = 0; i < weights.length; i++) {
            sum += (normalized.charAt(i) - '0') * weights[i];
        }
        int check = 11 - (sum % 11);
        if (check == 10) {
            check = 0;
        } else if (check == 11) {
            check = 1;
        }
        return normalized.charAt(10) - '0' == check;
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
                trimOrNull(raw.meet()), trimOrNull(raw.teams()), email(raw.email()));
    }

    /** A plain address, lower case; blank is null. */
    static String email(String raw) {
        String email = trimOrNull(raw);
        if (email == null) {
            return null;
        }
        if (email.length() > 254 || !validEmail(email)) {
            throw new IllegalArgumentException("email is not a valid address");
        }
        return email.toLowerCase(Locale.ROOT);
    }

    /** A simple address shape, checked in linear time without backtracking. */
    private static boolean validEmail(String email) {
        int at = email.indexOf('@');
        if (at < 1 || email.indexOf('@', at + 1) >= 0) {
            return false;
        }
        int labelStart = at + 1;
        boolean hasDot = false;
        for (int i = 0; i < email.length(); i++) {
            char c = email.charAt(i);
            if (Character.isWhitespace(c) || Character.isSpaceChar(c)) {
                return false;
            }
            if (i > at && c == '.') {
                if (i == labelStart) {
                    return false;
                }
                hasDot = true;
                labelStart = i + 1;
            }
        }
        return hasDot && labelStart < email.length();
    }

    /** The company's tax id of {@code type}, normalised and checked; blank is null. */
    static String companyTaxId(String raw, String type) {
        String id = normalizeNationalId(raw);
        if (id != null && !isValidId(type, id)) {
            throw new IllegalArgumentException("companyRut is not a valid " + type);
        }
        return id;
    }

    /** RUT (Chile), RUC (Peru) or OTRO; blank is RUT. */
    private static String companyIdType(String raw) {
        String type = blank(raw) ? Contact.DEFAULT_NATIONAL_ID_TYPE : raw.trim().toUpperCase(Locale.ROOT);
        if (!COMPANY_ID_TYPES.contains(type)) {
            throw new IllegalArgumentException("companyTaxIdType must be RUT, RUC or OTRO");
        }
        return type;
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
