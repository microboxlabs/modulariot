package com.microboxlabs.miot.conversational.rules;

import com.microboxlabs.miot.conversational.domain.ContextKind;
import com.microboxlabs.miot.conversational.rules.store.RunStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** The runs of the organization's rules, newest first, with their messages: the Activity tab. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class RunsService {

    static final int DEFAULT_LIMIT = 50;
    static final int MAX_LIMIT = 200;

    public record RunMessageView(String id, Integer step, String channel, String to, String toName, String status,
            String text, Instant at) {
    }

    /** {@code symptomName} and {@code assetId} come from the event of a {@code symptom_case} run; null otherwise. */
    public record RunView(String id, String ruleId, String ruleName, String ruleVersion, String eventId,
            String eventType, String contextKind, String contextKey, String symptomName, String assetId,
            boolean test, Run.Status status, int step, Instant nextAt, String lastError, Instant createdAt,
            Instant updatedAt, List<RunMessageView> messages) {
    }

    private final RunStore runs;

    @Inject
    public RunsService(RunStore runs) {
        this.runs = runs;
    }

    public List<RunView> list(String tenantCode, String ruleId, Run.Status status, Integer limit) {
        int n = limit == null || limit <= 0 ? DEFAULT_LIMIT : Math.min(limit, MAX_LIMIT);
        List<RunStore.RunRow> rows = runs.list(tenantCode, ruleId, status, n);
        Map<String, List<RunMessageView>> byRun = new LinkedHashMap<>();
        for (RunStore.RunMessage m : runs.messages(rows.stream().map(r -> r.run().id()).toList())) {
            byRun.computeIfAbsent(m.runId(), k -> new ArrayList<>()).add(new RunMessageView(m.id(), m.step(),
                    m.channel(), m.to(), m.toName(), m.status(), m.text(), m.at()));
        }
        return rows.stream().map(row -> {
            Run r = row.run();
            boolean symptomCase = ContextKind.SYMPTOM_CASE.dbValue().equals(r.contextKind());
            return new RunView(r.id(), r.ruleId(), row.ruleName(), r.ruleVersion(), r.eventId(), row.eventType(),
                    r.contextKind(), r.contextKey(), symptomCase ? row.symptomName() : null,
                    symptomCase ? row.assetId() : null, r.test(), r.status(), r.step(), r.nextAt(), r.lastError(),
                    r.createdAt(), r.updatedAt(), byRun.getOrDefault(r.id(), List.of()));
        }).toList();
    }
}
