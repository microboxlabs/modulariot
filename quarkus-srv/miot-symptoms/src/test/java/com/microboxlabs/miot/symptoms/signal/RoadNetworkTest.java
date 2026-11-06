package com.microboxlabs.miot.symptoms.signal;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.microboxlabs.miot.symptoms.signal.GpsSignal.WeightCategory;
import io.smallrye.mutiny.Uni;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class RoadNetworkTest {

    /** About 1 m in degrees of latitude. */
    private static final double M = 0.000009;

    static byte[] wkb(double... xy) {
        ByteBuffer b = ByteBuffer.allocate(9 + xy.length * 8).order(ByteOrder.LITTLE_ENDIAN);
        b.put((byte) 1).putInt(2).putInt(xy.length / 2);
        for (double v : xy) {
            b.putDouble(v);
        }
        return b.array();
    }

    /** A west–east way along {@code lat}. */
    static RoadNetwork.Way way(long id, String roadClass, Integer light, Integer heavy, Integer maxspeed, double lat) {
        return new RoadNetwork.Way(id, roadClass, light, heavy, maxspeed, wkb(-70.70, lat, -70.60, lat));
    }

    private static RoadNetwork.Limit at(RoadNetwork roads, double lon, double lat, WeightCategory weight) {
        roads.ensure(lon, lat).await().indefinitely();
        return roads.at(lon, lat, weight);
    }

    @Test
    void theNearestRoadWithinTheBufferGivesItsLimitForTheWeight() {
        RoadNetwork roads = RoadNetwork.of(List.of(way(1, "primary", 60, 50, 70, -33.4500)));

        assertEquals(new RoadNetwork.Limit(50, 1, "primary"), at(roads, -70.65, -33.4500 + 5 * M, WeightCategory.HEAVY));
        assertEquals(60, at(roads, -70.65, -33.4500 + 5 * M, WeightCategory.LIGHT).maxspeed());
        assertNull(at(roads, -70.65, -33.4500 + 15 * M, WeightCategory.HEAVY), "over 0.0001° away: no road");
    }

    @Test
    void withoutAWeightLimitTheRoadsMaxspeedApplies() {
        RoadNetwork roads = RoadNetwork.of(List.of(way(1, "trunk", 0, null, 100, -33.45)));

        assertEquals(100, at(roads, -70.65, -33.45, WeightCategory.HEAVY).maxspeed());
        assertEquals(100, at(roads, -70.65, -33.45, WeightCategory.LIGHT).maxspeed());
    }

    @Test
    void aNearestRoadWithoutALimitGivesNone() {
        RoadNetwork roads = RoadNetwork.of(List.of(way(1, "service", null, null, 0, -33.45),
                way(2, "primary", 60, 60, 60, -33.45 + 8 * M)));

        assertNull(at(roads, -70.65, -33.45 + 2 * M, WeightCategory.HEAVY));
        assertEquals(60, at(roads, -70.65, -33.45 + 6 * M, WeightCategory.HEAVY).maxspeed());
    }

    @Test
    void aMainRoadWinsOverANearerLink() {
        RoadNetwork roads = RoadNetwork.of(List.of(way(1, "motorway_link", 60, 60, 60, -33.45),
                way(2, "motorway", 100, 100, 100, -33.45 + 9 * M)));

        assertEquals(new RoadNetwork.Limit(100, 2, "motorway"), at(roads, -70.65, -33.45 + M, WeightCategory.HEAVY));
        assertEquals(60, at(roads, -70.65, -33.45 - 3 * M, WeightCategory.HEAVY).maxspeed(),
                "the main road is out of the buffer");
    }

    @Test
    void aRoadAcrossTilesIsFoundFromEitherTileAndNearTheEdge() {
        double edge = Math.floor(-33.45 / RoadNetwork.TILE_DEG) * RoadNetwork.TILE_DEG;
        RoadNetwork roads = RoadNetwork.of(List.of(way(1, "primary", 80, 80, 80, edge)));

        assertEquals(80, at(roads, -70.65, edge + 3 * M, WeightCategory.HEAVY).maxspeed());
        assertEquals(80, at(roads, -70.65, edge - 3 * M, WeightCategory.HEAVY).maxspeed());
        assertEquals(80, at(roads, -70.65, edge, WeightCategory.HEAVY).maxspeed());
    }

    @Test
    void theDistanceIsToTheSegmentNotToItsPoints() {
        RoadNetwork roads = RoadNetwork.of(List.of(new RoadNetwork.Way(1, "primary", 50, 50, 50,
                wkb(-70.70, -33.40, -70.60, -33.50))));

        assertEquals(50, at(roads, -70.65, -33.45 + 5 * M, WeightCategory.HEAVY).maxspeed());
    }

    @Test
    void readsEwkbAndMultiLines() {
        ByteBuffer b = ByteBuffer.allocate(64).order(ByteOrder.BIG_ENDIAN);
        b.put((byte) 0).putInt(0x20000002).putInt(4326).putInt(2).putDouble(1).putDouble(2).putDouble(3).putDouble(4);
        assertArrayEquals(new double[] {1, 2, 3, 4}, RoadNetwork.lineString(java.util.Arrays.copyOf(b.array(),
                b.position())));

        byte[] one = wkb(1, 2, 3, 4);
        ByteBuffer multi = ByteBuffer.allocate(9 + one.length * 2).order(ByteOrder.LITTLE_ENDIAN);
        multi.put((byte) 1).putInt(5).putInt(2).put(one).put(one);
        assertArrayEquals(new double[] {1, 2, 3, 4, Double.NaN, Double.NaN, 1, 2, 3, 4},
                RoadNetwork.lineString(multi.array()));

        ByteBuffer point = ByteBuffer.allocate(21).order(ByteOrder.LITTLE_ENDIAN);
        point.put((byte) 1).putInt(1).putDouble(1).putDouble(2);
        assertArrayEquals(new double[0], RoadNetwork.lineString(point.array()));
    }

    @Test
    void disconnectedLinesNeverCreateARoadAcrossTheGap() {
        byte[] west = wkb(-70.68, -33.45, -70.67, -33.45);
        byte[] east = wkb(-70.63, -33.45, -70.62, -33.45);
        ByteBuffer multi = ByteBuffer.allocate(9 + west.length + east.length).order(ByteOrder.LITTLE_ENDIAN);
        multi.put((byte) 1).putInt(5).putInt(2).put(west).put(east);
        RoadNetwork roads = RoadNetwork.of(List.of(new RoadNetwork.Way(1, "primary", 50, 50, 50, multi.array())));

        assertNull(at(roads, -70.65, -33.45, WeightCategory.HEAVY), "no segment between the parts");
        assertEquals(50, at(roads, -70.675, -33.45, WeightCategory.HEAVY).maxspeed());
        assertEquals(50, at(roads, -70.625, -33.45, WeightCategory.HEAVY).maxspeed());
    }

    @Test
    void invalidWkbDoesNotHideValidWaysOrAllocateFromAnUncheckedCount() {
        byte[] invalid = ByteBuffer.allocate(9).order(ByteOrder.LITTLE_ENDIAN)
                .put((byte) 1).putInt(2).putInt(Integer.MAX_VALUE).array();
        RoadNetwork roads = RoadNetwork.of(List.of(new RoadNetwork.Way(1, "primary", 90, 90, 90, invalid),
                way(2, "service", 30, 30, 30, -33.45)));

        assertArrayEquals(new double[0], RoadNetwork.lineString(invalid));
        assertArrayEquals(new double[0], RoadNetwork.lineString(new byte[3]));
        assertEquals(30, at(roads, -70.65, -33.45, WeightCategory.HEAVY).maxspeed());
    }

    @Test
    void simultaneousFramesShareOneTileReadAndCachedFramesNeverReadAgain() {
        AtomicInteger reads = new AtomicInteger();
        CompletableFuture<List<RoadNetwork.Way>> rows = new CompletableFuture<>();
        RoadNetwork roads = new RoadNetwork((a, b, c, d) -> {
            reads.incrementAndGet();
            return Uni.createFrom().completionStage(rows);
        }, 2, Duration.ofHours(1), Clock.systemUTC());
        List<CompletableFuture<Void>> waiting = new ArrayList<>();
        for (int i = 0; i < 100; i++) {
            waiting.add(roads.ensure(-70.65, -33.45).subscribeAsCompletionStage());
        }
        assertEquals(1, reads.get(), "one GPS query for all waiting frames");
        rows.complete(List.of(way(1, "primary", 50, 50, 50, -33.45)));
        CompletableFuture.allOf(waiting.toArray(CompletableFuture<?>[]::new)).join();
        for (int i = 0; i < 1000; i++) {
            assertEquals(50, at(roads, -70.65, -33.45, WeightCategory.HEAVY).maxspeed());
        }
        assertEquals(1, reads.get(), "cached frames perform no GPS reads");
    }

    @Test
    void anEmptyTileIsCachedAndInvalidCacheSettingsAreRejected() {
        AtomicInteger reads = new AtomicInteger();
        Clock clock = Clock.systemUTC();
        Duration ttl = Duration.ofHours(1);
        RoadNetwork.Source source = (a, b, c, d) -> {
            reads.incrementAndGet();
            return Uni.createFrom().item(List.of());
        };
        RoadNetwork roads = new RoadNetwork(source, 2, ttl, clock);

        assertNull(at(roads, -70.65, -33.45, WeightCategory.HEAVY));
        assertNull(at(roads, -70.65, -33.45, WeightCategory.HEAVY));
        assertEquals(1, reads.get());
        assertThrows(IllegalArgumentException.class,
                () -> new RoadNetwork(source, 0, ttl, clock));
        assertThrows(IllegalArgumentException.class,
                () -> new RoadNetwork(source, 1, Duration.ZERO, clock));
    }

    @Test
    void aTileIsReadOnceUntilItExpiresAndTheLeastRecentlyReadIsDropped() {
        AtomicInteger reads = new AtomicInteger();
        MutableClock clock = new MutableClock();
        RoadNetwork roads = new RoadNetwork((a, b, c, d) -> {
            reads.incrementAndGet();
            return Uni.createFrom().item(List.of(way(1, "primary", 50, 50, 50, -33.45)));
        }, 2, Duration.ofHours(1), clock);

        at(roads, -70.65, -33.45, WeightCategory.HEAVY);
        at(roads, -70.65, -33.45, WeightCategory.HEAVY);
        assertEquals(1, reads.get());

        at(roads, -70.60, -33.45, WeightCategory.HEAVY);
        at(roads, -70.55, -33.45, WeightCategory.HEAVY);
        assertEquals(2, roads.tileCount());
        at(roads, -70.65, -33.45, WeightCategory.HEAVY);
        assertEquals(4, reads.get(), "the first tile was dropped");

        clock.now = clock.now.plus(Duration.ofHours(2));
        at(roads, -70.65, -33.45, WeightCategory.HEAVY);
        assertEquals(5, reads.get(), "an expired tile is read again");
    }

    @Test
    void aFailedTileIsReadAgainAndGivesNoLimitMeanwhile() {
        AtomicInteger reads = new AtomicInteger();
        RoadNetwork roads = new RoadNetwork((a, b, c, d) -> reads.incrementAndGet() == 1
                ? Uni.createFrom().failure(new IllegalStateException("down"))
                : Uni.createFrom().item(List.of(way(1, "primary", 50, 50, 50, -33.45))),
                10, Duration.ofHours(1), Clock.systemUTC());

        assertNull(at(roads, -70.65, -33.45, WeightCategory.HEAVY));
        assertEquals(50, at(roads, -70.65, -33.45, WeightCategory.HEAVY).maxspeed());
    }

    @Test
    void beforeItsTileIsLoadedAPointHasNoLimit() {
        RoadNetwork roads = RoadNetwork.of(List.of(way(1, "primary", 50, 50, 50, -33.45)));
        assertNull(roads.at(-70.65, -33.45, WeightCategory.HEAVY));
    }

    static final class MutableClock extends Clock {
        Instant now = Instant.parse("2026-11-01T00:00:00Z");

        @Override
        public ZoneOffset getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
