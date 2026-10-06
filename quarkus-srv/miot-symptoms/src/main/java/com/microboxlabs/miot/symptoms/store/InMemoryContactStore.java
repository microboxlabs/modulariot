package com.microboxlabs.miot.symptoms.store;

import com.microboxlabs.miot.symptoms.domain.Contact;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
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

    private void requireUniqueNationalId(Contact c, String selfId) {
        Optional<Contact> other = findByNationalId(c.tenantCode(), c.nationalId());
        if (other.isPresent() && !Objects.equals(other.get().id(), selfId)) {
            throw new DuplicateNationalIdException(c.nationalId());
        }
    }
}
