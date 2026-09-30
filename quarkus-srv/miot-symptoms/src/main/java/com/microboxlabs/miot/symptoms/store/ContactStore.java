package com.microboxlabs.miot.symptoms.store;

import com.microboxlabs.miot.symptoms.domain.Contact;
import java.util.List;
import java.util.Optional;

/** The tenant's "who to call" list. */
public interface ContactStore {

    /** Stores a new contact. Assigns id and timestamps. Throws {@link DuplicateNationalIdException}. */
    Contact insert(Contact contact);

    /** Replaces an existing contact; empty when it does not exist. Throws {@link DuplicateNationalIdException}. */
    Optional<Contact> update(Contact contact);

    Optional<Contact> find(String tenantCode, String id);

    /** {@code nationalId} is compared as stored, so pass it normalised. */
    Optional<Contact> findByNationalId(String tenantCode, String nationalId);

    /** Ordered by creation. {@code active} null means all. */
    List<Contact> list(String tenantCode, Boolean active);

    boolean delete(String tenantCode, String id);

    boolean isEmpty(String tenantCode);

    /** Another contact of the tenant already has this national id. */
    class DuplicateNationalIdException extends IllegalStateException {

        public DuplicateNationalIdException(String nationalId) {
            super("a contact with national id " + nationalId + " already exists");
        }
    }
}
