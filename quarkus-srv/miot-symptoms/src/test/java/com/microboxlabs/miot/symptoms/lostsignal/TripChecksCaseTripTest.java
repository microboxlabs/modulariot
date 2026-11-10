package com.microboxlabs.miot.symptoms.lostsignal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.evaluator.AssetEpisodes;
import com.microboxlabs.miot.symptoms.evaluator.Episode;
import com.microboxlabs.miot.symptoms.evaluator.Transition;
import com.microboxlabs.miot.symptoms.evaluator.Transition.Kind;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** A lost-signal case's CLOSED change carries the trip its case was opened on. */
class TripChecksCaseTripTest {

    private static final Instant T0 = Instant.parse("2026-01-01T00:00:00Z");
    private static final UUID LOST = UUID.randomUUID();
    private static final UUID OLD = UUID.randomUUID();

    @Test
    void closedChangesTakeTheTripOfTheEpisodeAsLoaded() {
        Episode open = new Episode(LOST, "1.0.0", "TRUCK1", T0, T0, null, Map.of(), T0, T0, 2, 45,
                SymptomState.ACTIVE, null, null, null, "T-1");
        Episode written = new Episode(OLD, "1.0.0", "TRUCK1", T0, T0, null, Map.of(), T0, T0, 1, 30,
                SymptomState.ACTIVE);
        AssetEpisodes state = new AssetEpisodes("tenant-a", "TRUCK1", Map.of(LOST, open, OLD, written), Map.of());
        state.delete("tenant-a", "TRUCK1", LOST);

        List<Transition> out = TripChecks.withCaseTrips(state, List.of(
                new Transition(Kind.CLOSED, LOST, "1.0.0", SymptomState.ACTIVE, "TRUCK1", T0, 2, 2, 45),
                new Transition(Kind.LEVEL_CHANGED, OLD, "1.0.0", SymptomState.ACTIVE, "TRUCK1", T0, 2, 1, 50),
                new Transition(Kind.CLOSED, OLD, "1.0.0", SymptomState.ACTIVE, "TRUCK1", T0, 2, 2, 50)), "T-2", Map.of("check", Map.of("signal_lost_minutes", 50.0)));

        assertEquals("T-1", out.get(0).tripId(), "the episode as loaded, though the close dropped it");
        assertNull(out.get(1).tripId(), "only CLOSED changes");
        assertNull(out.get(2).tripId(), "an episode written before the trip was kept: the check's trip");
        assertEquals(45.0, out.get(0).measure());
        assertEquals(TripEnds.REASON, out.get(0).detail().get("reason"));
        assertEquals(Map.of("signal_lost_minutes", 50.0), out.get(0).detail().get("check"));
    }
}
