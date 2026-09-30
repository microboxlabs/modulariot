package com.microboxlabs.miot.symptoms.store;

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
import com.microboxlabs.miot.symptoms.service.AuditService;
import com.microboxlabs.miot.symptoms.service.DemoSeeder;
import com.microboxlabs.miot.symptoms.service.TreatmentService;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.pgclient.PgConnectOptions;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/**
 * Runs the Control Tower Postgres stores against a real database. Skipped
 * unless {@code -Dmiot.symptoms.test.pg-url=postgresql://user:password@host:port/db}
 * is set; the database's {@code miot_symptoms} schema is dropped and
 * re-created, so use a scratch database. Each test uses its own tenant.
 */
@EnabledIfSystemProperty(named = PgTreatmentStoresTest.URL_PROPERTY, matches = ".+")
class PgTreatmentStoresTest {

    static final String URL_PROPERTY = "miot.symptoms.test.pg-url";
    private static final Duration WAIT = Duration.ofSeconds(10);
    private static final String ACTOR = "ops@example.com";

    private static Vertx vertx;
    private static Pool pool;

    private final PgTreatmentStore treatments = new PgTreatmentStore(() -> pool);
    private final PgContactStore contacts = new PgContactStore(() -> pool);
    private final PgAuditStore audit = new PgAuditStore(() -> pool);

    @BeforeAll
    static void migrate() throws IOException {
        vertx = Vertx.vertx();
        pool = PgBuilder.pool().connectingTo(PgConnectOptions.fromUri(System.getProperty(URL_PROPERTY)))
                .using(vertx).build();
        pool.query("DROP SCHEMA IF EXISTS miot_symptoms CASCADE").execute().await().atMost(WAIT);
        for (String file : List.of("V0.8.0__create_symptoms_catalog.sql",
                "V0.8.1__create_control_tower_treatments.sql")) {
            try (InputStream in = PgTreatmentStoresTest.class.getResourceAsStream("/db/migration/symptoms/" + file)) {
                pool.query(new String(in.readAllBytes(), StandardCharsets.UTF_8)).execute().await().atMost(WAIT);
            }
        }
    }

    @AfterAll
    static void close() {
        pool.close().await().atMost(WAIT);
        vertx.close().await().atMost(WAIT);
    }

    @Test
    void episodeOpensTransitionsAndStaysInItsTenant() {
        String tenant = tenant();
        OffsetDateTime earlier = OffsetDateTime.now(ZoneOffset.UTC).minusHours(1).truncatedTo(ChronoUnit.MILLIS);
        Treatment old = treatments.insert(new Treatment(null, tenant, 7L, null, null, TreatmentType.CALL,
                TreatmentStatus.CLOSED, "demo@example.com", earlier, "demo@example.com", earlier.plusMinutes(5),
                "resolved", null, null)).treatment();
        Treatment open = treatments.insert(openTreatment(tenant, 7L, ACTOR)).treatment();

        assertEquals(earlier, old.openedAt());
        assertEquals(earlier, old.updatedAt(), "updatedAt defaults to openedAt");
        assertEquals(TreatmentStatus.OPEN, open.status());
        assertEquals("asset-1", open.assetId());
        assertEquals(open, treatments.find(tenant, open.id()).orElseThrow());
        assertEquals(List.of(old.id(), open.id()),
                treatments.listBySymptom(tenant, 7L).stream().map(Treatment::id).toList(), "oldest first");
        assertEquals(open.id(), treatments.findOpen(tenant, 7L, ACTOR).orElseThrow().id());
        assertTrue(treatments.findOpen(tenant, 7L, "other@example.com").isEmpty());
        assertTrue(treatments.find("other-tenant", open.id()).isEmpty());
        assertTrue(treatments.find(tenant, "not-a-uuid").isEmpty());

        Treatment closed = treatments.transition(tenant, open.id(), TreatmentStatus.CLOSED, "closer@example.com",
                "resolved", null).orElseThrow();
        assertEquals(TreatmentStatus.CLOSED, closed.status());
        assertEquals("closer@example.com", closed.closedBy());
        assertEquals("opened from test", closed.note(), "a null note keeps the old one");
        assertEquals(closed.closedAt(), closed.updatedAt());
        assertTrue(treatments.transition(tenant, open.id(), TreatmentStatus.CANCELLED, ACTOR, null, null).isEmpty(),
                "only an OPEN episode moves");
        assertTrue(treatments.transition("other-tenant", old.id(), TreatmentStatus.CLOSED, ACTOR, null, null)
                .isEmpty());
        assertTrue(treatments.findOpen(tenant, 7L, ACTOR).isEmpty());
    }

    @Test
    void secondOpenEpisodeForTheSameOperatorReturnsTheFirst() {
        String tenant = tenant();
        TreatmentStore.Inserted first = treatments.insert(openTreatment(tenant, 8L, ACTOR));
        TreatmentStore.Inserted second = treatments.insert(openTreatment(tenant, 8L, ACTOR));
        Treatment other = treatments.insert(openTreatment(tenant, 8L, "other@example.com")).treatment();

        assertTrue(first.created());
        assertFalse(second.created(), "the conflict path says it created nothing");
        assertEquals(first.treatment().id(), second.treatment().id());
        assertFalse(first.treatment().id().equals(other.id()));
        assertEquals(2, treatments.listBySymptom(tenant, 8L).size());
    }

    @Test
    void concurrentOpenReportsNotCreatedAndIsAuditedOnce() {
        String tenant = tenant();
        // findOpen misses, as it does for the second of two simultaneous requests.
        TreatmentStore racing = new MissingOpenLookup(treatments);
        TreatmentService service = new TreatmentService(racing, contacts, new DemoSeeder(false, contacts, racing),
                new AuditService(audit));
        OpenTreatmentRequest req = new OpenTreatmentRequest(TreatmentType.CALL, null, null, null);

        TreatmentService.OpenResult first = service.open(tenant, ACTOR, 12L, req);
        TreatmentService.OpenResult second = service.open(tenant, ACTOR, 12L, req);

        assertTrue(first.created());
        assertFalse(second.created());
        assertEquals(first.treatment().id(), second.treatment().id());
        assertEquals(1, audit.list(tenant, null, null, 12L, null, 10).size());
    }

    @Test
    void actionIsRejectedOnceTheEpisodeIsClosed() {
        String tenant = tenant();
        Treatment t = treatments.insert(openTreatment(tenant, 13L, ACTOR)).treatment();
        treatments.addAction(note(tenant, t.id(), null));
        treatments.transition(tenant, t.id(), TreatmentStatus.CLOSED, ACTOR, "resolved", null);

        assertThrows(IllegalStateException.class, () -> treatments.addAction(note(tenant, t.id(), null)));
        assertEquals(1, treatments.listActions(tenant, List.of(t.id())).size());
    }

    @Test
    void actionsAreNumberedPerEpisodeAndListedInTheRequestedOrder() {
        String tenant = tenant();
        Treatment a = treatments.insert(openTreatment(tenant, 9L, ACTOR)).treatment();
        Treatment b = treatments.insert(openTreatment(tenant, 9L, "other@example.com")).treatment();
        OffsetDateTime at = OffsetDateTime.now(ZoneOffset.UTC).plusMinutes(1).truncatedTo(ChronoUnit.MILLIS);

        TreatmentAction a1 = treatments.addAction(note(tenant, a.id(), null));
        TreatmentAction b1 = treatments.addAction(note(tenant, b.id(), null));
        TreatmentAction a2 = treatments.addAction(note(tenant, a.id(), at));

        assertEquals(1, a1.seq());
        assertEquals(1, b1.seq());
        assertEquals(2, a2.seq());
        assertEquals(at, a2.performedAt());
        assertEquals(List.of("tag_1"), a2.tags());
        assertEquals(Map.of("demo", true, "n", 3), a2.details());
        assertEquals(at, treatments.find(tenant, a.id()).orElseThrow().updatedAt(), "an action touches the episode");

        List<String> order = treatments.listActions(tenant, List.of(b.id(), a.id(), "not-a-uuid")).stream()
                .map(x -> x.treatmentId() + ":" + x.seq()).toList();
        assertEquals(List.of(b.id() + ":1", a.id() + ":1", a.id() + ":2"), order);
        assertTrue(treatments.listActions("other-tenant", List.of(a.id())).isEmpty());
        assertTrue(treatments.listActions(tenant, List.of()).isEmpty());

        assertThrows(IllegalStateException.class,
                () -> treatments.addAction(note(tenant, UUID.randomUUID().toString(), null)));
        assertThrows(IllegalStateException.class, () -> treatments.addAction(note("other-tenant", a.id(), null)));
    }

    @Test
    void concurrentActionsGetDistinctSeqNumbers() throws Exception {
        String tenant = tenant();
        Treatment t = treatments.insert(openTreatment(tenant, 10L, ACTOR)).treatment();
        ExecutorService threads = Executors.newFixedThreadPool(4);
        try {
            List<Future<TreatmentAction>> results = new ArrayList<>();
            for (int i = 0; i < 12; i++) {
                results.add(threads.submit(() -> treatments.addAction(note(tenant, t.id(), null))));
            }
            for (Future<TreatmentAction> f : results) {
                f.get();
            }
        } finally {
            threads.shutdown();
        }
        List<Integer> seqs = treatments.listActions(tenant, List.of(t.id())).stream().map(TreatmentAction::seq)
                .toList();
        assertEquals(List.of(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12), seqs);
    }

    @Test
    void contactStatsCountSavedContactCallsOnly() {
        String tenant = tenant();
        Contact camila = contacts.insert(contact(tenant, "Camila"));
        Contact ignacio = contacts.insert(contact(tenant, "Ignacio"));
        Treatment t = treatments.insert(openTreatment(tenant, 11L, ACTOR)).treatment();
        OffsetDateTime base = OffsetDateTime.now(ZoneOffset.UTC).truncatedTo(ChronoUnit.MILLIS);

        treatments.addAction(call(tenant, t.id(), camila.id(), true, base));
        treatments.addAction(call(tenant, t.id(), camila.id(), false, base.plusMinutes(2)));
        treatments.addAction(call(tenant, t.id(), camila.id(), null, base.plusMinutes(1)));
        treatments.addAction(call(tenant, t.id(), ignacio.id(), false, base));
        treatments.addAction(call(tenant, t.id(), null, true, base.plusMinutes(5)));
        treatments.addAction(note(tenant, t.id(), base.plusMinutes(9)));

        Map<String, ContactCallStats> stats = new HashMap<>();
        treatments.contactStats(tenant).forEach(s -> stats.put(s.contactId(), s));
        assertEquals(2, stats.size());
        assertEquals(new ContactCallStats(camila.id(), base.plusMinutes(2), 1, 1), stats.get(camila.id()));
        assertEquals(new ContactCallStats(ignacio.id(), base, 0, 1), stats.get(ignacio.id()));
        assertTrue(treatments.contactStats("other-tenant").isEmpty());
        assertThrows(IllegalArgumentException.class,
                () -> treatments.addAction(call(tenant, t.id(), "not-a-uuid", true, base)));
    }

    @Test
    void contactsKeepCreationOrderAndAuthorship() {
        String tenant = tenant();
        assertTrue(contacts.isEmpty(tenant));
        Contact first = contacts.insert(contact(tenant, "Camila"));
        Contact second = contacts.insert(new Contact(null, tenant, "Valentina", null, null, null, false, null,
                "system:demo", null, null));

        assertFalse(contacts.isEmpty(tenant));
        assertEquals(List.of(CallMethod.PHONE, CallMethod.WHATSAPP), first.methods());
        assertEquals(List.of(), second.methods());
        assertEquals(List.of(first.id(), second.id()), contacts.list(tenant, null).stream().map(Contact::id).toList());
        assertEquals(List.of(first.id()), contacts.list(tenant, true).stream().map(Contact::id).toList());
        assertEquals(List.of(second.id()), contacts.list(tenant, false).stream().map(Contact::id).toList());

        Contact updated = contacts.update(new Contact(first.id(), tenant, "Camila E.", "Jefe", "+56900000109",
                List.of(CallMethod.TEAMS), false, "nota", "someone-else", null, null)).orElseThrow();
        assertEquals("Camila E.", updated.name());
        assertEquals(List.of(CallMethod.TEAMS), updated.methods());
        assertEquals(ACTOR, updated.createdBy(), "createdBy is kept");
        assertEquals(first.createdAt(), updated.createdAt());
        assertTrue(contacts.update(new Contact(first.id(), "other-tenant", "x", null, null, List.of(), true, null,
                ACTOR, null, null)).isEmpty());
        assertTrue(contacts.update(new Contact("not-a-uuid", tenant, "x", null, null, List.of(), true, null,
                ACTOR, null, null)).isEmpty());

        assertFalse(contacts.delete("other-tenant", first.id()));
        assertTrue(contacts.delete(tenant, first.id()));
        assertFalse(contacts.delete(tenant, first.id()));
        assertTrue(contacts.find(tenant, first.id()).isEmpty());
        assertTrue(contacts.find(tenant, "not-a-uuid").isEmpty());
    }

    @Test
    void auditIsNewestFirstFilteredAndCapped() {
        String tenant = tenant();
        AuditEvent opened = audit.append(event(tenant, "treatment.opened", "treatment", "t-1", 42L));
        AuditEvent contact = audit.append(event(tenant, "contact.created", "contact", "c-1", null));
        AuditEvent action = audit.append(event(tenant, "treatment.action_added", "treatment", "t-1", 42L));
        audit.append(event("other-tenant", "contact.created", "contact", "c-1", null));

        assertEquals(Map.of("k", "v", "n", 1), opened.details());
        assertNull(contact.symptomId());
        assertEquals(List.of(action.id(), contact.id(), opened.id()), ids(audit.list(tenant, null, null, null, null,
                10)));
        assertEquals(List.of(action.id(), opened.id()), ids(audit.list(tenant, "treatment", "t-1", null, null, 10)));
        assertEquals(List.of(action.id(), opened.id()), ids(audit.list(tenant, null, null, 42L, null, 10)));
        assertEquals(List.of(contact.id()), ids(audit.list(tenant, "contact", null, null, null, 10)));
        assertEquals(List.of(contact.id(), opened.id()),
                ids(audit.list(tenant, null, null, null, action.createdAt(), 10)), "before is exclusive");
        assertEquals(List.of(action.id()), ids(audit.list(tenant, null, null, null, null, 1)));

        for (int i = 0; i < 500; i++) {
            audit.append(event(tenant, "contact.updated", "contact", "c-2", null));
        }
        assertEquals(500, audit.list(tenant, null, null, null, null, 10_000).size());
    }

    @Test
    void auditPagesThroughATimestampTieWithBeforeId() {
        String tenant = tenant();
        OffsetDateTime tie = OffsetDateTime.now(ZoneOffset.UTC).truncatedTo(ChronoUnit.MILLIS);
        for (int i = 0; i < 5; i++) {
            pool.preparedQuery("INSERT INTO miot_symptoms.audit_event (tenant_code, action, created_at) "
                            + "VALUES ($1, $2, $3)")
                    .execute(Tuple.of(tenant, "contact.updated", tie)).await().atMost(WAIT);
        }
        List<String> all = ids(audit.list(tenant, null, null, null, null, 10));
        assertEquals(5, all.size());

        List<String> paged = new ArrayList<>();
        AuditEvent last = null;
        for (int page = 0; page < 10; page++) {
            List<AuditEvent> events = last == null
                    ? audit.list(tenant, null, null, null, null, 2)
                    : audit.list(tenant, null, null, null, last.createdAt(), last.id(), 2);
            if (events.isEmpty()) {
                break;
            }
            paged.addAll(ids(events));
            last = events.get(events.size() - 1);
        }
        assertEquals(all, paged, "keyset paging returns every event once, in order");
        assertTrue(audit.list(tenant, null, null, null, tie, 10).isEmpty(), "before alone skips the tie");
    }

    @Test
    void serviceFlowAndDemoSeedSurviveARestart() {
        String tenant = tenant();
        DemoSeeder seeder = new DemoSeeder(true, contacts, treatments);
        TreatmentService service = new TreatmentService(treatments, contacts, seeder, new AuditService(audit));

        List<TreatmentView> seeded = new ArrayList<>();
        for (long symptom = 1; symptom <= 10; symptom++) {
            seeded.addAll(service.listForSymptom(tenant, symptom));
        }
        assertEquals(4, contacts.list(tenant, null).size());
        assertFalse(seeded.isEmpty(), "some symptoms get history");
        assertTrue(seeded.stream().allMatch(v -> v.status() == TreatmentStatus.CLOSED && !v.actions().isEmpty()));

        // A new seeder is what a restart looks like: it must find the data and write nothing.
        TreatmentService restarted = new TreatmentService(treatments, contacts,
                new DemoSeeder(true, contacts, treatments), new AuditService(audit));
        List<TreatmentView> again = new ArrayList<>();
        for (long symptom = 1; symptom <= 10; symptom++) {
            again.addAll(restarted.listForSymptom(tenant, symptom));
        }
        assertEquals(seeded.stream().map(TreatmentView::id).toList(), again.stream().map(TreatmentView::id).toList());
        new DemoSeeder(true, contacts, treatments).ensureContacts(tenant);
        assertEquals(4, contacts.list(tenant, null).size());

        String id = service.open(tenant, ACTOR, 99L, new OpenTreatmentRequest(TreatmentType.CALL, null, null, null))
                .treatment().id();
        assertFalse(restarted.open(tenant, ACTOR, 99L, new OpenTreatmentRequest(TreatmentType.CALL, null, null,
                null)).created(), "the open episode is found after a restart");
        restarted.addAction(tenant, ACTOR, id, new AddActionRequest(ActionKind.NOTE, null, null, null, null, null,
                null, null, null, null, null, "revisado", List.of(), Map.of()));
        TreatmentView closed = restarted.close(tenant, ACTOR, id, new CloseTreatmentRequest("resolved", null));
        assertEquals(TreatmentStatus.CLOSED, closed.status());
        assertEquals(1, closed.actions().size());
        assertEquals(List.of("treatment.closed", "treatment.action_added", "treatment.opened"),
                audit.list(tenant, "treatment", id, null, null, 10).stream().map(AuditEvent::action).toList());
    }

    private static String tenant() {
        return "tenant-" + UUID.randomUUID();
    }

    private static List<String> ids(List<AuditEvent> events) {
        return events.stream().map(AuditEvent::id).toList();
    }

    private static Treatment openTreatment(String tenant, long symptomId, String actor) {
        return new Treatment(null, tenant, symptomId, "asset-1", "trip-1", TreatmentType.CALL, null, actor, null,
                null, null, null, "opened from test", null);
    }

    private static TreatmentAction note(String tenant, String treatmentId, OffsetDateTime at) {
        return new TreatmentAction(null, treatmentId, tenant, 0, ActionKind.NOTE, null, null, null, null, null,
                null, null, null, null, null, "nota", List.of("tag_1"), Map.of("demo", true, "n", 3), ACTOR, at);
    }

    private static TreatmentAction call(
            String tenant, String treatmentId, String contactId, Boolean answered, OffsetDateTime at) {
        return new TreatmentAction(null, treatmentId, tenant, 0, ActionKind.CALL, contactId, "Contacto", "Rol",
                "+56900000100", CallMethod.PHONE, "result_1", "Contesta", answered, 30, "mensaje", null, null,
                null, ACTOR, at);
    }

    private static Contact contact(String tenant, String name) {
        return new Contact(null, tenant, name, "Jefe de operaciones", "+56900000101",
                List.of(CallMethod.PHONE, CallMethod.WHATSAPP), true, "nota", ACTOR, null, null);
    }

    private static AuditEvent event(String tenant, String action, String entityType, String entityId, Long symptom) {
        return new AuditEvent(null, tenant, ACTOR, action, entityType, entityId, symptom, Map.of("k", "v", "n", 1),
                null);
    }

    /** Delegates to a store but never finds an open episode, to reach the insert conflict path. */
    private record MissingOpenLookup(TreatmentStore store) implements TreatmentStore {

        @Override
        public Inserted insert(Treatment treatment) {
            return store.insert(treatment);
        }

        @Override
        public Optional<Treatment> find(String tenantCode, String id) {
            return store.find(tenantCode, id);
        }

        @Override
        public Optional<Treatment> findOpen(String tenantCode, long symptomId, String actor) {
            return Optional.empty();
        }

        @Override
        public List<Treatment> listBySymptom(String tenantCode, long symptomId) {
            return store.listBySymptom(tenantCode, symptomId);
        }

        @Override
        public Optional<Treatment> transition(String tenantCode, String id, TreatmentStatus status, String actor,
                String resolution, String note, OffsetDateTime at) {
            return store.transition(tenantCode, id, status, actor, resolution, note, at);
        }

        @Override
        public TreatmentAction addAction(TreatmentAction action) {
            return store.addAction(action);
        }

        @Override
        public List<TreatmentAction> listActions(String tenantCode, List<String> treatmentIds) {
            return store.listActions(tenantCode, treatmentIds);
        }

        @Override
        public List<ContactCallStats> contactStats(String tenantCode) {
            return store.contactStats(tenantCode);
        }
    }
}
