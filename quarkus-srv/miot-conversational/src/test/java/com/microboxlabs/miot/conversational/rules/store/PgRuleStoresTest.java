package com.microboxlabs.miot.conversational.rules.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.conversational.persistence.ConversationRepository;
import com.microboxlabs.miot.conversational.rules.ConvTemplate;
import com.microboxlabs.miot.conversational.rules.Rule;
import com.microboxlabs.miot.conversational.rules.RuleBump;
import com.microboxlabs.miot.conversational.rules.RuleVersion;
import com.microboxlabs.miot.conversational.rules.Run;
import com.microboxlabs.miot.conversational.rules.StoredEvent;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.pgclient.PgConnectOptions;
import java.io.IOException;
import java.io.InputStream;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/**
 * The rule, template and run stores against a real database. Skipped unless
 * {@code -Dmiot.conversational.test.pg-url=...} is set; the {@code miot_conversational} and {@code miot_core}
 * schemas are dropped and re-created, so use a scratch database.
 */
@EnabledIfSystemProperty(named = PgRuleStoresTest.URL_PROPERTY, matches = ".+")
class PgRuleStoresTest {

    static final String URL_PROPERTY = "miot.conversational.test.pg-url";
    private static final Duration WAIT = Duration.ofSeconds(10);
    private static final List<String> MIGRATIONS = List.of("V0.7.0__create_conversational_schema.sql",
            "V0.7.1__fork_conversation_per_service.sql", "V0.9.6__conversation_by_context_and_participant.sql",
            "V0.9.8__conversation_rules.sql", "V0.10.1__rule_semantic_versions.sql");
    private static final Instant T0 = Instant.parse("2026-10-23T12:00:00Z");
    private static final ObjectMapper JSON = new ObjectMapper();

    private static Vertx vertx;
    private static Pool pool;

    private final PgRuleStore rules = new PgRuleStore(() -> pool);
    private final PgTemplateStore templates = new PgTemplateStore(() -> pool);
    private final PgRunStore runs = new PgRunStore(() -> pool);

    @BeforeAll
    static void migrate() throws IOException {
        vertx = Vertx.vertx();
        pool = PgBuilder.pool()
                .connectingTo(PgConnectOptions.fromUri(System.getProperty(URL_PROPERTY)))
                .using(vertx).build();
        pool.query("DROP SCHEMA IF EXISTS miot_conversational CASCADE").execute().await().atMost(WAIT);
        pool.query("DROP SCHEMA IF EXISTS miot_core CASCADE").execute().await().atMost(WAIT);
        pool.query("CREATE SCHEMA miot_core; CREATE TABLE miot_core.tenants (id BIGSERIAL PRIMARY KEY)")
                .execute().await().atMost(WAIT);
        for (String file : MIGRATIONS) {
            try (InputStream in = PgRuleStoresTest.class
                    .getResourceAsStream("/db/migration/conversational/" + file)) {
                pool.query(new String(in.readAllBytes(), StandardCharsets.UTF_8)).execute().await().atMost(WAIT);
            }
        }
    }

    @AfterAll
    static void close() {
        pool.close().await().atMost(WAIT);
        vertx.close().await().atMost(WAIT);
    }

    private Rule rule(String tenant, String key) {
        return rules.create(new Rule(UUID.randomUUID().toString(), tenant, key, "Pánico", Rule.State.OFF, null, T0,
                T0));
    }

    @Test
    void draftsPublishAsNumberedVersions() throws Exception {
        String tenant = "tenant-" + UUID.randomUUID();
        Rule rule = rule(tenant, "panic");
        assertThrows(IllegalStateException.class, () -> rule(tenant, "panic"));

        rules.saveDraft(rule.id(), JSON.readTree("{\"steps\":[]}"), "a@example.com", T0);
        RuleVersion draft = rules.saveDraft(rule.id(), JSON.readTree("{\"steps\":[{\"template\":\"x\"}]}"),
                "b@example.com", T0);
        assertEquals(RuleVersion.Status.DRAFT, draft.status());
        assertNull(draft.version());
        assertEquals(1, rules.versions(rule.id()).size());

        assertTrue(rules.publish(rule.id(), JSON.readTree("{\"steps\":[]}"), null, "0.1.0", RuleBump.MINOR, "stale", "b@example.com", T0).isEmpty(),
                "the draft changed after this spec was validated");
        RuleVersion v1 = rules.publish(rule.id(), draft.spec(), null, "0.1.0", RuleBump.MINOR, "first", "b@example.com", T0).orElseThrow();
        assertEquals("0.1.0", v1.version());
        assertEquals(RuleBump.MINOR, v1.bump());
        assertEquals("x", v1.spec().path("steps").get(0).path("template").asText());
        assertTrue(rules.publish(rule.id(), draft.spec(), "0.1.0", "0.1.1", RuleBump.PATCH, "none", "b@example.com", T0).isEmpty());

        RuleVersion second = rules.saveDraft(rule.id(), JSON.readTree("{\"steps\":[]}"), "c@example.com", T0);
        assertTrue(rules.publish(rule.id(), second.spec(), null, "0.1.1", RuleBump.PATCH, "behind", "c@example.com",
                T0).isEmpty(), "another publish moved the current version");
        assertEquals("0.1.1", rules.publish(rule.id(), second.spec(), "0.1.0", "0.1.1", RuleBump.PATCH, "second", "c@example.com", T0)
                .orElseThrow().version());
        rules.saveDraft(rule.id(), JSON.readTree("{}"), "c@example.com", T0);

        List<RuleVersion> versions = rules.versions(rule.id());
        assertEquals(List.of(RuleVersion.Status.DRAFT, RuleVersion.Status.PUBLISHED, RuleVersion.Status.PUBLISHED),
                versions.stream().map(RuleVersion::status).toList());
        assertEquals("0.1.1", rules.find(tenant, rule.id()).orElseThrow().currentVersion());
        assertEquals("first", rules.version(rule.id(), "0.1.0").orElseThrow().reason());

        assertTrue(rules.inForce(tenant).isEmpty());
        rules.updateState(tenant, rule.id(), Rule.State.TEST, T0);
        List<RuleStore.InForce> inForce = rules.inForce(tenant);
        assertEquals(1, inForce.size());
        assertEquals("0.1.1", inForce.get(0).version().version());
        assertTrue(rules.find("other", rule.id()).isEmpty());
        assertTrue(rules.find(tenant, "not-a-uuid").isEmpty());
    }

    @Test
    void templatesUpsertByKey() {
        String tenant = "tenant-" + UUID.randomUUID();
        ConvTemplate first = templates.upsert(new ConvTemplate(UUID.randomUUID().toString(), tenant, "panic-check",
                "Pánico", "Hola {{nombre}}", new ConvTemplate.WhatsApp("miot_panic_check_v1", "es_CL",
                        List.of("nombre", "patente")), null, T0, T0, "a@example.com"));
        ConvTemplate second = templates.upsert(new ConvTemplate(UUID.randomUUID().toString(), tenant, "panic-check",
                "Pánico 2", null, null, new ConvTemplate.Email("Asunto", "Cuerpo"), T0, T0.plusSeconds(5),
                "b@example.com"));

        assertEquals(first.id(), second.id());
        ConvTemplate read = templates.find(tenant, "panic-check").orElseThrow();
        assertEquals("Pánico 2", read.name());
        assertNull(read.whatsapp());
        assertEquals("Asunto", read.email().subject());
        assertEquals(List.of("nombre", "patente"), first.whatsapp().params());
        assertEquals(1, templates.list(tenant).size());
    }

    @Test
    void runsAreClaimedOnceAndOnlyWaitingRunsChange() throws Exception {
        String tenant = "tenant-" + UUID.randomUUID();
        Rule rule = rule(tenant, "panic");
        StoredEvent event = runs.saveEvent(new StoredEvent(UUID.randomUUID().toString(), tenant,
                "symptom.case.opened", "miot-symptoms", "symptom_case", "-7",
                Map.of("symptomKey", "panic-button", "symptomName", "Botón de pánico", "level", 4, "assetId",
                        "ABCD12", "latitude", -33.4), false, T0, T0));
        assertEquals(4, ((Number) runs.event(event.id()).orElseThrow().data().get("level")).intValue());

        Run run = runs.createRun(new Run(UUID.randomUUID().toString(), tenant, rule.id(), "0.1.0", event.id(),
                "symptom_case", "-7", false, Run.Status.WAITING, 0, T0, null, T0, T0));

        List<Run> claimed = runs.claimDue(T0.plusSeconds(1), Duration.ofMinutes(2), 10);
        assertTrue(claimed.stream().anyMatch(r -> r.id().equals(run.id())));
        assertTrue(runs.claimDue(T0.plusSeconds(2), Duration.ofMinutes(2), 10).stream()
                .noneMatch(r -> r.id().equals(run.id())));

        assertTrue(runs.updateIfWaiting(run.advanced(Run.Status.WAITING, 1, T0.plusSeconds(300), "x", T0)));
        assertEquals(1, runs.waiting(tenant, "symptom_case", "-7").size());

        String conversation = conversationWithRunMessage(tenant, run.id(), "SENT");
        assertEquals(run.id(), runs.waitingOnConversation(tenant, conversation).orElseThrow().id());
        assertEquals(run.id(), waitingRunFromInboundLookup(tenant));

        List<RunStore.RunRow> rows = runs.list(tenant, rule.id(), Run.Status.WAITING, 10);
        assertEquals(1, rows.size());
        assertEquals("Pánico", rows.get(0).ruleName());
        assertEquals("symptom.case.opened", rows.get(0).eventType());
        assertEquals("Botón de pánico", rows.get(0).symptomName());
        assertEquals("ABCD12", rows.get(0).assetId());
        List<RunStore.RunMessage> messages = runs.messages(List.of(run.id()));
        assertEquals(1, messages.size());
        assertEquals("SENT", messages.get(0).status());
        assertEquals("Conductor", messages.get(0).toName());

        assertTrue(runs.updateIfWaiting(run.advanced(Run.Status.REPLIED, 1, null, null, T0)));
        assertFalse(runs.updateIfWaiting(run.advanced(Run.Status.DONE, 2, null, null, T0)));
        assertEquals(Run.Status.REPLIED, runs.find(run.id()).orElseThrow().status());
        assertTrue(runs.waiting(tenant, "symptom_case", "-7").isEmpty());
        assertTrue(runs.list(tenant, null, Run.Status.WAITING, 10).isEmpty());
        assertEquals(1, runs.list(tenant, null, null, 10).size());
    }

    @Test
    void aTestRunAndASimulatedMessageTakeNoRealReply() throws Exception {
        String tenant = "tenant-" + UUID.randomUUID();
        Rule rule = rule(tenant, "panic");
        StoredEvent event = runs.saveEvent(new StoredEvent(UUID.randomUUID().toString(), tenant,
                "symptom.case.opened", "miot-symptoms", "symptom_case", "-7", Map.of(), true, T0, T0));
        Run run = runs.createRun(new Run(UUID.randomUUID().toString(), tenant, rule.id(), "0.1.0", event.id(),
                "symptom_case", "-7", true, Run.Status.WAITING, 1, T0, null, T0, T0));

        String conversation = conversationWithRunMessage(tenant, run.id(), "SIMULATED");

        assertTrue(runs.waitingOnConversation(tenant, conversation).isEmpty());
        assertNull(waitingRunFromInboundLookup(tenant));
    }

    /** A conversation with one message of the run to +56900000000, in the given status. */
    private static String conversationWithRunMessage(String tenant, String runId, String status) {
        UUID conversation = UUID.randomUUID();
        pool.preparedQuery("""
                INSERT INTO miot_conversational.wa_conversation
                    (id, tenant_code, phone_e164, participant_address, context_kind, context_key, display_name)
                VALUES ($1, $2, '+56900000000', '+56900000000', 'symptom_case', '-7', 'Conductor')
                """).execute(Tuple.of(conversation, tenant)).await().atMost(WAIT);
        pool.preparedQuery("""
                INSERT INTO miot_conversational.wa_message
                    (id, conversation_id, direction, role, msg_type, body, status, channel, address, run_id, step)
                VALUES ($1, $2, 'OUTBOUND', 'SYSTEM', 'TEMPLATE', 'Hola', $4, 'whatsapp', '+56900000000',
                        $3, 0)
                """).execute(Tuple.of(UUID.randomUUID(), conversation, UUID.fromString(runId), status))
                .await().atMost(WAIT);
        return conversation.toString();
    }

    /** Runs the inbound attachment's waiting-run query, as {@link ConversationRepository} does. */
    private static String waitingRunFromInboundLookup(String tenant) throws Exception {
        Field f = ConversationRepository.class.getDeclaredField("SELECT_WITH_WAITING_RUN");
        f.setAccessible(true);
        var rows = pool.preparedQuery((String) f.get(null)).execute(Tuple.of(tenant, "+56900000000"))
                .await().atMost(WAIT).iterator();
        return rows.hasNext() ? rows.next().getUUID("run_id").toString() : null;
    }
}
