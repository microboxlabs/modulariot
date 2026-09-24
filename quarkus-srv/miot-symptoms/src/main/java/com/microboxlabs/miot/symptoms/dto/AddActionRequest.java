package com.microboxlabs.miot.symptoms.dto;

import com.microboxlabs.miot.symptoms.domain.ActionKind;
import com.microboxlabs.miot.symptoms.domain.CallMethod;
import java.util.List;
import java.util.Map;

/**
 * Body to append one action to an open treatment. For a {@code CALL} either
 * {@code contactId} (a tenant contact) or {@code contactName} (ad hoc, e.g. the
 * trip's driver) says who was called. {@code outcomeKey} is an option id from
 * the bound selectable and {@code outcomeLabel} its text at the time.
 */
public record AddActionRequest(
        ActionKind kind,
        String contactId,
        String contactName,
        String contactRole,
        String contactPhone,
        CallMethod method,
        String outcomeKey,
        String outcomeLabel,
        Boolean answered,
        Integer durationSeconds,
        String message,
        String note,
        List<String> tags,
        Map<String, Object> details) {
}
