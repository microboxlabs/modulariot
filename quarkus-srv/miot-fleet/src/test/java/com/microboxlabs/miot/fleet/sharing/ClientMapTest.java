package com.microboxlabs.miot.fleet.sharing;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class ClientMapTest {

    private static final Instant T0 = Instant.parse("2026-10-01T00:00:00Z");
    private static final Instant T1 = Instant.parse("2026-11-01T00:00:00Z");
    private static final Instant T2 = Instant.parse("2026-12-01T00:00:00Z");

    @Test
    void widenKeepsTheEarliestStartAndTheLatestEnd() {
        ClientMap.Row a = new ClientMap.Row("A", "c", T1, T1);
        ClientMap.Row b = new ClientMap.Row("A", "c", T0, T2);
        assertEquals(new ClientMap.Row("A", "c", T0, T2), a.widen(b));
        assertNull(a.widen(new ClientMap.Row("A", "c", T1, null)).validTo());
    }

    @Test
    void planInsertsUpdatesAndDeletes() {
        List<ClientMap.Row> desired = List.of(
                new ClientMap.Row("new", "c", T0, null),
                new ClientMap.Row("moved", "c", T0, T2),
                new ClientMap.Row("same", "c", T0, null));
        List<ClientMap.Row> existing = List.of(
                new ClientMap.Row("moved", "c", T0, T1),
                new ClientMap.Row("same", "c", T0, ClientMap.NO_END),
                new ClientMap.Row("gone", "c", T0, T1));

        ClientMap.Plan plan = ClientMap.plan(desired, existing);

        assertEquals(List.of("new"), plan.insert().stream().map(ClientMap.Row::assetId).toList());
        assertEquals(List.of("moved"), plan.update().stream().map(ClientMap.Row::assetId).toList());
        assertEquals(List.of("gone"), plan.delete().stream().map(ClientMap.Row::assetId).toList());
    }

    @Test
    void timesReadBackFromPostgresDoNotLookChanged() {
        Instant precise = Instant.parse("2026-10-01T00:00:00.123456789Z");
        ClientMap.Row computed = new ClientMap.Row("A", "c", precise, null);
        ClientMap.Row stored = new ClientMap.Row("A", "c", Instant.parse("2026-10-01T00:00:00.123456Z"),
                ClientMap.NO_END);
        assertTrue(ClientMap.plan(List.of(computed), List.of(stored)).isEmpty());
    }
}
