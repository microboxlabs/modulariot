package com.microboxlabs.miot.symptoms.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.domain.ActionKind;
import com.microboxlabs.miot.symptoms.domain.AuditEvent;
import com.microboxlabs.miot.symptoms.domain.CallMethod;
import com.microboxlabs.miot.symptoms.domain.Contact;
import com.microboxlabs.miot.symptoms.domain.TreatmentStatus;
import com.microboxlabs.miot.symptoms.domain.TreatmentType;
import com.microboxlabs.miot.symptoms.dto.AddActionRequest;
import com.microboxlabs.miot.symptoms.dto.CloseTreatmentRequest;
import com.microboxlabs.miot.symptoms.dto.OpenTreatmentRequest;
import com.microboxlabs.miot.symptoms.dto.TreatmentView;
import com.microboxlabs.miot.symptoms.store.AuditStore;
import com.microboxlabs.miot.symptoms.store.InMemoryAuditStore;
import com.microboxlabs.miot.symptoms.store.InMemoryContactStore;
import com.microboxlabs.miot.symptoms.store.InMemoryTreatmentStore;
import java.time.OffsetDateTime;
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
    void abandonmentIsEmptyOnlyOwnedAndIdempotent() {
        String empty = service.open(TENANT, ACTOR, 991L, open(TreatmentType.CALL)).treatment().id();
        service.abandon(TENANT, "another-operator", empty);
        service.abandon("another-tenant", ACTOR, empty);
        assertEquals(TreatmentStatus.OPEN, service.get(TENANT, empty).status());
        service.abandon(TENANT, ACTOR, empty);
        service.abandon(TENANT, ACTOR, empty);
        assertEquals(TreatmentStatus.CANCELLED, service.get(TENANT, empty).status());
        String recorded = service.open(TENANT, ACTOR, 992L, open(TreatmentType.CALL)).treatment().id();
        service.addAction(TENANT, ACTOR, recorded, call(null, "Synthetic contact", true));
        service.abandon(TENANT, ACTOR, recorded);
        assertEquals(TreatmentStatus.OPEN, service.get(TENANT, recorded).status());
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
        OpenTreatmentRequest noType = new OpenTreatmentRequest(null, null, null, null);
        assertThrows(IllegalArgumentException.class, () -> service.open(TENANT, ACTOR, 42L, noType));
        assertThrows(IllegalArgumentException.class, () -> service.open(TENANT, ACTOR, 42L, null));
    }

    @Test
    void callActionCopiesTheContactAndFeedsStatistics() {
        Contact camila = contacts.insert(new Contact(null, TENANT, "Camila", "Jefe de operaciones", "+12025550101",
                List.of(CallMethod.PHONE), true, null, ACTOR, null, null));
        String id = service.open(TENANT, ACTOR, 42L, open(TreatmentType.CALL)).treatment().id();

        var call = service.addAction(TENANT, ACTOR, id, call(camila.id(), null, false));
        service.addAction(TENANT, ACTOR, id, call(camila.id(), null, true));

        assertEquals(1, call.seq());
        assertEquals("Camila", call.contactName());
        assertEquals("+12025550101", call.contactPhone());
        assertEquals(List.of("call_tags_3"), call.tags());
        var stats = treatments.contactStats(TENANT);
        assertEquals(1, stats.size());
        assertEquals(1, stats.get(0).answered());
        assertEquals(1, stats.get(0).missed());
    }

    @Test
    void callNeedsSomeoneAndDecisionsNeedAReason() {
        String id = service.open(TENANT, ACTOR, 42L, open(TreatmentType.CALL)).treatment().id();
        AddActionRequest nobody = call(null, null, true);
        AddActionRequest unknownContact = call("missing", null, true);
        AddActionRequest ignoreWithoutReason = new AddActionRequest(ActionKind.IGNORE, null, null, null, null, null,
                null, null, null, null, null, null, null, null);
        AddActionRequest noKind = new AddActionRequest(null, null, null, null, null, null, null, null, null, null,
                null, null, null, null);

        assertThrows(IllegalArgumentException.class, () -> service.addAction(TENANT, ACTOR, id, nobody));
        assertThrows(IllegalArgumentException.class, () -> service.addAction(TENANT, ACTOR, id, unknownContact));
        assertThrows(IllegalArgumentException.class, () -> service.addAction(TENANT, ACTOR, id, ignoreWithoutReason));
        assertThrows(IllegalArgumentException.class, () -> service.addAction(TENANT, ACTOR, id, noKind));
    }

    @Test
    void callToASavedContactNeedsOneOfItsChannels() {
        Contact camila = contacts.insert(new Contact(null, TENANT, "Camila", "Jefe de operaciones", "+12025550101",
                List.of(CallMethod.PHONE), true, null, ACTOR, null, null));
        String id = service.open(TENANT, ACTOR, 42L, open(TreatmentType.CALL)).treatment().id();

        AddActionRequest unsupported = call(camila.id(), null, CallMethod.WHATSAPP);
        IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
                () -> service.addAction(TENANT, ACTOR, id, unsupported));
        assertEquals("contact " + camila.id() + " has no WHATSAPP channel; its channels: PHONE", e.getMessage());

        AddActionRequest missingMethod = call(camila.id(), null, (CallMethod) null);
        assertThrows(IllegalArgumentException.class,
                () -> service.addAction(TENANT, ACTOR, id, missingMethod));

        assertEquals(CallMethod.PHONE, service.addAction(TENANT, ACTOR, id, call(camila.id(), null, true)).method());
        // The driver and a new number are not in the book: any channel is accepted.
        assertEquals(CallMethod.WHATSAPP,
                service.addAction(TENANT, ACTOR, id, call(null, "Conductor del viaje", CallMethod.WHATSAPP)).method());
    }

    @Test
    void aStepSkipIsStoredWithWhoWhenAndWhy() {
        String id = service.open(TENANT, ACTOR, -42L, open(TreatmentType.CALL)).treatment().id();

        var skip = service.addAction(TENANT, ACTOR, id, skip(2, "No contesta"));

        assertEquals(ActionKind.NOTE, skip.kind());
        assertEquals(2, skip.details().get(TreatmentService.SKIP_TO_STEP));
        assertEquals("No contesta", skip.note());
        assertEquals(ACTOR, skip.performedBy());
        assertNotNull(skip.performedAt());
        var listed = service.listForSymptom(TENANT, -42L).get(0);
        assertEquals(TreatmentStatus.OPEN, listed.status());
        assertEquals(List.of(skip.id()), listed.actions().stream().map(a -> a.id()).toList());
        AuditEvent audited = audit.list(TENANT, null, null, -42L, null, 1).get(0);
        assertEquals("treatment.action_added", audited.action());
        assertEquals(2, audited.details().get(TreatmentService.SKIP_TO_STEP));
        assertEquals("No contesta", audited.details().get("note"));
    }

    @Test
    void aStepSkipNeedsALaterStepAReasonAndAnEngineCase() {
        String engine = service.open(TENANT, ACTOR, -42L, open(TreatmentType.CALL)).treatment().id();
        String legacy = service.open(TENANT, ACTOR, 42L, open(TreatmentType.CALL)).treatment().id();

        var firstStep = skip(1, "x");
        var noReason = skip(2, " ");
        var valid = skip(2, "x");
        assertThrows(IllegalArgumentException.class, () -> service.addAction(TENANT, ACTOR, engine, firstStep));
        assertThrows(IllegalArgumentException.class, () -> service.addAction(TENANT, ACTOR, engine, noReason));
        AddActionRequest notANumber = new AddActionRequest(ActionKind.NOTE, null, null, null, null, null, null,
                null, null, null, null, "x", null, Map.of(TreatmentService.SKIP_TO_STEP, "2"));
        assertThrows(IllegalArgumentException.class, () -> service.addAction(TENANT, ACTOR, engine, notANumber));
        assertThrows(IllegalArgumentException.class, () -> service.addAction(TENANT, ACTOR, legacy, valid));
        assertTrue(service.listForSymptom(TENANT, -42L).get(0).actions().isEmpty());
    }

    @Test
    void retryingASkipReturnsTheSavedNoteWithoutAnotherAuditEvent() {
        String id = service.open(TENANT, ACTOR, -42L, open(TreatmentType.CALL)).treatment().id();
        var request = new AddActionRequest(ActionKind.NOTE, null, null, null, null, null, null, null,
                null, null, null, "No contesta", null, Map.of(TreatmentService.SKIP_TO_STEP, 2,
                        "level", 3, "version", "4", "skipId", "fc70f756-bf67-4203-9ccd-e1f7d3664a12"));
        var saved = service.addAction(TENANT, ACTOR, id, request);
        var restarted = new TreatmentService(treatments, contacts, new DemoSeeder(false, contacts, treatments),
                new AuditService(audit));

        assertEquals(saved, restarted.addAction(TENANT, ACTOR, id, request));
        assertEquals(1, restarted.get(TENANT, id).actions().size());
        var events = audit.list(TENANT, "treatment", id, null, null, 10);
        assertEquals(2, events.size(), "one open and one action audit event");
        assertEquals("4", events.get(0).details().get("version"));
        assertEquals(3, events.get(0).details().get("level"));
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
    void aHandlingRecordClosesTheEpisodeWithoutACall() {
        String id = service.open(TENANT, ACTOR, -42L, open(TreatmentType.CALL)).treatment().id();

        var saved = service.addAction(TENANT, ACTOR, id, handling("handling_outcome_1", "Verificado por GPS",
                "Detenido en el área de descanso"));
        TreatmentView closed = service.close(TENANT, ACTOR, id,
                new CloseTreatmentRequest("Gestión: Verificado por GPS", null));

        assertTrue(saved.recordsHandling());
        assertEquals(ACTOR, saved.performedBy());
        assertEquals(TreatmentStatus.CLOSED, closed.status());
        assertEquals("Gestión: Verificado por GPS", closed.resolution());
        var added = audit.list(TENANT, null, null, null, null, 2).get(1);
        assertEquals("treatment.action_added", added.action());
        assertEquals("handling_outcome_1", added.details().get("outcomeKey"));
        assertEquals("Detenido en el área de descanso", added.details().get("note"));
    }

    @Test
    void aHandlingRecordNeedsANote() {
        String id = service.open(TENANT, ACTOR, -42L, open(TreatmentType.CALL)).treatment().id();
        AddActionRequest noNote = handling("handling_outcome_2", "Contacto por otro medio", " ");

        assertThrows(IllegalArgumentException.class, () -> service.addAction(TENANT, ACTOR, id, noNote));
        assertFalse(service.addAction(TENANT, ACTOR, id, new AddActionRequest(ActionKind.NOTE, null, null, null,
                null, null, null, null, null, null, null, "nota libre", null, null)).recordsHandling());
    }

    @Test
    void closeNeedsAnActionAndAnOpenEpisode() {
        String id = service.open(TENANT, ACTOR, 42L, open(TreatmentType.CALL)).treatment().id();
        assertThrows(IllegalStateException.class, () -> service.close(TENANT, ACTOR, id, null));

        service.cancel(TENANT, ACTOR, id, "dismissed");

        assertThrows(IllegalStateException.class, () -> service.cancel(TENANT, ACTOR, id, null));
        AddActionRequest lateCall = call(null, "x", true);
        assertThrows(IllegalStateException.class, () -> service.addAction(TENANT, ACTOR, id, lateCall));
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

    @Test
    void failedAuditAppendDoesNotFailTheChange() {
        AuditStore broken = new AuditStore() {
            @Override
            public AuditEvent append(AuditEvent event) {
                throw new IllegalStateException("database down");
            }

            @Override
            public List<AuditEvent> list(String tenantCode, String entityType, String entityId, Long symptomId,
                    OffsetDateTime before, String beforeId, int limit) {
                return List.of();
            }
        };
        var withBrokenAudit = new TreatmentService(treatments, contacts, new DemoSeeder(false, contacts, treatments),
                new AuditService(broken));

        var opened = withBrokenAudit.open(TENANT, ACTOR, 43L, open(TreatmentType.CALL));

        assertTrue(opened.created());
        assertTrue(treatments.find(TENANT, opened.treatment().id()).isPresent());
    }

    private static AddActionRequest handling(String key, String label, String note) {
        return new AddActionRequest(ActionKind.NOTE, null, null, null, null, null, key, label, null, null, null,
                note, null, null);
    }

    private static AddActionRequest skip(int toStep, String reason) {
        return new AddActionRequest(ActionKind.NOTE, null, null, null, null, null, null, null, null, null, null,
                reason, null, Map.of(TreatmentService.SKIP_TO_STEP, toStep, "level", 2));
    }

    private static OpenTreatmentRequest open(TreatmentType type) {
        return new OpenTreatmentRequest(type, "AB12", "trip-1", null);
    }

    private static AddActionRequest call(String contactId, String contactName, CallMethod method) {
        return new AddActionRequest(ActionKind.CALL, contactId, contactName, null, null, method, "result_no_answer",
                "No contesta", false, 0, null, null, null, null);
    }

    private static AddActionRequest call(String contactId, String contactName, boolean answered) {
        return new AddActionRequest(ActionKind.CALL, contactId, contactName, null, null, CallMethod.PHONE,
                answered ? "result_commits" : "result_no_answer", answered ? "Contesta" : "No contesta", answered,
                answered ? 61 : 0, "mensaje", "nota", List.of("call_tags_3", " "), null);
    }
}
