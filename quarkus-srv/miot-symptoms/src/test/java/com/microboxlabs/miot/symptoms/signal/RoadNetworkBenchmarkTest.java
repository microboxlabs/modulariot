package com.microboxlabs.miot.symptoms.signal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.signal.GpsSignal.WeightCategory;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/**
 * Lookup time and memory of {@link RoadNetwork} on synthetic tiles shaped like the GPS database's: an average
 * tile of 40 ways and 570 points, and the densest of 900 ways and 6,000 points. Run with
 * {@code -Dmiot.symptoms.benchmark=true}; it reports lookup timings and checks the retained tiles.
 */
@EnabledIfSystemProperty(named = "miot.symptoms.benchmark", matches = "true")
class RoadNetworkBenchmarkTest {

    private static List<RoadNetwork.Way> ways(Random r, double x0, double y0, int count, int points) {
        List<RoadNetwork.Way> out = new ArrayList<>(count);
        int perWay = Math.max(2, points / count);
        for (int i = 0; i < count; i++) {
            double[] xy = new double[perWay * 2];
            double x = x0 + r.nextDouble() * RoadNetwork.TILE_DEG;
            double y = y0 + r.nextDouble() * RoadNetwork.TILE_DEG;
            double dx = (r.nextDouble() - 0.5) * 0.0006;
            double dy = (r.nextDouble() - 0.5) * 0.0006;
            for (int j = 0; j < perWay; j++) {
                xy[j * 2] = x + dx * j;
                xy[j * 2 + 1] = y + dy * j;
            }
            out.add(new RoadNetwork.Way(i, i % 10 == 0 ? "primary_link" : "residential", 50, 50, 60,
                    RoadNetworkTest.wkb(xy)));
        }
        return out;
    }

    private static void time(String name, RoadNetwork.Tile tile, double x0, double y0, Random r) {
        int n = 2_000_000;
        double[] pts = new double[n * 2];
        for (int i = 0; i < n; i++) {
            pts[i * 2] = x0 + r.nextDouble() * RoadNetwork.TILE_DEG;
            pts[i * 2 + 1] = y0 + r.nextDouble() * RoadNetwork.TILE_DEG;
        }
        int found = 0;
        for (int round = 0; round < 3; round++) {
            found = 0;
            long t0 = System.nanoTime();
            for (int i = 0; i < n; i++) {
                if (tile.limit(pts[i * 2], pts[i * 2 + 1], WeightCategory.HEAVY) != null) {
                    found++;
                }
            }
            long ns = System.nanoTime() - t0;
            System.out.printf("%s: %.0f ns per lookup (round %d, %d%% near a road), tile %d bytes%n", name,
                    (double) ns / n, round, found * 100 / n, tile.bytes());
        }
    }

    @Test
    void lookupAndMemory() {
        Random r = new Random(7);
        double x0 = -70.66;
        double y0 = -33.46;
        time("average tile", RoadNetwork.Tile.of(x0, y0, ways(r, x0, y0, 40, 570)), x0, y0, r);
        time("densest tile", RoadNetwork.Tile.of(x0, y0, ways(r, x0, y0, 900, 6000)), x0, y0, r);

        System.gc();
        long before = Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory();
        List<RoadNetwork.Tile> kept = new ArrayList<>();
        long arrays = 0;
        for (int i = 0; i < 1821; i++) {
            RoadNetwork.Tile t = RoadNetwork.Tile.of(x0, y0, ways(r, x0, y0, 40, 570));
            kept.add(t);
            arrays += t.bytes();
        }
        System.gc();
        long after = Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory();
        System.out.printf("1,821 average tiles: %.1f MB of arrays, %.1f MB of heap%n", arrays / 1e6,
                (after - before) / 1e6);
        assertEquals(1821, kept.size());
        assertTrue(arrays > 0);
    }
}
