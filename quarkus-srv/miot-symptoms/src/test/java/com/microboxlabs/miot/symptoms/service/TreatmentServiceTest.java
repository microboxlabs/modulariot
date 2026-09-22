package com.microboxlabs.miot.symptoms.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.domain.ActionKind;
import com.microboxlabs.miot.symptoms.domain.AuditEvent;
import com.microboxlabs.miot.symptoms.domain.CallMethod;
import com.microboxlabs.miot.symptoms.domain.Contact;
import com.microboxlabs.miot.symptoms.domain.ContactCallStats;
import com.microboxlabs.miot.symptoms.domain.Treatment;
import com.microboxlabs.miot.symptoms.domain.TreatmentAction;
import com.microboxlabs.miot.symptoms.domain.TreatmentStatus;
import com.microboxlabs.miot.symptoms.domain.TreatmentType;
import com.microboxlabs.miot.symptoms.dto.AddActionRequest;
import com.microboxlabs.miot.symptoms.dto.CloseTreatmentRequest;
import com.microboxlabs.miot.symptoms.dto.OpenTreatmentRequest;
import com.microboxlabs.miot.symptoms.dto.TreatmentView;
import com.microboxlabs.miot.symptoms.persistence.AuditEventRepository;
import com.microboxlabs.miot.symptoms.persistence.ContactRepository;
import com.microboxlabs.miot.symptoms.persistence.TreatmentRepository;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class TreatmentServiceTest {

    private static final String TENANT = "tenant-a";
    private static final String ACTOR = "ops@example.com";

    private FakeTreatments treatments;
    private FakeContacts contacts;
    private FakeMirror mirror;
    private FakeAudit audit;
    private TreatmentService service;

    @BeforeEach
    void setUp() {
        treatments = new FakeTreatments();
        contacts = new FakeContacts();
        mirror = new FakeMirror();
        audit = new FakeAudit();
        service = new TreatmentService(
                treatments, contacts, mirror, new SymptomsTenantResolver(Optional.of("tenant-a=sym-a")),
                null, new AuditService(audit));
    }

    @Test
    void openMirrorsFirstThenPersistsAndAudits() {
        var result = service.open(TENANT, ACTOR, 42L, new OpenTreatmentRequest(TreatmentType.CALL, "AB12", "trip", null, null));

        assertTrue(result.created());
        assertEquals(TreatmentStatus.OPEN, result.treatment().status());
        assertEquals(1000L, result.treatment().legacyTreatmentId());
        assertEquals("sym-a", mirror.writes.get(0).symptomsClientId());
        assertNull(mirror.writes.get(0).legacyTreatmentId());
        assertEquals("treatment.opened", audit.events.get(0).action());
        assertEquals(42L, audit.events.get(0).symptomId());
    }

    @Test
    void openRequiresAType() {
        assertThrows(IllegalArgumentException.class,
                () -> service.open(TENANT, ACTOR, 42L, new OpenTreatmentRequest(null, null, null, null, null)));
        assertThrows(IllegalArgumentException.class, () -> service.open(TENANT, ACTOR, 42L, null));
        assertTrue(mirror.writes.isEmpty());
    }

    @Test
    void openWithTheSameIdempotencyKeyReturnsTheExistingEpisode() {
        var first = service.open(TENANT, ACTOR, 42L, new OpenTreatmentRequest(TreatmentType.CALL, null, null, null, "k1"));
        var second = service.open(TENANT, ACTOR, 42L, new OpenTreatmentRequest(TreatmentType.CALL, null, null, null, "k1"));

        assertTrue(first.created());
        assertFalse(second.created());
        assertEquals(first.treatment().id(), second.treatment().id());
        assertEquals(1, mirror.writes.size());
        assertThrows(IllegalArgumentException.class,
                () -> service.open(TENANT, ACTOR, 43L, new OpenTreatmentRequest(TreatmentType.CALL, null, null, null, "k1")));
    }

    @Test
    void mirrorFailureLeavesNothingBehind() {
        mirror.fail = true;
        assertThrows(LegacyTreatmentMirror.MirrorException.class,
                () -> service.open(TENANT, ACTOR, 42L, new OpenTreatmentRequest(TreatmentType.CALL, null, null, null, null)));
        assertTrue(treatments.rows.isEmpty());
        assertTrue(audit.events.isEmpty());
    }

    @Test
    void callActionFillsContactFromTheDirectoryAndAudits() {
        contacts.rows.add(new Contact("c1", TENANT, "Camila", "Jefe de operaciones", "+56912345678",
                List.of(CallMethod.PHONE), true, null, ACTOR, null, null));
        var open = service.open(TENANT, ACTOR, 42L, new OpenTreatmentRequest(TreatmentType.CALL, null, null, null, null));

        var action = service.addAction(TENANT, ACTOR, open.treatment().id(), new AddActionRequest(
                ActionKind.CALL, "c1", null, null, null, CallMethod.PHONE, "call_result_4", "No contesta", false, 12,
                "no contesto", List.of("Prueba", " "), null));

        assertEquals(1, action.seq());
        assertEquals("Camila", action.contactName());
        assertEquals("Jefe de operaciones", action.contactRole());
        assertEquals("+56912345678", action.contactPhone());
        assertEquals(List.of("Prueba"), action.tags());
        assertEquals("treatment.action_added", audit.events.get(1).action());
    }

    @Test
    void callActionNeedsSomeoneToCall() {
        var open = service.open(TENANT, ACTOR, 42L, new OpenTreatmentRequest(TreatmentType.CALL, null, null, null, null));
        assertThrows(IllegalArgumentException.class, () -> service.addAction(TENANT, ACTOR, open.treatment().id(),
                new AddActionRequest(ActionKind.CALL, null, null, null, null, null, null, null, null, null, null, null, null)));
        assertThrows(IllegalArgumentException.class, () -> service.addAction(TENANT, ACTOR, open.treatment().id(),
                new AddActionRequest(ActionKind.CALL, "missing", null, null, null, null, null, null, null, null, null, null, null)));
    }

    @Test
    void actionKindMustMatchTheTreatmentType() {
        var open = service.open(TENANT, ACTOR, 42L, new OpenTreatmentRequest(TreatmentType.IGNORE_CONDITION, null, null, null, null));
        assertThrows(IllegalArgumentException.class, () -> service.addAction(TENANT, ACTOR, open.treatment().id(),
                new AddActionRequest(ActionKind.CALL, null, "x", null, null, null, null, null, null, null, null, null, null)));
        assertThrows(IllegalArgumentException.class, () -> service.addAction(TENANT, ACTOR, open.treatment().id(),
                new AddActionRequest(ActionKind.IGNORE, null, null, null, null, null, null, null, null, null, null, null, null)));

        var ignore = service.addAction(TENANT, ACTOR, open.treatment().id(), new AddActionRequest(
                ActionKind.IGNORE, null, null, null, null, null, "ignore_reason_2", "Zona de sombra GPS conocida",
                null, null, null, null, Map.of("duration", "30 minutos")));
        assertEquals(ActionKind.IGNORE, ignore.kind());
        var note = service.addAction(TENANT, ACTOR, open.treatment().id(), new AddActionRequest(
                ActionKind.NOTE, null, null, null, null, null, null, null, null, null, "una nota", null, null));
        assertEquals(2, note.seq());
    }

    @Test
    void closeMirrorsASummaryAndMovesToClosed() {
        var open = service.open(TENANT, ACTOR, 42L, new OpenTreatmentRequest(TreatmentType.CALL, "AB12", "trip", null, null));
        service.addAction(TENANT, ACTOR, open.treatment().id(), new AddActionRequest(
                ActionKind.CALL, null, "Carlos", "Conductor", null, CallMethod.WHATSAPP, "call_result_1",
                "Contesta — se compromete a corregir", true, 61, "ok", null, null));

        TreatmentView closed = service.close(TENANT, ACTOR, open.treatment().id(), new CloseTreatmentRequest("resolved", null, null, null));

        assertEquals(TreatmentStatus.CLOSED, closed.status());
        assertEquals("resolved", closed.resolution());
        assertEquals(1, closed.actions().size());
        var update = mirror.writes.get(1);
        assertEquals(1000L, update.legacyTreatmentId());
        assertEquals("Llamado a: Carlos (Conductor) · whatsapp", update.message());
        assertEquals("Contesta — se compromete a corregir · ok", update.driverResponse());
        assertEquals("treatment.closed", audit.events.get(audit.events.size() - 1).action());
    }

    @Test
    void closeAndCancelRequireAnOpenEpisode() {
        var open = service.open(TENANT, ACTOR, 42L, new OpenTreatmentRequest(TreatmentType.CALL, null, null, null, null));
        service.cancel(TENANT, ACTOR, open.treatment().id(), "dismissed");

        assertThrows(IllegalStateException.class, () -> service.close(TENANT, ACTOR, open.treatment().id(), null));
        assertThrows(IllegalStateException.class, () -> service.addAction(TENANT, ACTOR, open.treatment().id(),
                new AddActionRequest(ActionKind.NOTE, null, null, null, null, null, null, null, null, null, "n", null, null)));
        assertThrows(NoSuchElementException.class, () -> service.close(TENANT, ACTOR, UUID.randomUUID().toString(), null));
        assertEquals(1, mirror.writes.size(), "cancel does not touch the legacy row");
    }

    @Test
    void summaryOfAnEmptyEpisodeIsNull() {
        assertNull(TreatmentService.summarize(List.of(), true));
        assertNull(TreatmentService.summarize(List.of(), false));
    }

    // ---- fakes -------------------------------------------------------------

    private static final class FakeTreatments extends TreatmentRepository {
        final List<Treatment> rows = new ArrayList<>();
        final List<TreatmentAction> actions = new ArrayList<>();

        FakeTreatments() {
            super(null);
        }

        @Override
        public Treatment insert(Treatment t) {
            Treatment saved = new Treatment(UUID.randomUUID().toString(), t.tenantCode(), t.symptomId(), t.assetId(),
                    t.tripId(), t.type(), TreatmentStatus.OPEN, t.openedBy(), OffsetDateTime.now(), null, null, null,
                    t.note(), t.legacyTreatmentId(), t.idempotencyKey(), OffsetDateTime.now());
            rows.add(saved);
            return saved;
        }

        @Override
        public Optional<Treatment> findById(String tenantCode, String id) {
            return rows.stream().filter(t -> t.tenantCode().equals(tenantCode) && t.id().equals(id)).findFirst();
        }

        @Override
        public Optional<Treatment> findByIdempotencyKey(String tenantCode, String key) {
            return rows.stream().filter(t -> t.tenantCode().equals(tenantCode) && key.equals(t.idempotencyKey())).findFirst();
        }

        @Override
        public List<Treatment> listBySymptom(String tenantCode, long symptomId) {
            return rows.stream().filter(t -> t.tenantCode().equals(tenantCode) && t.symptomId() == symptomId).toList();
        }

        @Override
        public Optional<Treatment> transition(String tenantCode, String id, TreatmentStatus status, String actor,
                String resolution, String note) {
            for (int i = 0; i < rows.size(); i++) {
                Treatment t = rows.get(i);
                if (t.id().equals(id) && t.status() == TreatmentStatus.OPEN) {
                    Treatment moved = new Treatment(t.id(), t.tenantCode(), t.symptomId(), t.assetId(), t.tripId(),
                            t.type(), status, t.openedBy(), t.openedAt(), actor, OffsetDateTime.now(), resolution,
                            note == null ? t.note() : note, t.legacyTreatmentId(), t.idempotencyKey(), OffsetDateTime.now());
                    rows.set(i, moved);
                    return Optional.of(moved);
                }
            }
            return Optional.empty();
        }

        @Override
        public TreatmentAction insertAction(TreatmentAction a) {
            int seq = (int) actions.stream().filter(x -> x.treatmentId().equals(a.treatmentId())).count() + 1;
            TreatmentAction saved = new TreatmentAction(UUID.randomUUID().toString(), a.treatmentId(), a.tenantCode(),
                    seq, a.kind(), a.contactId(), a.contactName(), a.contactRole(), a.contactPhone(), a.method(),
                    a.outcomeKey(), a.outcomeLabel(), a.answered(), a.durationSeconds(), a.note(), a.tags(),
                    a.details(), a.performedBy(), OffsetDateTime.now());
            actions.add(saved);
            return saved;
        }

        @Override
        public List<TreatmentAction> listActions(String tenantCode, List<String> treatmentIds) {
            return actions.stream().filter(a -> treatmentIds.contains(a.treatmentId())).toList();
        }

        @Override
        public List<ContactCallStats> contactStats(String tenantCode) {
            return List.of();
        }
    }

    private static final class FakeContacts extends ContactRepository {
        final List<Contact> rows = new ArrayList<>();

        FakeContacts() {
            super(null);
        }

        @Override
        public Optional<Contact> findById(String tenantCode, String id) {
            return rows.stream().filter(c -> c.id().equals(id)).findFirst();
        }
    }

    private static final class FakeMirror implements LegacyTreatmentMirror {
        final List<Write> writes = new ArrayList<>();
        boolean fail;

        @Override
        public long upsert(Write write) {
            if (fail) {
                throw new MirrorException("down");
            }
            writes.add(write);
            return write.legacyTreatmentId() == null ? 1000L : write.legacyTreatmentId();
        }
    }

    static final class FakeAudit extends AuditEventRepository {
        final List<AuditEvent> events = new ArrayList<>();

        FakeAudit() {
            super(null);
        }

        @Override
        public AuditEvent insert(AuditEvent e) {
            AuditEvent saved = new AuditEvent(UUID.randomUUID().toString(), e.tenantCode(), e.actor(), e.action(),
                    e.entityType(), e.entityId(), e.symptomId(), e.details(), OffsetDateTime.now());
            events.add(saved);
            return saved;
        }
    }
}
