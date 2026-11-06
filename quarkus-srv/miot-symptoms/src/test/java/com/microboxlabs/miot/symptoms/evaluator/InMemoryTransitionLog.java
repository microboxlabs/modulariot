package com.microboxlabs.miot.symptoms.evaluator;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** {@link TransitionLog} as {@code PgTransitionLog} behaves: ids from 1, replays skipped, cases by OPENED row. */
class InMemoryTransitionLog implements TransitionLog {

    final List<Transition> recorded = new ArrayList<>();
    final List<Map<String, Object>> contexts = new ArrayList<>();
    private final Set<String> held = new HashSet<>();
    private final Map<String, Long> openedIds = new HashMap<>();

    @Override
    public List<Recorded> append(String tenantCode, List<Transition> transitions, Place place,
            Map<String, Object> context) {
        List<Recorded> out = new ArrayList<>();
        for (Transition t : transitions) {
            boolean note = t.kind() == Transition.Kind.NOTED;
            Object identity = context != null && context.containsKey("event_id")
                    ? "event:" + context.get("event_id") : "frame:" + t.at();
            if (!held.add(tenantCode + "/" + t.definitionId() + "/" + t.assetId() + "/" + identity + "/" + note)) {
                continue;
            }
            recorded.add(t);
            contexts.add(t.detail() != null ? t.detail() : context);
            long id = recorded.size();
            String caseKey = tenantCode + "/" + t.definitionId() + "/" + t.assetId() + "/" + t.state();
            if (t.kind() == Transition.Kind.OPENED) {
                openedIds.put(caseKey, id);
            }
            out.add(new Recorded(t, openedIds.get(caseKey)));
        }
        return out;
    }
}
