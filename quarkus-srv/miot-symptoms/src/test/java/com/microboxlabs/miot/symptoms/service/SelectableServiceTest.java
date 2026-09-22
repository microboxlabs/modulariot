package com.microboxlabs.miot.symptoms.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.domain.Selectable;
import com.microboxlabs.miot.symptoms.domain.SelectableOption;
import com.microboxlabs.miot.symptoms.domain.SelectionMode;
import com.microboxlabs.miot.symptoms.dto.SelectableBindingsRequest;
import com.microboxlabs.miot.symptoms.dto.SelectableRequest;
import com.microboxlabs.miot.symptoms.store.InMemoryAuditStore;
import com.microboxlabs.miot.symptoms.store.InMemorySelectableStore;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SelectableServiceTest {

    private static final String TENANT = "tenant-a";

    private SelectableService service;

    @BeforeEach
    void setUp() {
        service = new SelectableService(new InMemorySelectableStore(), new AuditService(new InMemoryAuditStore()));
    }

    @Test
    void firstListSeedsTheFormDefaults() {
        List<Selectable> listed = service.list(TENANT);

        assertEquals(List.of("who_to_call", "call_result", "call_tags", "ignore_reason", "ignore_duration",
                "invalidate_reason"), listed.stream().map(Selectable::key).toList());
        Selectable callResult = listed.get(1);
        assertEquals(List.of("result_commits", "result_corrected", "result_rejects", "result_no_answer",
                "result_voicemail"), callResult.options().stream().map(SelectableOption::id).toList());
        assertEquals(SelectionMode.MULTIPLE, listed.get(2).mode());
    }

    @Test
    void deletingEverythingDoesNotReseedButResetDoes() {
        service.list(TENANT).forEach(s -> service.delete(TENANT, "o", s.key()));
        assertTrue(service.list(TENANT).isEmpty());

        assertEquals(6, service.reset(TENANT, "o").size());
        assertFalse(service.delete(TENANT, "o", "never_existed"));
    }

    @Test
    void replaceKeepsGivenIdsAssignsMissingOnesAndRejectsBadInput() {
        Selectable saved = service.replace(TENANT, "o", "sel_abc1234", new SelectableRequest("Mi lista", null,
                SelectionMode.SINGLE, List.of(new SelectableOption("opt_keep", "A", ""),
                        new SelectableOption(null, "B", null))));

        assertEquals("opt_keep", saved.options().get(0).id());
        assertTrue(saved.options().get(1).id().startsWith("opt_"));
        assertThrows(IllegalArgumentException.class, () -> service.replace(TENANT, "o", "x", new SelectableRequest(
                "x", null, SelectionMode.SINGLE, List.of())));
        assertThrows(IllegalArgumentException.class, () -> service.replace(TENANT, "o", "abc", new SelectableRequest(
                "x", null, SelectionMode.SINGLE, List.of(new SelectableOption("d", "a", ""),
                        new SelectableOption("d", "b", "")))));
        assertThrows(IllegalArgumentException.class, () -> service.replace(TENANT, "o", "abc", new SelectableRequest(
                "x", null, null, List.of())));
        assertThrows(NoSuchElementException.class, () -> service.get(TENANT, "missing_key"));
    }

    @Test
    void bindingsMustPointAtAnExistingSelectable() {
        assertEquals("call_tags",
                service.updateBindings(TENANT, "o", new SelectableBindingsRequest(Map.of("who_to_call", "call_tags")))
                        .get("who_to_call"));
        assertThrows(IllegalArgumentException.class, () -> service.updateBindings(TENANT, "o",
                new SelectableBindingsRequest(Map.of("who_to_call", "missing_list"))));
    }
}
