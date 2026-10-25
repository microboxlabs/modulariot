package com.microboxlabs.miot.symptoms.store;

import com.microboxlabs.miot.symptoms.domain.Contact;
import com.microboxlabs.miot.symptoms.domain.ContactFacets;
import com.microboxlabs.miot.symptoms.domain.ContactFilter;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/** Process-local contact store for unit tests. Not a CDI bean: the running service uses {@link PgContactStore}. */
public class InMemoryContactStore implements ContactStore {

    private final Map<String, Contact> contacts = new LinkedHashMap<>();

    @Override
    public synchronized Contact insert(Contact c) {
        requireUniqueNationalId(c, null);
        requireUniqueMember(c, null);
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        Contact saved = c.stored(UUID.randomUUID().toString(), c.createdBy(), now, now);
        contacts.put(saved.id(), saved);
        return saved;
    }

    @Override
    public synchronized Optional<Contact> update(Contact c) {
        Optional<Contact> current = find(c.tenantCode(), c.id());
        if (current.isEmpty()) {
            return Optional.empty();
        }
        requireUniqueNationalId(c, c.id());
        requireUniqueMember(c, c.id());
        Contact saved = c.stored(c.id(), current.get().createdBy(), current.get().createdAt(),
                OffsetDateTime.now(ZoneOffset.UTC));
        contacts.put(saved.id(), saved);
        return Optional.of(saved);
    }

    @Override
    public synchronized Optional<Contact> find(String tenantCode, String id) {
        Contact c = id == null ? null : contacts.get(id);
        return c != null && c.tenantCode().equals(tenantCode) ? Optional.of(c) : Optional.empty();
    }

    @Override
    public synchronized Optional<Contact> findByNationalId(String tenantCode, String nationalId) {
        if (nationalId == null) {
            return Optional.empty();
        }
        return contacts.values().stream()
                .filter(c -> c.tenantCode().equals(tenantCode) && nationalId.equals(c.nationalId()))
                .findFirst();
    }

    @Override
    public synchronized List<Contact> list(String tenantCode, Boolean active) {
        return contacts.values().stream()
                .filter(c -> c.tenantCode().equals(tenantCode))
                .filter(c -> active == null || c.active() == active)
                .toList();
    }

    @Override
    public synchronized Optional<Contact> findByMember(String tenantCode, String memberUserId) {
        return contacts.values().stream()
                .filter(c -> c.tenantCode().equals(tenantCode) && memberUserId != null
                        && memberUserId.equals(c.memberUserId()))
                .findFirst();
    }

    /** Insertion order stands for creation order. */
    @Override
    public synchronized List<Contact> page(String tenantCode, ContactFilter filter, After after, int limit) {
        List<Contact> book = list(tenantCode, filter.active());
        int start = 0;
        if (after != null) {
            for (int i = 0; i < book.size(); i++) {
                if (book.get(i).id().equals(after.id())) {
                    start = i + 1;
                }
            }
        }
        return book.subList(start, book.size()).stream().filter(c -> passes(c, filter)).limit(limit).toList();
    }

    private static boolean passes(Contact c, ContactFilter f) {
        return (f.text() == null || contains(c.name(), f.text()) || contains(c.role(), f.text())
                        || contains(c.company(), f.text()))
                && (f.member() == null || f.member() == (c.memberUserId() != null))
                && (f.role() == null || f.role().equalsIgnoreCase(trim(c.role())))
                && (f.company() == null || f.company().equalsIgnoreCase(trim(c.company())))
                && (f.tag() == null || c.tags().stream().anyMatch(t -> t.trim().equalsIgnoreCase(f.tag())));
    }

    private static boolean contains(String value, String text) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(text.toLowerCase(Locale.ROOT));
    }

    private static String trim(String value) {
        return value == null ? "" : value.trim();
    }

    @Override
    public synchronized ContactFacets facets(String tenantCode) {
        List<Contact> book = list(tenantCode, null);
        Map<String, ContactFacets.Company> companies = new LinkedHashMap<>();
        for (Contact c : book) {
            if (!trim(c.company()).isEmpty()) {
                companies.merge(trim(c.company()).toLowerCase(Locale.ROOT),
                        new ContactFacets.Company(trim(c.company()), c.companyRut(), c.companyTaxIdType()),
                        (a, b) -> a.rut() == null ? new ContactFacets.Company(a.name(), b.rut(), b.taxIdType()) : a);
            }
        }
        return new ContactFacets(book.size(),
                distinct(book.stream().map(c -> trim(c.role())).toList()),
                companies.values().stream()
                        .sorted(Comparator.comparing(o -> o.name().toLowerCase(Locale.ROOT))).toList(),
                distinct(book.stream().flatMap(c -> c.tags().stream()).map(String::trim).toList()),
                book.stream().filter(c -> c.memberUserId() != null)
                        .map(c -> new ContactFacets.Member(c.memberUserId(), c.id())).toList());
    }

    private static List<String> distinct(List<String> values) {
        Map<String, String> byKey = new LinkedHashMap<>();
        values.stream().filter(v -> !v.isEmpty())
                .forEach(v -> byKey.putIfAbsent(v.toLowerCase(Locale.ROOT), v));
        return byKey.values().stream().sorted(Comparator.comparing(v -> v.toLowerCase(Locale.ROOT))).toList();
    }

    @Override
    public synchronized boolean delete(String tenantCode, String id) {
        if (find(tenantCode, id).isEmpty()) {
            return false;
        }
        contacts.remove(id);
        return true;
    }

    @Override
    public synchronized boolean isEmpty(String tenantCode) {
        return contacts.values().stream().noneMatch(c -> c.tenantCode().equals(tenantCode));
    }

    private void requireUniqueMember(Contact c, String selfId) {
        Optional<Contact> other = findByMember(c.tenantCode(), c.memberUserId());
        if (other.isPresent() && !Objects.equals(other.get().id(), selfId)) {
            throw new DuplicateMemberException();
        }
    }

    private void requireUniqueNationalId(Contact c, String selfId) {
        Optional<Contact> other = findByNationalId(c.tenantCode(), c.nationalId());
        if (other.isPresent() && !Objects.equals(other.get().id(), selfId)) {
            throw new DuplicateNationalIdException(c.nationalId());
        }
    }
}
