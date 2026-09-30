package com.microboxlabs.miot.symptoms.domain;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Someone the tower can call about a symptom: a named person with a role and
 * the channels they answer on. {@code nationalId} is stored normalised and is
 * unique per tenant. A provisional contact was captured quickly from the call
 * panel and still has to be completed.
 */
public record Contact(
        String id,
        String tenantCode,
        String name,
        String role,
        String phone,
        List<CallMethod> methods,
        boolean active,
        String notes,
        String createdBy,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        String nationalId,
        String nationalIdType,
        String company,
        String position,
        ContactChannels channels,
        List<String> tags,
        String memberUserId,
        boolean provisional) {

    public static final String DEFAULT_NATIONAL_ID_TYPE = "RUT";

    /** A contact with only the original fields; the contact book fields are empty. */
    public Contact(
            String id,
            String tenantCode,
            String name,
            String role,
            String phone,
            List<CallMethod> methods,
            boolean active,
            String notes,
            String createdBy,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt) {
        this(id, tenantCode, name, role, phone, methods, active, notes, createdBy, createdAt, updatedAt,
                null, DEFAULT_NATIONAL_ID_TYPE, null, null, ContactChannels.NONE, List.of(), null, false);
    }

    /** This contact as a store saves it: given id, author and timestamps, and no null collections. */
    public Contact stored(String newId, String author, OffsetDateTime created, OffsetDateTime updated) {
        return new Contact(newId, tenantCode, name, role, phone,
                methods == null ? List.of() : List.copyOf(methods), active, notes, author, created, updated,
                nationalId, nationalIdType == null ? DEFAULT_NATIONAL_ID_TYPE : nationalIdType, company, position,
                channels == null ? ContactChannels.NONE : channels, tags == null ? List.of() : List.copyOf(tags),
                memberUserId, provisional);
    }
}
