package com.microboxlabs.miot.symptoms.evaluator;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/** {@link TransitionLog} as {@code PgTransitionLog} behaves: ids from 1, replays skipped, cases by OPENED row. */
class InMemoryTransitionLog implements TransitionLog {

    final List<Transition> recorded = new ArrayList<>();
    final List<Map<String, Object>> contexts = new ArrayList<>();
    final List<Place> places = new ArrayList<>();
    private final Set<String> held = new HashSet<>();
    private final Map<String, Long> openedIds = new HashMap<>();

    @Override
    public Opening opening(String tenantCode, Episode episode) {
        for (int i = 0; i < recorded.size(); i++) {
            Transition t = recorded.get(i);
            if (t.kind() == Transition.Kind.OPENED && t.definitionId().equals(episode.definitionId())
                    && t.assetId().equals(episode.assetId()) && t.at().equals(episode.openedAt())) {
                return new Opening(places.get(i).tripId(), contexts.get(i));
            }
        }
        return new Opening(null, Map.of());
    }

    @Override
    public Optional<OperatorClose> lastOperatorClose(String tenantCode, String assetId, UUID definitionId) {
        for (int i = recorded.size() - 1; i >= 0; i--) {
            Transition t = recorded.get(i);
            if (!t.definitionId().equals(definitionId) || !t.assetId().equals(assetId)) {
                continue;
            }
            if (t.kind() == Transition.Kind.OPENED) {
                return Optional.empty();
            }
            if (t.kind() == Transition.Kind.CLOSED) {
                return OperatorClose.fromContext(places.get(i).tripId(), t.at(), contexts.get(i));
            }
        }
        return Optional.empty();
    }

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
            places.add(place.of(t));
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
