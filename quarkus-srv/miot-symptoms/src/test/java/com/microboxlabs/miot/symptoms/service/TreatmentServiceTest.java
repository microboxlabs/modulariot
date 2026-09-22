package com.microboxlabs.miot.symptoms.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.domain.ActionKind;
import com.microboxlabs.miot.symptoms.domain.CallMethod;
import com.microboxlabs.miot.symptoms.domain.Contact;
import com.microboxlabs.miot.symptoms.domain.TreatmentStatus;
import com.microboxlabs.miot.symptoms.domain.TreatmentType;
import com.microboxlabs.miot.symptoms.dto.AddActionRequest;
import com.microboxlabs.miot.symptoms.dto.CloseTreatmentRequest;
import com.microboxlabs.miot.symptoms.dto.OpenTreatmentRequest;
import com.microboxlabs.miot.symptoms.dto.TreatmentView;
import com.microboxlabs.miot.symptoms.store.InMemoryAuditStore;
import com.microboxlabs.miot.symptoms.store.InMemoryContactStore;
import com.microboxlabs.miot.symptoms.store.InMemoryTreatmentStore;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class TreatmentServiceTest {

    private static final String TENANT = "tenant-a";
    private static final String ACTOR = "ops@example.com";

    private InMemoryTreatmentStore treatments;
    private InMemoryContactStore contacts;
    private InMemoryAuditStore audit;
    private TreatmentService service;

    @BeforeEach
    void setUp() {
        treatments = new InMemoryTreatmentStore();
        contacts = new InMemoryContactStore();
        audit = new InMemoryAuditStore();
        service = new TreatmentService(treatments, contacts, new DemoSeeder(false, contacts, treatments),
                new AuditService(audit));
    }

    @Test
    void openCreatesThenResumesTheSameOperatorsEpisode() {
        var first = service.open(TENANT, ACTOR, 42L, open(TreatmentType.CALL));
        var again = service.open(TENANT, ACTOR, 42L, open(TreatmentType.IGNORE_CONDITION));
        var otherOperator = service.open(TENANT, "other@example.com", 42L, open(TreatmentType.CALL));

        assertTrue(first.created());
        assertFalse(again.created());
        assertEquals(first.treatment().id(), again.treatment().id());
        assertNotEquals(first.treatment().id(), otherOperator.treatment().id());
        assertEquals(2, audit.list(TENANT, null, null, 42L, null, 10).size());
    }

    @Test
    void openRequiresAType() {
        assertThrows(IllegalArgumentException.class,
                () -> service.open(TENANT, ACTOR, 42L, new OpenTreatmentRequest(null, null, null, null)));
        assertThrows(IllegalArgumentException.class, () -> service.open(TENANT, ACTOR, 42L, null));
    }

    @Test
    void callActionCopiesTheContactAndFeedsStatistics() {
        Contact camila = contacts.insert(new Contact(null, TENANT, "Camila", "Jefe de operaciones", "+56900000101",
                List.of(CallMethod.PHONE), true, null, ACTOR, null, null));
        String id = service.open(TENANT, ACTOR, 42L, open(TreatmentType.CALL)).treatment().id();

        var call = service.addAction(TENANT, ACTOR, id, call(camila.id(), null, false));
        service.addAction(TENANT, ACTOR, id, call(camila.id(), null, true));

        assertEquals(1, call.seq());
        assertEquals("Camila", call.contactName());
        assertEquals("+56900000101", call.contactPhone());
        assertEquals(List.of("call_tags_3"), call.tags());
        var stats = treatments.contactStats(TENANT);
        assertEquals(1, stats.size());
        assertEquals(1, stats.get(0).answered());
        assertEquals(1, stats.get(0).missed());
    }

    @Test
    void callNeedsSomeoneAndDecisionsNeedAReason() {
        String id = service.open(TENANT, ACTOR, 42L, open(TreatmentType.CALL)).treatment().id();
        assertThrows(IllegalArgumentException.class, () -> service.addAction(TENANT, ACTOR, id, call(null, null, true)));
        assertThrows(IllegalArgumentException.class, () -> service.addAction(TENANT, ACTOR, id, call("missing", null, true)));
        assertThrows(IllegalArgumentException.class, () -> service.addAction(TENANT, ACTOR, id,
                new AddActionRequest(ActionKind.IGNORE, null, null, null, null, null, null, null, null, null, null,
                        null, null, null)));
        assertThrows(IllegalArgumentException.class, () -> service.addAction(TENANT, ACTOR, id,
                new AddActionRequest(null, null, null, null, null, null, null, null, null, null, null, null, null,
                        null)));
    }

    @Test
    void anEpisodeOpenedAsACallCanEndIgnored() {
        String id = service.open(TENANT, ACTOR, 42L, open(TreatmentType.CALL)).treatment().id();
        service.addAction(TENANT, ACTOR, id, call(null, "Conductor del viaje", false));
        service.addAction(TENANT, ACTOR, id, new AddActionRequest(ActionKind.IGNORE, null, null, null, null, null,
                "ignore_reason_2", "Zona de sombra GPS conocida", null, null, null, "nota", null,
                Map.of("durationSeconds", 1800)));

        TreatmentView closed = service.close(TENANT, ACTOR, id, new CloseTreatmentRequest("ignored", null));

        assertEquals(TreatmentStatus.CLOSED, closed.status());
        assertEquals(List.of(ActionKind.CALL, ActionKind.IGNORE), closed.actions().stream().map(a -> a.kind()).toList());
        assertEquals("treatment.closed", audit.list(TENANT, null, null, null, null, 1).get(0).action());
    }

    @Test
    void closeNeedsAnActionAndAnOpenEpisode() {
        String id = service.open(TENANT, ACTOR, 42L, open(TreatmentType.CALL)).treatment().id();
        assertThrows(IllegalStateException.class, () -> service.close(TENANT, ACTOR, id, null));

        service.cancel(TENANT, ACTOR, id, "dismissed");

        assertThrows(IllegalStateException.class, () -> service.cancel(TENANT, ACTOR, id, null));
        assertThrows(IllegalStateException.class, () -> service.addAction(TENANT, ACTOR, id, call(null, "x", true)));
        assertThrows(NoSuchElementException.class, () -> service.get(TENANT, "nope"));
        assertThrows(NoSuchElementException.class, () -> service.get("tenant-b", id));
        assertTrue(service.open(TENANT, ACTOR, 42L, open(TreatmentType.CALL)).created(), "cancelled is not resumed");
    }

    @Test
    void listForSymptomIsScopedAndOrdered() {
        String a = service.open(TENANT, ACTOR, 42L, open(TreatmentType.CALL)).treatment().id();
        service.addAction(TENANT, ACTOR, a, call(null, "x", true));
        service.close(TENANT, ACTOR, a, null);
        String b = service.open(TENANT, ACTOR, 42L, open(TreatmentType.CALL)).treatment().id();
        service.open("tenant-b", ACTOR, 42L, open(TreatmentType.CALL));

        List<TreatmentView> list = service.listForSymptom(TENANT, 42L);

        assertEquals(List.of(a, b), list.stream().map(TreatmentView::id).toList());
        assertEquals(1, list.get(0).actions().size());
    }

    private static OpenTreatmentRequest open(TreatmentType type) {
        return new OpenTreatmentRequest(type, "AB12", "trip-1", null);
    }

    private static AddActionRequest call(String contactId, String contactName, boolean answered) {
        return new AddActionRequest(ActionKind.CALL, contactId, contactName, null, null, CallMethod.PHONE,
                answered ? "result_commits" : "result_no_answer", answered ? "Contesta" : "No contesta", answered,
                answered ? 61 : 0, "mensaje", "nota", List.of("call_tags_3", " "), null);
    }
}
