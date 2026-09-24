package com.microboxlabs.miot.symptoms.dto;

import com.microboxlabs.miot.symptoms.domain.CallMethod;
import java.util.List;

/** Body to create or update a contact. On update, null fields are left unchanged. */
public record ContactRequest(
        String name,
        String role,
        String phone,
        List<CallMethod> methods,
        Boolean active,
        String notes) {
}
