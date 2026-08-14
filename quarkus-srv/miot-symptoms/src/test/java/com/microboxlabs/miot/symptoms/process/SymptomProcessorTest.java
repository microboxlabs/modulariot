package com.microboxlabs.miot.symptoms.process;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.route.RouteTable;
import com.microboxlabs.miot.symptoms.route.RouteTableHolder;
import com.microboxlabs.miot.symptoms.route.SymptomRoute;
import io.smallrye.mutiny.Uni;
import io.vertx.core.json.JsonObject;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SymptomProcessorTest {

    private RouteTableHolder holder;
    private FakeFunctions functions;
    private FakeWebhooks webhooks;
    private SymptomProcessor processor;

    @BeforeEach
    void setUp() {
        holder = new RouteTableHolder();
        functions = new FakeFunctions();
        webhooks = new FakeWebhooks();
        processor = new SymptomProcessor(holder, functions, webhooks);
        holder.replace(RouteTable.of(List.of(new SymptomRoute(
                "off-hours-driving",
                List.of("4"),
                List.of(),
                "process_symptoms_off_hours_driving",
                null,
                2,
                30))));
    }

    @Test
    void skipsDeletesAndReads() {
        assertEquals("op", processor.process(new JsonObject().put("op", "d")).await().indefinitely().reason());
        assertEquals("op", processor.process(new JsonObject().put("op", "r")).await().indefinitely().reason());
        assertEquals(0, functions.calls.get());
    }

    @Test
    void skipsUnownedRuleId() {
        JsonObject payload = debezium("c", 9);
        ProcessOutcome out = processor.process(payload).await().indefinitely();
        assertEquals(ProcessOutcome.Kind.SKIPPED, out.kind());
        assertEquals("no_route", out.reason());
        assertEquals(0, functions.calls.get());
    }

    @Test
    void invokesPostgresForOwnedInsert() {
        ProcessOutcome out = processor.process(debezium("c", 4)).await().indefinitely();
        assertEquals(ProcessOutcome.Kind.PROCESSED, out.kind());
        assertEquals("off-hours-driving", out.symptom());
        assertEquals(1, functions.calls.get());
        assertEquals("process_symptoms_off_hours_driving", functions.lastFunction);
        assertTrue(functions.lastPayload.getString("op").equals("c"));
        assertEquals(0, webhooks.sent.size());
    }

    @Test
    void forwardsWhenRouteHasWebhookAndEnvelopeAllows() {
        holder.replace(RouteTable.of(List.of(new SymptomRoute(
                "load",
                List.of("17"),
                List.of(),
                "process_symptoms_check_deficient_load_securing",
                "https://router.example/hook",
                2,
                30))));
        functions.nextResult = new JsonObject().put("status", 200).put("data", new JsonObject());
        ProcessOutcome out = processor.process(debezium("u", 17)).await().indefinitely();
        assertEquals(ProcessOutcome.Kind.PROCESSED, out.kind());
        assertEquals(1, webhooks.sent.size());
        assertEquals("https://router.example/hook", webhooks.sent.get(0));
    }

    @Test
    void doesNotForwardStatus204() {
        holder.replace(RouteTable.of(List.of(new SymptomRoute(
                "load",
                List.of("17"),
                List.of(),
                "process_symptoms_check_deficient_load_securing",
                "https://router.example/hook",
                2,
                30))));
        functions.nextResult = new JsonObject().put("status", 204);
        processor.process(debezium("c", 17)).await().indefinitely();
        assertEquals(0, webhooks.sent.size());
    }

    private static JsonObject debezium(String op, int ruleId) {
        return new JsonObject()
                .put("op", op)
                .put("after", new JsonObject().put("rule_id", ruleId).put("asset_id", "TRK-1"));
    }

    private static final class FakeFunctions implements FunctionInvoker {
        final AtomicInteger calls = new AtomicInteger();
        String lastFunction;
        JsonObject lastPayload;
        JsonObject nextResult = new JsonObject().put("status", 200);

        @Override
        public Uni<JsonObject> invoke(String functionName, JsonObject debeziumPayload) {
            calls.incrementAndGet();
            lastFunction = functionName;
            lastPayload = debeziumPayload;
            return Uni.createFrom().item(nextResult);
        }
    }

    private static final class FakeWebhooks implements WebhookForwarder {
        final List<String> sent = new ArrayList<>();
        private final ResultForwarder contract = new ResultForwarder(null, java.time.Duration.ofSeconds(1));

        @Override
        public boolean shouldForward(JsonObject result) {
            return contract.shouldForward(result);
        }

        @Override
        public Uni<Void> forward(String url, JsonObject result) {
            sent.add(url);
            return Uni.createFrom().voidItem();
        }
    }
}
