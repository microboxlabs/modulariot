package com.microboxlabs.miot.symptoms.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.selectable.Selectable;
import com.microboxlabs.miot.core.selectable.SelectableChanged;
import com.microboxlabs.miot.core.selectable.SelectableOption;
import com.microboxlabs.miot.core.selectable.SelectionMode;
import com.microboxlabs.miot.symptoms.domain.AuditEvent;
import com.microboxlabs.miot.symptoms.store.InMemoryAuditStore;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class TreatmentFormSelectablesTest {

    private static final String TENANT = "tenant-a";

    @Test
    void providesTheTreatmentFormListsWithStableCallResultIds() {
        List<Selectable> lists = new TreatmentFormSelectables().forTenant(TENANT);

        assertEquals(List.of("who_to_call", "call_result", "call_tags", "ignore_reason", "ignore_duration",
                "invalidate_reason"), lists.stream().map(Selectable::key).toList());
        assertEquals(List.of("result_commits", "result_corrected", "result_rejects", "result_no_answer",
                "result_voicemail"), lists.get(1).options().stream().map(SelectableOption::id).toList());
        assertEquals(SelectionMode.MULTIPLE, lists.get(2).mode());
        assertTrue(lists.stream().allMatch(s -> TENANT.equals(s.tenantCode())));
    }

    @Test
    void selectableWritesLandInTheAuditLog() {
        AuditService audit = new AuditService(new InMemoryAuditStore());

        new SelectableAudit(audit).onChanged(new SelectableChanged(
                TENANT, "owner@example.com", "selectable.deleted", "call_tags", Map.of()));

        assertEquals(List.of("selectable.deleted"), audit.list(TENANT, "selectable", "call_tags", null, null, 10)
                .stream().map(AuditEvent::action).toList());
    }
}
