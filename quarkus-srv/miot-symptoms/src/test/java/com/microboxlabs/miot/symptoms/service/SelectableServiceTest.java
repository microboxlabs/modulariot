package com.microboxlabs.miot.symptoms.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.domain.Selectable;
import com.microboxlabs.miot.symptoms.domain.SelectableOption;
import com.microboxlabs.miot.symptoms.domain.SelectionMode;
import com.microboxlabs.miot.symptoms.dto.SelectableBindingsRequest;
import com.microboxlabs.miot.symptoms.dto.SelectableRequest;
import com.microboxlabs.miot.symptoms.persistence.SelectableRepository;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class SelectableServiceTest {

    private static final String TENANT = "tenant-a";

    @Test
    void firstListSeedsTheDefaults() {
        var repo = new FakeRepository();
        var service = new SelectableService(repo, new AuditService(new TreatmentServiceTest.FakeAudit()));

        List<Selectable> listed = service.list(TENANT);

        assertEquals(5, listed.size());
        assertTrue(listed.stream().anyMatch(s -> s.key().equals("call_result") && s.options().size() == 5));
        assertTrue(listed.stream().anyMatch(s -> s.key().equals("call_tags") && s.mode() == SelectionMode.MULTIPLE));
        assertEquals(5, service.list(TENANT).size(), "second list does not seed again");
    }

    @Test
    void replaceAssignsIdsAndRejectsDuplicatesAndBlankNames() {
        var repo = new FakeRepository();
        var audit = new TreatmentServiceTest.FakeAudit();
        var service = new SelectableService(repo, new AuditService(audit));

        Selectable saved = service.replace(TENANT, "owner@example.com", "call_result",
                new SelectableRequest("Resultado", null, SelectionMode.SINGLE, List.of(
                        new SelectableOption("keep_me", "Contesta", ""),
                        new SelectableOption(null, "No contesta", null))));

        assertEquals("keep_me", saved.options().get(0).id());
        assertNotNull(saved.options().get(1).id());
        assertTrue(saved.options().get(1).id().startsWith("opt_"));
        assertEquals("selectable.replaced", audit.events.get(0).action());

        assertThrows(IllegalArgumentException.class, () -> service.replace(TENANT, "o", "call_result",
                new SelectableRequest("x", null, SelectionMode.SINGLE, List.of(
                        new SelectableOption("dup", "a", ""), new SelectableOption("dup", "b", "")))));
        assertThrows(IllegalArgumentException.class, () -> service.replace(TENANT, "o", "call_result",
                new SelectableRequest("x", null, SelectionMode.SINGLE, List.of(new SelectableOption(null, " ", "")))));
        assertThrows(IllegalArgumentException.class, () -> service.replace(TENANT, "o", "call_result",
                new SelectableRequest("x", null, null, List.of())));
        assertThrows(IllegalArgumentException.class, () -> service.replace(TENANT, "o", "Bad Key",
                new SelectableRequest("x", null, SelectionMode.SINGLE, List.of())));
    }

    @Test
    void getFallsBackToADefaultAndFailsOnUnknownKeys() {
        var repo = new FakeRepository();
        var service = new SelectableService(repo, new AuditService(new TreatmentServiceTest.FakeAudit()));

        assertEquals("ignore_reason", service.get(TENANT, "ignore_reason").key());
        assertThrows(NoSuchElementException.class, () -> service.get(TENANT, "nope"));
    }

    @Test
    void bindingsMustPointAtAKnownSelectable() {
        var repo = new FakeRepository();
        var service = new SelectableService(repo, new AuditService(new TreatmentServiceTest.FakeAudit()));

        Map<String, String> out = service.updateBindings(TENANT, "o",
                new SelectableBindingsRequest(Map.of("who_to_call_result", "call_result")));
        assertEquals("call_result", out.get("who_to_call_result"));

        assertThrows(IllegalArgumentException.class, () -> service.updateBindings(TENANT, "o",
                new SelectableBindingsRequest(Map.of("field", "missing_list"))));
        assertThrows(IllegalArgumentException.class, () -> service.updateBindings(TENANT, "o",
                new SelectableBindingsRequest(Map.of())));
    }

    private static final class FakeRepository extends SelectableRepository {
        final Map<String, Selectable> rows = new LinkedHashMap<>();
        final Map<String, String> bindings = new LinkedHashMap<>();

        FakeRepository() {
            super(null);
        }

        @Override
        public List<Selectable> list(String tenantCode) {
            return new ArrayList<>(rows.values());
        }

        @Override
        public Optional<Selectable> find(String tenantCode, String key) {
            return Optional.ofNullable(rows.get(key));
        }

        @Override
        public Selectable upsert(Selectable s) {
            Selectable saved = new Selectable(s.tenantCode(), s.key(), s.name(), s.description(), s.mode(),
                    s.options(), s.updatedBy(), OffsetDateTime.now());
            rows.put(s.key(), saved);
            return saved;
        }

        @Override
        public boolean insertIfAbsent(Selectable s) {
            return rows.putIfAbsent(s.key(), s) == null;
        }

        @Override
        public Map<String, String> listBindings(String tenantCode) {
            return new LinkedHashMap<>(bindings);
        }

        @Override
        public void upsertBinding(String tenantCode, String fieldKey, String selectableKey, String actor) {
            bindings.put(fieldKey, selectableKey);
        }
    }
}
