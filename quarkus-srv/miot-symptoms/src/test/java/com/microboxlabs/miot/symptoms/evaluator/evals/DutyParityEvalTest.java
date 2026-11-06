package com.microboxlabs.miot.symptoms.evaluator.evals;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.symptoms.evaluator.evals.DutyReplay.Trip;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import org.junit.jupiter.api.Test;

/**
 * Recorded trips through the duty tracker and the continuous-driving and continuous-resting templates; see
 * {@code evals/duty/README.md}. A trip gives production's transitions, or the same transitions each at most
 * {@value #TOLERANCE_S} s apart, unless {@code known-gaps.json} lists it for that symptom.
 */
class DutyParityEvalTest {

    private static final int TOLERANCE_S = 120;

    enum Verdict { SAME, WITHIN_TOLERANCE, DIFFERENT }

    @Test
    void recordedTripsGiveProductionsTransitions() throws IOException {
        Map<String, String> gaps = knownGaps();
        List<String> unexpected = new ArrayList<>();
        List<String> fixed = new ArrayList<>();
        Map<String, Map<Verdict, Integer>> counts = new TreeMap<>();
        for (Trip t : DutyReplay.replayAll()) {
            for (String s : List.of(DutyReplay.DRIVING, DutyReplay.RESTING)) {
                Verdict v = verdict(t.expected().get(s), t.got().get(s));
                counts.computeIfAbsent(s, k -> new TreeMap<>()).merge(v, 1, Integer::sum);
                String key = t.id() + "/" + s;
                if (v == Verdict.DIFFERENT && !gaps.containsKey(key)) {
                    unexpected.add(key + "\n  production " + t.expected().get(s) + "\n  tracker    " + t.got().get(s));
                } else if (v != Verdict.DIFFERENT && gaps.containsKey(key)) {
                    fixed.add(key);
                }
            }
        }
        System.out.println("duty parity: " + counts);

        assertEquals(List.of(), unexpected, "trips that no longer match production");
        assertEquals(List.of(), fixed, "trips that now match production: remove them from known-gaps.json");
        assertEquals(Map.of(Verdict.SAME, 23, Verdict.WITHIN_TOLERANCE, 8, Verdict.DIFFERENT, 3),
                counts.get(DutyReplay.DRIVING));
        assertEquals(Map.of(Verdict.SAME, 27, Verdict.DIFFERENT, 7),
                counts.get(DutyReplay.RESTING));
    }

    static Verdict verdict(List<String> production, List<String> tracker) {
        if (production.equals(tracker)) {
            return Verdict.SAME;
        }
        if (production.size() != tracker.size()) {
            return Verdict.DIFFERENT;
        }
        for (int i = 0; i < production.size(); i++) {
            String[] p = production.get(i).split("@");
            String[] g = tracker.get(i).split("@");
            String[] pt = p[1].split(":");
            String[] gt = g[1].split(":");
            if (!p[0].equals(g[0]) || !pt[1].equals(gt[1])
                    || Math.abs(Integer.parseInt(pt[0]) - Integer.parseInt(gt[0])) > TOLERANCE_S) {
                return Verdict.DIFFERENT;
            }
        }
        return Verdict.WITHIN_TOLERANCE;
    }

    private static Map<String, String> knownGaps() throws IOException {
        try (InputStream in = DutyParityEvalTest.class.getResourceAsStream("/evals/duty/known-gaps.json")) {
            JsonNode doc = new ObjectMapper().readTree(in);
            Map<String, String> out = new TreeMap<>();
            doc.properties().forEach(e -> out.put(e.getKey(), e.getValue().asText()));
            return out;
        }
    }
}
