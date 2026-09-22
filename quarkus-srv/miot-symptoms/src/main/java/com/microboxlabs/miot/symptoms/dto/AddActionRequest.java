package com.microboxlabs.miot.symptoms.dto;

import com.microboxlabs.miot.symptoms.domain.ActionKind;
import com.microboxlabs.miot.symptoms.domain.CallMethod;
import java.util.List;
import java.util.Map;

/**
 * Body to append one action to an open treatment. For a {@code CALL} either
 * {@code contactId} (a tenant contact) or {@code contactName} (ad hoc, e.g. the
 * trip's driver) identifies who was called. {@code outcomeKey} is an option id
 * from the {@code call_result} / {@code ignore_reason} / {@code invalidate_reason}
 * selectable and {@code outcomeLabel} its display text at the time of the action.
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
        String note,
        List<String> tags,
        Map<String, Object> details) {
}
