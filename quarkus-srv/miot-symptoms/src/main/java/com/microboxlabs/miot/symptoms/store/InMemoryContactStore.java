package com.microboxlabs.miot.symptoms.store;

import com.microboxlabs.miot.symptoms.domain.Contact;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Process-local contact store. */
@ApplicationScoped
public class InMemoryContactStore implements ContactStore {

    private final Map<String, Contact> contacts = new LinkedHashMap<>();

    @Override
    public synchronized Contact insert(Contact c) {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        Contact saved = new Contact(UUID.randomUUID().toString(), c.tenantCode(), c.name(), c.role(), c.phone(),
                c.methods() == null ? List.of() : List.copyOf(c.methods()), c.active(), c.notes(), c.createdBy(),
                now, now);
        contacts.put(saved.id(), saved);
        return saved;
    }

    @Override
    public synchronized Optional<Contact> update(Contact c) {
        Optional<Contact> current = find(c.tenantCode(), c.id());
        if (current.isEmpty()) {
            return Optional.empty();
        }
        Contact saved = new Contact(c.id(), c.tenantCode(), c.name(), c.role(), c.phone(),
                c.methods() == null ? List.of() : List.copyOf(c.methods()), c.active(), c.notes(),
                current.get().createdBy(), current.get().createdAt(), OffsetDateTime.now(ZoneOffset.UTC));
        contacts.put(saved.id(), saved);
        return Optional.of(saved);
    }

    @Override
    public synchronized Optional<Contact> find(String tenantCode, String id) {
        Contact c = id == null ? null : contacts.get(id);
        return c != null && c.tenantCode().equals(tenantCode) ? Optional.of(c) : Optional.empty();
    }

    @Override
    public synchronized List<Contact> list(String tenantCode, Boolean active) {
        return contacts.values().stream()
                .filter(c -> c.tenantCode().equals(tenantCode))
                .filter(c -> active == null || c.active() == active)
                .toList();
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
}
