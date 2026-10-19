package com.microboxlabs.miot.symptoms.dto;

import com.microboxlabs.miot.symptoms.domain.CallMethod;
import com.microboxlabs.miot.symptoms.domain.ContactChannels;
import java.util.List;

/**
 * Body to create or update a contact. On update, null fields are left
 * unchanged and an empty string clears a text field. {@code channels} and
 * {@code tags} replace the stored value when sent.
 */
public record ContactRequest(
        String name,
        String role,
        String phone,
        List<CallMethod> methods,
        Boolean active,
        String notes,
        String nationalId,
        String nationalIdType,
        String company,
        String position,
        ContactChannels channels,
        List<String> tags,
        String memberUserId,
        Boolean provisional) {

    /** A request with only the original fields. */
    public ContactRequest(
            String name, String role, String phone, List<CallMethod> methods, Boolean active, String notes) {
        this(name, role, phone, methods, active, notes, null, null, null, null, null, null, null, null);
    }
}
