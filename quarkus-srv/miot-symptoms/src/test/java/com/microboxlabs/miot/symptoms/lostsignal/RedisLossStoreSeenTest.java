package com.microboxlabs.miot.symptoms.lostsignal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.microboxlabs.miot.core.gps.SignalStates.SignalState;
import com.microboxlabs.miot.core.gps.SignalStates.Status;
import com.microboxlabs.miot.symptoms.evaluator.FakeRedis;
import com.microboxlabs.miot.symptoms.map.SignalStateFields;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** A fleet larger than the Redis client's waiting queue still reads every vehicle's state. */
class RedisLossStoreSeenTest {

    private static final Instant NOW = Instant.parse("2026-01-01T12:00:00Z");
    /** vertx-redis-client's default {@code maxWaitingHandlers}: a longer pipeline is failed whole. */
    private static final int CLIENT_QUEUE = 2048;
    private static final int FLEET = 3000;

    private final FakeRedis redis = new FakeRedis(0).waitingQueue(CLIENT_QUEUE);
    private final RedisLossStore store = new RedisLossStore(redis.mutiny(), Duration.ofDays(7));
    private final ArrivalProfiles profiles = new ArrivalProfiles(store, LossSettings.defaults());
    private final SignalStateReader reader = new SignalStateReader(store, profiles);

    /** Even vehicles reported 30 s ago, odd ones 6 h ago; each has its own sender. */
    private List<String> fleet() {
        List<String> ids = new ArrayList<>();
        for (int i = 0; i < FLEET; i++) {
            String id = "V" + i;
            Instant at = i % 2 == 0 ? NOW.minusSeconds(30) : NOW.minus(Duration.ofHours(6));
            profiles.observe(new Frame(id, "S" + i, at, at.plusSeconds(1), -20.0, -69.0, 50.0, true));
            ids.add(id);
        }
        return ids;
    }

    @Test
    void everyVehicleOfAFleetLargerThanTheClientQueueHasItsState() {
        List<String> ids = fleet();

        Map<String, SignalState> states = reader.states(ids, NOW);

        assertEquals(FLEET, states.size());
        for (int i = 0; i < FLEET; i++) {
            assertEquals(i % 2 == 0 ? Status.ONLINE : Status.OFFLINE, states.get("V" + i).status(), "V" + i);
        }
    }

    @Test
    void theMapPositionsOfAFleetLargerThanTheClientQueueCarryTheirStates() {
        List<String> ids = fleet();
        ArrayNode positions = new ObjectMapper().createArrayNode();
        ids.forEach(id -> positions.addObject().put("asset_id", id).put("timestamp", NOW.toString()));

        JsonNode out = SignalStateFields.withSignal(positions, reader, NOW, Duration.ofDays(1));

        long offline = 0;
        for (JsonNode p : out) {
            String state = p.path("signal").path("state").asText();
            assertTrue(state.equals("online") || state.equals("offline"), p.toString());
            offline += state.equals("offline") ? 1 : 0;
        }
        assertEquals(FLEET / 2, offline);
    }

    @Test
    void aSingleVehicleReadIsOnePipeline() {
        profiles.observe(new Frame("V1", "S1", NOW, NOW.plusSeconds(1), -20.0, -69.0, 50.0, true));
        redis.resetCounts();

        reader.states(List.of("V1"), NOW.plusSeconds(10));

        assertEquals(2, redis.roundTrips(), "the vehicles' read, then the senders' read");
    }
}
