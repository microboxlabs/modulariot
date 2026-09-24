package com.microboxlabs.miot.symptoms.store;

import com.microboxlabs.miot.symptoms.domain.Contact;
import java.util.List;
import java.util.Optional;

/** The tenant's "who to call" list. */
public interface ContactStore {

    /** Stores a new contact. Assigns id and timestamps. */
    Contact insert(Contact contact);

    /** Replaces an existing contact; empty when it does not exist. */
    Optional<Contact> update(Contact contact);

    Optional<Contact> find(String tenantCode, String id);

    /** Ordered by creation. {@code active} null means all. */
    List<Contact> list(String tenantCode, Boolean active);

    boolean delete(String tenantCode, String id);

    boolean isEmpty(String tenantCode);
}
