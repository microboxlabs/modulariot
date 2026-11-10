package com.microboxlabs.miot.symptoms.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.catalog.store.PgJson;
import com.microboxlabs.miot.symptoms.domain.ActionKind;
import com.microboxlabs.miot.symptoms.domain.AuditEvent;
import com.microboxlabs.miot.symptoms.domain.CallMethod;
import com.microboxlabs.miot.symptoms.domain.Contact;
import com.microboxlabs.miot.symptoms.domain.ContactCallStats;
import com.microboxlabs.miot.symptoms.domain.ContactChannels;
import com.microboxlabs.miot.symptoms.domain.TowerSettings;
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
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
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
                "V0.8.1__create_control_tower_treatments.sql", "V0.8.2__extend_contacts.sql",
                "V0.8.4__create_signal_transitions.sql",
                "V0.8.3__create_tower_settings.sql", "V0.12.1__contact_company_rut.sql",
                "V0.12.2__contact_company_tax_id_type.sql", "V0.12.3__contact_member_unique.sql",
                "V0.12.16__tower_settings_telephony.sql", "V0.12.28__teams_reconcile_cursor.sql")) {
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
    void aSyncUpdateCannotOverwriteAnEditCommittedAfterItsRead() {
        String tenant = tenant();
        Contact read = contacts.insert(new Contact(null, tenant, "Juan", null, null, List.of(), true, null,
                "fleet-sync", null, null));
        Contact staleFill = new Contact(read.id(), tenant, read.name(), "Conductor", "+56912345678",
                List.of(CallMethod.PHONE), false, read.notes(), read.createdBy(), read.createdAt(), read.updatedAt());
        pool.preparedQuery("""
                UPDATE miot_symptoms.contact SET name = 'Alice edit', role = 'Dispatcher', phone = '+56999999999',
                    notes = 'Keep me', company = 'Other carrier', tags = '["vip"]'::jsonb,
                    channels = '{"email":"alice@example.com"}'::jsonb, updated_at = updated_at + interval '1 second'
                WHERE tenant_code = $1 AND id = $2
                """).execute(Tuple.of(tenant, UUID.fromString(read.id())))
                .await().atMost(WAIT);
        Contact edited = contacts.find(tenant, read.id()).orElseThrow();

        assertTrue(contacts.updateIfUnchanged(staleFill, read.updatedAt()).isEmpty());
        assertEquals(edited, contacts.find(tenant, read.id()).orElseThrow(), "all of the person's fields survive");
        assertTrue(contacts.updateIfUnchanged(staleFill, null).isEmpty());
        assertTrue(contacts.updateIfUnchanged(new Contact(read.id(), tenant(), "Other tenant", null, null,
                List.of(), false, null, "fleet-sync", null, null), edited.updatedAt()).isEmpty());
        assertTrue(contacts.updateIfUnchanged(edited, edited.updatedAt()).isPresent(),
                "a fresh version can still be updated");
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
    void firstOpenedAtIsTheEarliestTreatmentPerCaseInTheTenant() {
        String tenant = tenant();
        OffsetDateTime t0 = OffsetDateTime.now(ZoneOffset.UTC).minusHours(2).truncatedTo(ChronoUnit.MILLIS);
        treatments.insert(new Treatment(null, tenant, 21L, null, null, TreatmentType.CALL, TreatmentStatus.CLOSED,
                ACTOR, t0.plusMinutes(9), ACTOR, t0.plusMinutes(12), "resolved", null, null));
        treatments.insert(new Treatment(null, tenant, 21L, null, null, TreatmentType.CALL, TreatmentStatus.CLOSED,
                "other@example.com", t0.plusMinutes(3), ACTOR, t0.plusMinutes(4), "resolved", null, null));
        treatments.insert(new Treatment(null, "other-tenant", 22L, null, null, TreatmentType.CALL,
                TreatmentStatus.OPEN, ACTOR, t0, null, null, null, null, null));

        assertEquals(Map.of(21L, t0.plusMinutes(3)), treatments.firstOpenedAt(tenant, List.of(21L, 22L, 23L)));
        assertEquals(Map.of(), treatments.firstOpenedAt(tenant, List.of()));
    }

    @Test
    void towerSettingsAreOneRowPerOrganization() {
        PgTowerSettingsStore settings = new PgTowerSettingsStore(() -> pool);
        String tenant = tenant();
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC).truncatedTo(ChronoUnit.MILLIS);
        assertTrue(settings.find(tenant).isEmpty());

        TowerSettings saved = settings.save(new TowerSettings(tenant, 3, 8, 150, ACTOR, now));
        assertEquals(new TowerSettings(tenant, 3, 8, 150, ACTOR, now), saved);
        settings.save(new TowerSettings(tenant, null, 12, null, "other@example.com", now.plusMinutes(1)));
        assertEquals(new TowerSettings(tenant, null, 12, null, "other@example.com", now.plusMinutes(1)),
                settings.find(tenant).orElseThrow());
        assertTrue(settings.find("other-tenant-" + tenant).isEmpty());
        TowerSettings badShift = new TowerSettings(tenant, 1, 0, 1, ACTOR, now);
        assertThrows(RuntimeException.class, () -> settings.save(badShift), "the table checks the shift length");

        settings.saveTelephonyProvider(tenant, "TEAMS_PHONE", ACTOR);
        assertEquals(Optional.of("TEAMS_PHONE"), settings.telephonyProvider(tenant));
        assertEquals(12, settings.find(tenant).orElseThrow().shiftHours(), "the operator team is kept");
        settings.saveTelephonyProvider(tenant, null, ACTOR);
        assertTrue(settings.telephonyProvider(tenant).isEmpty());
        String fresh = tenant();
        settings.saveTelephonyProvider(fresh, "TELNYX", ACTOR);
        assertEquals(8, settings.find(fresh).orElseThrow().shiftHours(), "a new row gets the default shift");
        assertThrows(RuntimeException.class, () -> settings.saveTelephonyProvider(fresh, "SKYPE", ACTOR));
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
        assertNotEquals(first.treatment().id(), other.id());
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

        TreatmentAction onClosed = note(tenant, t.id(), null);
        assertThrows(IllegalStateException.class, () -> treatments.addAction(onClosed));
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

        TreatmentAction unknown = note(tenant, UUID.randomUUID().toString(), null);
        TreatmentAction foreign = note("other-tenant", a.id(), null);
        assertThrows(IllegalStateException.class, () -> treatments.addAction(unknown));
        assertThrows(IllegalStateException.class, () -> treatments.addAction(foreign));
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
    void teamsReconcileCheckpointSurvivesANewStoreInstance() {
        var first = new PgTreatmentStore(() -> pool);
        var second = new PgTreatmentStore(() -> pool);
        var cursor = new TreatmentStore.Caller("example-org", "operator1@example.test");
        first.saveTeamsReconcileCursor(cursor);
        assertEquals(Optional.of(cursor), second.teamsReconcileCursor());
        var next = new TreatmentStore.Caller("example-org-2", "operator2@example.test");
        second.saveTeamsReconcileCursor(next);
        assertEquals(Optional.of(next), first.teamsReconcileCursor());
    }

    @Test
    void pendingTeamsCallersRotateAndWrapAfterTheCursor() {
        String tenant = tenant();
        Treatment treatment = treatments.insert(openTreatment(tenant, 10L, ACTOR)).treatment();
        List<String> operators = List.of("alpha@example.test", "beta@example.test", "gamma@example.test");
        for (String operator : operators) {
            TreatmentAction action = treatments.addAction(pendingTelephonyCall(tenant, treatment.id()));
            pool.preparedQuery("UPDATE miot_symptoms.treatment_action SET performed_by = $2 WHERE id = $1")
                    .execute(Tuple.of(UUID.fromString(action.id()), operator)).await().atMost(WAIT);
        }
        var cursor = new TreatmentStore.Caller(tenant, "beta@example.test");

        List<String> rotated = treatments.pendingTeamsCallers(OffsetDateTime.now().minusMinutes(1), 1000, cursor)
                .stream().filter(c -> c.tenantCode().equals(tenant)).map(TreatmentStore.Caller::performedBy).toList();

        assertEquals(List.of("gamma@example.test", "alpha@example.test", "beta@example.test"), rotated);
    }

    @Test
    void concurrentReconcilesClaimARecordOnceAndCannotOverwriteTheWinner() throws Exception {
        String tenant = tenant();
        Treatment treatment = treatments.insert(openTreatment(tenant, 10L, ACTOR)).treatment();
        TreatmentAction first = treatments.addAction(pendingTelephonyCall(tenant, treatment.id()));
        TreatmentAction second = treatments.addAction(pendingTelephonyCall(tenant, treatment.id()));
        assertEquals("object", pool.preparedQuery("SELECT jsonb_typeof(details) AS shape"
                        + " FROM miot_symptoms.treatment_action WHERE id = $1")
                .execute(Tuple.of(UUID.fromString(first.id()))).await().atMost(WAIT).iterator().next().getString("shape"));
        // Existing installations also have JSON strings containing the details object.
        pool.preparedQuery("UPDATE miot_symptoms.treatment_action SET details = to_jsonb($2::text) WHERE id = $1")
                .execute(Tuple.of(UUID.fromString(first.id()), PgJson.write(first.details())))
                .await().atMost(WAIT);
        assertEquals(2, treatments.pendingTelephonyCalls(tenant, ACTOR, OffsetDateTime.now().minusMinutes(1)).size());
        assertTrue(treatments.pendingTeamsCallers(OffsetDateTime.now().minusMinutes(1), 1000)
                .contains(new TreatmentStore.Caller(tenant, ACTOR)));
        Map<String, Object> recorded = Map.of("telephony", Map.of("provider", "TEAMS_PHONE", "status", "RECORDED",
                "connectionId", "m1", "recordId", "r1"));
        ExecutorService threads = Executors.newFixedThreadPool(2);
        var barrier = new java.util.concurrent.CyclicBarrier(2);
        List<TreatmentAction> winners = new ArrayList<>();
        try {
            var attempts = List.of(
                    threads.submit(() -> {
                        barrier.await(5, java.util.concurrent.TimeUnit.SECONDS);
                        return treatments.updateCallResult(tenant, first.id(), true, 61, recorded);
                    }),
                    threads.submit(() -> {
                        barrier.await(5, java.util.concurrent.TimeUnit.SECONDS);
                        return treatments.updateCallResult(tenant, second.id(), true, 61, recorded);
                    }));
            for (var attempt : attempts) {
                attempt.get().ifPresent(winners::add);
            }
        } finally {
            threads.shutdown();
        }
        assertEquals(1, winners.size());
        TreatmentAction winner = winners.get(0);
        assertEquals(Set.of("r1"), treatments.recordedTelephonyRecordIds(tenant, "m1"));
        assertTrue(treatments.recordedTelephonyRecordIds("foreign-tenant", "m1").isEmpty());
        assertTrue(treatments.updateCallResult(tenant, winner.id(), null, null, first.details()).isEmpty());
        TreatmentAction saved = treatments.listActions(tenant, List.of(treatment.id())).stream()
                .filter(action -> action.id().equals(winner.id())).findFirst().orElseThrow();
        assertEquals(true, saved.answered());
        assertEquals(61, saved.durationSeconds());
        assertEquals(recorded, saved.details());

        String pendingId = winner.id().equals(first.id()) ? second.id() : first.id();
        pool.preparedQuery("UPDATE miot_symptoms.treatment_action SET details = to_jsonb($2::text) WHERE id = $1")
                .execute(Tuple.of(UUID.fromString(winner.id()), PgJson.write(recorded))).await().atMost(WAIT);
        assertEquals(Set.of("r1"), treatments.recordedTelephonyRecordIds(tenant, "m1"));
        assertTrue(treatments.updateCallResult(tenant, pendingId, true, 61, recorded).isEmpty());
        Map<String, Object> anotherConnection = Map.of("telephony", Map.of("provider", "TEAMS_PHONE", "status",
                "RECORDED", "connectionId", "m2", "recordId", "r1"));
        assertTrue(treatments.updateCallResult(tenant, pendingId, false, 0, anotherConnection).isPresent());
        assertEquals(Set.of("r1"), treatments.recordedTelephonyRecordIds(tenant, "m2"));
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
        assertEquals(List.of(stats.get(camila.id())), treatments.contactStats(tenant, List.of(camila.id())));
        assertTrue(treatments.contactStats(tenant, List.of()).isEmpty());
        assertTrue(treatments.contactStats("other-tenant").isEmpty());
        TreatmentAction badContact = call(tenant, t.id(), "not-a-uuid", true, base);
        assertThrows(IllegalArgumentException.class, () -> treatments.addAction(badContact));
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
    void contactBookFieldsRoundTripAndNationalIdIsUniquePerTenant() {
        String tenant = tenant();
        ContactChannels channels = new ContactChannels("+56900000111", "+56900000112", "persona@example.com", null,
                "messages@example.invalid");
        Contact saved = contacts.insert(bookContact(tenant, "Persona Uno", "111111111", channels));

        assertEquals("111111111", saved.nationalId());
        assertEquals("RUT", saved.nationalIdType());
        assertEquals("Empresa Ejemplo", saved.company());
        assertEquals("761112228", saved.companyRut());
        assertEquals("Supervisor", saved.position());
        assertEquals(channels, saved.channels());
        assertEquals(List.of("transporte", "turno noche"), saved.tags());
        assertEquals("member-1", saved.memberUserId());
        assertTrue(saved.provisional());
        assertEquals(saved, contacts.find(tenant, saved.id()).orElseThrow());
        assertEquals(saved.id(), contacts.findByNationalId(tenant, "111111111").orElseThrow().id());
        assertTrue(contacts.findByNationalId("other-tenant", "111111111").isEmpty());

        Contact sameId = bookContact(tenant, "Persona Dos", "111111111", ContactChannels.NONE);
        assertThrows(DuplicateNationalIdException.class, () -> contacts.insert(sameId));
        Contact other = contacts.insert(bookContact(tenant, "Persona Dos", "222222222", ContactChannels.NONE,
                "member-2"));
        Contact otherTenant = contacts.insert(bookContact("tenant-" + UUID.randomUUID(), "Persona Uno", "111111111",
                ContactChannels.NONE));
        assertEquals("111111111", otherTenant.nationalId(), "the same id is fine in another tenant");

        Contact clash = new Contact(other.id(), tenant, other.name(), null, null, List.of(), true, null, ACTOR, null,
                null, "111111111", "RUT", null, null, ContactChannels.NONE, List.of(), null, false);
        assertThrows(DuplicateNationalIdException.class, () -> contacts.update(clash));

        Contact completed = contacts.update(new Contact(saved.id(), tenant, "Persona Uno", null, null, List.of(), true,
                null, ACTOR, null, null, null, "RUT", null, null, ContactChannels.NONE, List.of(), null, false))
                .orElseThrow();
        assertNull(completed.nationalId());
        assertFalse(completed.provisional());
        assertEquals(ContactChannels.NONE, completed.channels());
        assertTrue(contacts.findByNationalId(tenant, "111111111").isEmpty());
        Contact plain = contacts.insert(contact(tenant, "Sin id"));
        assertNull(plain.nationalId(), "contacts without a national id never clash");
        assertEquals(List.of(), plain.tags());
        contacts.insert(contact(tenant, "Sin id 2"));
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

    @Test
    void aStepSkipIsReadBackWithWhoAndWhenAfterARestart() {
        String tenant = tenant();
        long symptomId = -pool.preparedQuery("""
                INSERT INTO miot_symptoms.signal_transitions
                    (tenant_code, definition_id, version, state, kind, asset_id, at, level, previous_level, measure)
                VALUES ($1, $2, '1', 'ACTIVE', 'OPENED', 'vehicle-test', now(), 1, 0, 1) RETURNING id
                """).execute(Tuple.of(tenant, UUID.randomUUID())).await().atMost(WAIT).iterator().next().getLong("id");
        TreatmentService service = new TreatmentService(treatments, contacts, new DemoSeeder(false, contacts,
                treatments), new AuditService(audit));
        String id = service.open(tenant, ACTOR, symptomId, new OpenTreatmentRequest(TreatmentType.CALL, null, null, null))
                .treatment().id();
        Map<String, Object> details = Map.of(TreatmentService.SKIP_TO_STEP, 2, "level", 3, "version", "4",
                "skipId", UUID.randomUUID().toString());
        var request = new AddActionRequest(ActionKind.NOTE, null, null, null, null, null,
                null, null, null, null, null, "No contesta", List.of(),
                details);
        service.addAction(tenant, ACTOR, id, request);

        TreatmentService restarted = new TreatmentService(treatments, contacts, new DemoSeeder(false, contacts,
                treatments), new AuditService(audit));
        TreatmentAction skip = restarted.listForSymptom(tenant, symptomId).get(0).actions().get(0);
        assertEquals(skip, restarted.addAction(tenant, ACTOR, id, request), "a lost response can be retried");
        assertEquals(1, restarted.get(tenant, id).actions().size());
        assertEquals(2, audit.list(tenant, "treatment", id, null, null, 10).size());

        assertEquals(ActionKind.NOTE, skip.kind());
        assertEquals(details, skip.details());
        assertEquals("No contesta", skip.note());
        assertEquals(ACTOR, skip.performedBy());
        assertNotNull(skip.performedAt());
        assertEquals(2, audit.list(tenant, "treatment", id, null, null, 1).get(0).details()
                .get(TreatmentService.SKIP_TO_STEP));
    }

    @Test
    void concurrentEngineOpensResumeOnlyTheirOperatorTenantAndCase() throws Exception {
        String tenant = tenant();
        long symptomId = -pool.preparedQuery("""
                INSERT INTO miot_symptoms.signal_transitions
                    (tenant_code, definition_id, version, state, kind, asset_id, at, level, previous_level, measure)
                VALUES ($1, $2, '1', 'ACTIVE', 'OPENED', 'vehicle-test', now(), 1, 0, 1) RETURNING id
                """).execute(Tuple.of(tenant, UUID.randomUUID())).await().atMost(WAIT)
                .iterator().next().getLong("id");
        var barrier = new java.util.concurrent.CyclicBarrier(4);
        List<TreatmentStore.Inserted> results = new ArrayList<>();
        try (ExecutorService workers = Executors.newFixedThreadPool(4)) {
            List<Future<TreatmentStore.Inserted>> requests = new ArrayList<>();
            for (int i = 0; i < 4; i++) {
                requests.add(workers.submit(() -> {
                    barrier.await(5, java.util.concurrent.TimeUnit.SECONDS);
                    return treatments.insert(openTreatment(tenant, symptomId, ACTOR));
                }));
            }
            for (Future<TreatmentStore.Inserted> request : requests) {
                results.add(request.get(10, java.util.concurrent.TimeUnit.SECONDS));
            }
        }
        assertEquals(1, results.stream().filter(TreatmentStore.Inserted::created).count());
        assertEquals(1, results.stream().map(r -> r.treatment().id()).distinct().count());
        assertEquals(1, treatments.listBySymptom(tenant, symptomId).size());
        Treatment mine = results.getFirst().treatment();
        Treatment other = treatments.insert(openTreatment(tenant, symptomId, "other@example.com")).treatment();
        assertNotEquals(mine.id(), other.id());
        assertTrue(treatments.findOpen(tenant(), symptomId, ACTOR).isEmpty());
        assertTrue(treatments.findOpen(tenant, symptomId - 1, ACTOR).isEmpty());
        Treatment wrongTenant = openTreatment(tenant(), symptomId, ACTOR);
        assertThrows(java.util.NoSuchElementException.class,
                () -> treatments.insert(wrongTenant));
    }

    @Test
    void anOpenEpisodeResumesAfterTheEngineClosedItsCase() {
        String tenant = tenant();
        UUID definition = UUID.randomUUID();
        long symptomId = -pool.preparedQuery("""
                INSERT INTO miot_symptoms.signal_transitions
                    (tenant_code, definition_id, version, state, kind, asset_id, at, level, previous_level, measure)
                VALUES ($1, $2, '1', 'ACTIVE', 'OPENED', 'vehicle-test', now(), 1, 0, 1) RETURNING id
                """).execute(Tuple.of(tenant, definition)).await().atMost(WAIT).iterator().next().getLong("id");
        Treatment mine = treatments.insert(openTreatment(tenant, symptomId, ACTOR)).treatment();
        pool.preparedQuery("""
                INSERT INTO miot_symptoms.signal_transitions
                    (tenant_code, definition_id, version, state, kind, asset_id, at, level, previous_level, measure)
                VALUES ($1, $2, '1', 'ACTIVE', 'CLOSED', 'vehicle-test', now(), 1, 1, 0)
                """).execute(Tuple.of(tenant, definition)).await().atMost(WAIT);

        TreatmentStore.Inserted resumed = treatments.insert(openTreatment(tenant, symptomId, ACTOR));
        assertFalse(resumed.created());
        assertEquals(mine.id(), resumed.treatment().id());

        Treatment otherOperator = openTreatment(tenant, symptomId, "other@example.com");
        IllegalStateException refused = assertThrows(IllegalStateException.class,
                () -> treatments.insert(otherOperator));
        assertEquals("the case is closed", refused.getMessage());
        treatments.addAction(note(tenant, mine.id(), null));
        assertTrue(treatments.transition(tenant, mine.id(), TreatmentStatus.CLOSED, ACTOR, "resolved", null)
                .isPresent());
        Treatment newEpisode = openTreatment(tenant, symptomId, ACTOR);
        assertThrows(IllegalStateException.class,
                () -> treatments.insert(newEpisode),
                "a finished episode does not make room for a new one on the closed case");
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

    private static TreatmentAction pendingTelephonyCall(String tenant, String treatmentId) {
        return new TreatmentAction(null, treatmentId, tenant, 0, ActionKind.CALL, null, "Contact", null,
                "+56911111111", CallMethod.PHONE, null, null, null, 30, null, null, List.of(),
                Map.of("telephony", Map.of("provider", "TEAMS_PHONE", "status", "PENDING")), ACTOR, null);
    }

    private static Contact contact(String tenant, String name) {
        return new Contact(null, tenant, name, "Jefe de operaciones", "+56900000101",
                List.of(CallMethod.PHONE, CallMethod.WHATSAPP), true, "nota", ACTOR, null, null);
    }

    private static Contact bookContact(String tenant, String name, String nationalId, ContactChannels channels) {
        return bookContact(tenant, name, nationalId, channels, "member-1");
    }

    private static Contact bookContact(String tenant, String name, String nationalId, ContactChannels channels,
            String memberUserId) {
        return new Contact(null, tenant, name, null, channels.phone(), List.of(CallMethod.PHONE), true, null, ACTOR,
                null, null, nationalId, "RUT", "Empresa Ejemplo", "Supervisor", channels,
                List.of("transporte", "turno noche"), memberUserId, true, "761112228");
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

        @Override
        public Map<Long, OffsetDateTime> firstOpenedAt(String tenantCode, Collection<Long> symptomIds) {
            return store.firstOpenedAt(tenantCode, symptomIds);
        }
    }
}
