package com.microboxlabs.miot.symptoms.store;

import com.microboxlabs.miot.symptoms.domain.Contact;
import com.microboxlabs.miot.symptoms.domain.ContactFacets;
import com.microboxlabs.miot.symptoms.domain.ContactFilter;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

/** The tenant's "who to call" list. */
public interface ContactStore {

    /**
     * Stores a new contact. Assigns id and timestamps. Throws {@link DuplicateNationalIdException} or
     * {@link DuplicateMemberException}.
     */
    Contact insert(Contact contact);

    /** Replaces an existing contact; empty when it does not exist. Throws like {@link #insert}. */
    Optional<Contact> update(Contact contact);

    Optional<Contact> find(String tenantCode, String id);

    /** {@code nationalId} is compared as stored, so pass it normalised. */
    Optional<Contact> findByNationalId(String tenantCode, String nationalId);

    Optional<Contact> findByMember(String tenantCode, String memberUserId);

    /** Ordered by creation. {@code active} null means all. */
    List<Contact> list(String tenantCode, Boolean active);

    /** At most {@code limit} contacts that pass {@code filter}, in creation order, after {@code after} (null: from the start). */
    List<Contact> page(String tenantCode, ContactFilter filter, After after, int limit);

    ContactFacets facets(String tenantCode);

    boolean delete(String tenantCode, String id);

    boolean isEmpty(String tenantCode);

    /** The last contact of a page: the next page starts after it. */
    record After(OffsetDateTime createdAt, String id) {
    }
}
