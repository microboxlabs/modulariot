package com.microboxlabs.miot.symptoms.process;

import com.microboxlabs.miot.symptoms.route.RouteTableHolder;
import com.microboxlabs.miot.symptoms.route.SymptomRoute;
import io.smallrye.mutiny.Uni;
import io.vertx.core.json.JsonObject;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.jboss.logging.Logger;

/**
 * Debezium {@code accumulated_states} → RouteTable → optional PG → optional HTTP.
 */
@ApplicationScoped
public class SymptomProcessor {

    private static final Logger LOG = Logger.getLogger(SymptomProcessor.class);

    private final RouteTableHolder routes;
    private final FunctionInvoker functions;
    private final WebhookForwarder webhooks;
    private final Map<String, RouteBulkhead> bulkheads = new ConcurrentHashMap<>();

    SymptomProcessor(RouteTableHolder routes, FunctionInvoker functions, WebhookForwarder webhooks) {
        this.routes = routes;
        this.functions = functions;
        this.webhooks = webhooks;
    }

    public Uni<ProcessOutcome> process(JsonObject payload) {
        String op = payload == null ? null : payload.getString("op");
        if (op == null || (!"c".equals(op) && !"u".equals(op))) {
            return Uni.createFrom().item(ProcessOutcome.skipped("op"));
        }

        JsonObject after = payload.getJsonObject("after");
        if (after == null) {
            return Uni.createFrom().item(ProcessOutcome.skipped("no_after"));
        }
        Integer ruleId = after.getInteger("rule_id", -1);
        Optional<SymptomRoute> match = routes.get().match(ruleId);
        if (match.isEmpty()) {
            return Uni.createFrom().item(ProcessOutcome.skipped("no_route"));
        }

        SymptomRoute route = match.get();
        RouteBulkhead bulkhead = bulkheads.computeIfAbsent(
                route.name(),
                n -> new RouteBulkhead(
                        n, route.concurrency(), Duration.ofSeconds(route.timeoutSeconds())));

        Uni<JsonObject> afterPg = route.hasPostgres()
                ? functions.invoke(route.postgresFunction(), payload)
                : Uni.createFrom().item(payload);

        Uni<Void> pipeline = afterPg.chain(result -> {
            if (!route.hasWebhook()) {
                return Uni.createFrom().voidItem();
            }
            if (!webhooks.shouldForward(result)) {
                LOG.debugf("Skipping webhook for %s (forward flag / status 204)", route.name());
                return Uni.createFrom().voidItem();
            }
            return webhooks.forward(route.webhookUrl(), result);
        });

        return bulkhead.execute(pipeline).replaceWith(ProcessOutcome.processed(route.name()));
    }
}
