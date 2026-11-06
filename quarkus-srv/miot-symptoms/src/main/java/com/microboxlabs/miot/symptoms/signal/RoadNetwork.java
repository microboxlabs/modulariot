package com.microboxlabs.miot.symptoms.signal;

import io.smallrye.mutiny.Uni;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;

/**
 * The OSM road limits for {@code signal.road}, from the GPS database's {@code osm_roads_weight}, as the GPS
 * database's speed function reads them: the road nearest the point within {@value #NEAR_DEG}° (planar degrees),
 * a main road before a {@code _link}, and its limit for the vehicle's weight, else its {@code maxspeed}. No road
 * near, or a nearest road without a limit, gives no limit.
 *
 * <p>Roads are loaded by tiles of {@value #TILE_DEG}°, on the first frame in a tile, and kept for {@code ttl}; at
 * most {@code maxTiles} tiles are kept, the least recently read is dropped first. A tile that failed to load is
 * read again on the next frame in it.
 */
public class RoadNetwork {

    static final double TILE_DEG = 0.02;
    static final double NEAR_DEG = 0.0001;
    /** Cells per tile side for the lookup inside a tile. */
    static final int CELLS = 20;
    static final double CELL_DEG = TILE_DEG / CELLS;

    /** One {@code osm_roads_weight} row; {@code wkb} is its line as WKB. */
    public record Way(long id, String roadClass, Integer light, Integer heavy, Integer maxspeed, byte[] wkb) {

        @Override
        public boolean equals(Object other) {
            return other instanceof Way(var otherId, var otherClass, var otherLight, var otherHeavy,
                    var otherMaxspeed, var otherWkb) && id == otherId && Objects.equals(roadClass, otherClass)
                    && Objects.equals(light, otherLight) && Objects.equals(heavy, otherHeavy)
                    && Objects.equals(maxspeed, otherMaxspeed) && Arrays.equals(wkb, otherWkb);
        }

        @Override
        public int hashCode() {
            return 31 * Objects.hash(id, roadClass, light, heavy, maxspeed) + Arrays.hashCode(wkb);
        }

        @Override
        public String toString() {
            return "Way[id=" + id + ", roadClass=" + roadClass + ", light=" + light + ", heavy=" + heavy
                    + ", maxspeed=" + maxspeed + ", wkb=" + Arrays.toString(wkb) + "]";
        }
    }

    /** The limit of the road at a point, and the road it comes from. */
    public record Limit(double maxspeed, long wayId, String roadClass) {
    }

    /** Reads the ways whose bounding box meets {@code [minLon, minLat, maxLon, maxLat]}. */
    @FunctionalInterface
    public interface Source {
        Uni<List<Way>> ways(double minLon, double minLat, double maxLon, double maxLat);
    }

    private record Entry(Tile tile, Instant loadedAt) {
    }

    private final Source source;
    private final int maxTiles;
    private final Duration ttl;
    private final Clock clock;
    private final Map<Long, Entry> tiles;
    private final Map<Long, Uni<Tile>> loading = new java.util.concurrent.ConcurrentHashMap<>();

    public RoadNetwork(Source source, int maxTiles, Duration ttl, Clock clock) {
        if (maxTiles <= 0 || ttl.isNegative() || ttl.isZero()) {
            throw new IllegalArgumentException("Road tiles require a positive capacity and TTL");
        }
        this.source = source;
        this.maxTiles = maxTiles;
        this.ttl = ttl;
        this.clock = clock;
        this.tiles = new LinkedHashMap<>(256, 0.75f, true);
    }

    static long key(double lon, double lat) {
        long x = (long) Math.floor(lon / TILE_DEG);
        long y = (long) Math.floor(lat / TILE_DEG);
        return (x << 32) ^ (y & 0xffffffffL);
    }

    /** Loads the point's tile when it is not kept; completes without failing. */
    public Uni<Void> ensure(double lon, double lat) {
        long k = key(lon, lat);
        if (tile(k) != null) {
            return Uni.createFrom().voidItem();
        }
        return loading.computeIfAbsent(k, key -> load(lon, lat, key)).replaceWithVoid()
                .onFailure().recoverWithNull();
    }

    private Uni<Tile> load(double lon, double lat, long k) {
        double x0 = Math.floor(lon / TILE_DEG) * TILE_DEG;
        double y0 = Math.floor(lat / TILE_DEG) * TILE_DEG;
        return Uni.createFrom().deferred(() -> source.ways(x0 - NEAR_DEG, y0 - NEAR_DEG, x0 + TILE_DEG + NEAR_DEG,
                        y0 + TILE_DEG + NEAR_DEG))
                .map(ways -> Tile.of(x0, y0, ways))
                .invoke(t -> put(k, t))
                .eventually(() -> {
                    loading.remove(k);
                })
                .memoize().indefinitely();
    }

    private synchronized Tile tile(long k) {
        Entry e = tiles.get(k);
        if (e == null) {
            return null;
        }
        if (Duration.between(e.loadedAt(), clock.instant()).compareTo(ttl) > 0) {
            tiles.remove(k);
            return null;
        }
        return e.tile();
    }

    synchronized void put(long k, Tile t) {
        tiles.put(k, new Entry(t, clock.instant()));
        while (tiles.size() > maxTiles) {
            Long eldest = tiles.keySet().iterator().next();
            tiles.remove(eldest);
        }
    }

    public synchronized int tileCount() {
        return tiles.size();
    }

    /** Bytes held by the kept tiles' arrays. */
    public synchronized long bytes() {
        return tiles.values().stream().mapToLong(e -> e.tile().bytes()).sum();
    }

    /**
     * The limit at the point for a vehicle of the category; null when the tile is not loaded, no road is near, or
     * the nearest road has no limit.
     */
    public Limit at(double lon, double lat, GpsSignal.WeightCategory weight) {
        Tile t = tile(key(lon, lat));
        return t == null ? null : t.limit(lon, lat, weight);
    }

    /**
     * The ways of one tile. Points are float offsets from the tile's corner, about a millimetre apart at most.
     * Each cell lists the ways whose box, grown by {@value #NEAR_DEG}°, meets it.
     */
    static final class Tile {

        private final double x0;
        private final double y0;
        private final long[] ids;
        private final String[] classes;
        private final short[] light;
        private final short[] heavy;
        private final short[] maxspeed;
        private final boolean[] link;
        private final int[] start;
        private final float[] xy;
        private final int[] cellStart;
        private final int[] cellWays;

        private Tile(double x0, double y0, List<Way> ways) {
            this.x0 = x0;
            this.y0 = y0;
            List<double[]> lines = new ArrayList<>(ways.size());
            List<Way> kept = new ArrayList<>(ways.size());
            for (Way w : ways) {
                double[] line = lineString(w.wkb());
                if (line.length >= 4) {
                    lines.add(line);
                    kept.add(w);
                }
            }
            int n = kept.size();
            ids = new long[n];
            classes = new String[n];
            light = new short[n];
            heavy = new short[n];
            maxspeed = new short[n];
            link = new boolean[n];
            start = new int[n + 1];
            int points = 0;
            for (double[] l : lines) {
                points += l.length;
            }
            xy = new float[points];
            List<List<Integer>> cells = new ArrayList<>(CELLS * CELLS);
            for (int c = 0; c < CELLS * CELLS; c++) {
                cells.add(new ArrayList<>(2));
            }
            int p = 0;
            for (int i = 0; i < n; i++) {
                p = indexWay(kept.get(i), i, lines.get(i), p, cells);
            }
            start[n] = p;
            cellStart = new int[CELLS * CELLS + 1];
            int total = 0;
            for (int c = 0; c < cells.size(); c++) {
                cellStart[c] = total;
                total += cells.get(c).size();
            }
            cellStart[cells.size()] = total;
            cellWays = new int[total];
            int q = 0;
            for (List<Integer> c : cells) {
                for (int i : c) {
                    cellWays[q++] = i;
                }
            }
        }

        private int indexWay(Way w, int i, double[] line, int p, List<List<Integer>> cells) {
            ids[i] = w.id();
            classes[i] = w.roadClass() == null ? null : w.roadClass().intern();
            light[i] = speed(w.light());
            heavy[i] = speed(w.heavy());
            maxspeed[i] = speed(w.maxspeed());
            link[i] = w.roadClass() != null && w.roadClass().endsWith("_link");
            start[i] = p;
            double minX = Double.MAX_VALUE;
            double minY = Double.MAX_VALUE;
            double maxX = -Double.MAX_VALUE;
            double maxY = -Double.MAX_VALUE;
            for (int j = 0; j < line.length; j += 2) {
                xy[p++] = (float) (line[j] - x0);
                xy[p++] = (float) (line[j + 1] - y0);
                if (Double.isFinite(line[j]) && Double.isFinite(line[j + 1])) {
                    minX = Math.min(minX, line[j]);
                    maxX = Math.max(maxX, line[j]);
                    minY = Math.min(minY, line[j + 1]);
                    maxY = Math.max(maxY, line[j + 1]);
                }
            }
            int cx0 = cell(minX - NEAR_DEG - x0);
            int cx1 = cell(maxX + NEAR_DEG - x0);
            int cy0 = cell(minY - NEAR_DEG - y0);
            int cy1 = cell(maxY + NEAR_DEG - y0);
            for (int cx = cx0; cx <= cx1; cx++) {
                for (int cy = cy0; cy <= cy1; cy++) {
                    cells.get(cy * CELLS + cx).add(i);
                }
            }
            return p;
        }

        static Tile of(double x0, double y0, List<Way> ways) {
            return new Tile(x0, y0, ways);
        }

        private static int cell(double offset) {
            return Math.clamp((int) Math.floor(offset / CELL_DEG), 0, CELLS - 1);
        }

        private static short speed(Integer kmh) {
            return kmh == null || kmh <= 0 || kmh > Short.MAX_VALUE ? 0 : kmh.shortValue();
        }

        int ways() {
            return ids.length;
        }

        long bytes() {
            return ids.length * (8L + 4 + 2 * 3 + 1 + 4) + xy.length * 4L + cellStart.length * 4L
                    + cellWays.length * 4L;
        }

        Limit limit(double lon, double lat, GpsSignal.WeightCategory weight) {
            double px = lon - x0;
            double py = lat - y0;
            int c = cell(py) * CELLS + cell(px);
            int best = -1;
            boolean bestLink = true;
            double bestD = Double.MAX_VALUE;
            for (int q = cellStart[c]; q < cellStart[c + 1]; q++) {
                int i = cellWays[q];
                double d = distance(i, px, py);
                if (d > NEAR_DEG) {
                    continue;
                }
                if (best < 0 || (!link[i] && bestLink) || (link[i] == bestLink && (d < bestD
                        || d == bestD && ids[i] < ids[best]))) {
                    best = i;
                    bestLink = link[i];
                    bestD = d;
                }
            }
            if (best < 0) {
                return null;
            }
            int byWeight = weight == GpsSignal.WeightCategory.LIGHT ? light[best] : heavy[best];
            int kmh = byWeight > 0 ? byWeight : maxspeed[best];
            return kmh > 0 ? new Limit(kmh, ids[best], classes[best]) : null;
        }

        /** Planar distance in degrees from the point to the way, as PostGIS measures a geometry in 4326. */
        private double distance(int i, double px, double py) {
            double best = Double.MAX_VALUE;
            for (int j = start[i]; j + 3 < start[i + 1]; j += 2) {
                double d = segment(px, py, xy[j], xy[j + 1], xy[j + 2], xy[j + 3]);
                if (Double.isFinite(d)) {
                    best = Math.min(best, d);
                }
            }
            return Math.sqrt(best);
        }

        private static double segment(double px, double py, double ax, double ay, double bx, double by) {
            double dx = bx - ax;
            double dy = by - ay;
            double len = dx * dx + dy * dy;
            double t = len == 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len;
            t = Math.clamp(t, 0, 1);
            double ex = px - (ax + t * dx);
            double ey = py - (ay + t * dy);
            return ex * ex + ey * ey;
        }
    }

    /**
     * The {@code [x, y, x, y, …]} points of a WKB or EWKB {@code LineString}, or of every line of a
     * {@code MultiLineString} separated by NaN pairs, so disconnected lines never create a road between them.
     * Empty for another shape or invalid WKB.
     */
    static double[] lineString(byte[] wkb) {
        if (wkb == null || wkb.length < 9) {
            return new double[0];
        }
        try {
            return read(ByteBuffer.wrap(wkb));
        } catch (java.nio.BufferUnderflowException | IllegalArgumentException e) {
            return new double[0];
        }
    }

    private static double[] read(ByteBuffer b) {
        b.order(b.get() == 0 ? ByteOrder.BIG_ENDIAN : ByteOrder.LITTLE_ENDIAN);
        int type = b.getInt();
        boolean srid = (type & 0x20000000) != 0;
        boolean z = (type & 0x80000000) != 0 || (type & 0xffff) / 1000 == 1 || (type & 0xffff) / 1000 == 3;
        boolean m = (type & 0x40000000) != 0 || (type & 0xffff) / 1000 == 2 || (type & 0xffff) / 1000 == 3;
        if (srid) {
            b.getInt();
        }
        int base = (type & 0x0fffffff) % 1000;
        return switch (base) {
            case 2 -> readLine(b, 2 + (z ? 1 : 0) + (m ? 1 : 0));
            case 5 -> readMultiLine(b);
            default -> new double[0];
        };
    }

    private static double[] readLine(ByteBuffer b, int dimensions) {
        int n = b.getInt();
        if (n < 0 || n > b.remaining() / (dimensions * Double.BYTES)) {
            throw new IllegalArgumentException("Invalid WKB point count");
        }
        double[] out = new double[n * 2];
        for (int i = 0; i < n; i++) {
            out[i * 2] = b.getDouble();
            out[i * 2 + 1] = b.getDouble();
            b.position(b.position() + (dimensions - 2) * Double.BYTES);
        }
        return out;
    }

    private static double[] readMultiLine(ByteBuffer b) {
        int n = b.getInt();
        if (n < 0 || n > b.remaining() / 9) {
            throw new IllegalArgumentException("Invalid WKB line count");
        }
        List<double[]> parts = new ArrayList<>(n);
        int length = 0;
        for (int i = 0; i < n; i++) {
            double[] part = read(b);
            if (part.length >= 4) {
                parts.add(part);
                length += part.length + 2;
            }
        }
        double[] out = new double[Math.max(0, length - 2)];
        int offset = 0;
        for (double[] part : parts) {
            if (offset > 0) {
                out[offset++] = Double.NaN;
                out[offset++] = Double.NaN;
            }
            System.arraycopy(part, 0, out, offset, part.length);
            offset += part.length;
        }
        return out;
    }

    /** A network over fixed ways, for tests and the benchmark. */
    static RoadNetwork of(List<Way> ways) {
        Function<double[], List<Way>> inBox = box -> ways.stream().filter(w -> meets(w, box)).toList();
        return new RoadNetwork((a, b, c, d) -> Uni.createFrom().item(inBox.apply(new double[] {a, b, c, d})),
                100_000, Duration.ofDays(1), Clock.systemUTC());
    }

    private static boolean meets(Way w, double[] box) {
        double[] l = lineString(w.wkb());
        if (l.length == 0) {
            return false;
        }
        double minX = Double.MAX_VALUE;
        double minY = Double.MAX_VALUE;
        double maxX = -Double.MAX_VALUE;
        double maxY = -Double.MAX_VALUE;
        for (int j = 0; j < l.length; j += 2) {
            if (Double.isFinite(l[j]) && Double.isFinite(l[j + 1])) {
                minX = Math.min(minX, l[j]);
                maxX = Math.max(maxX, l[j]);
                minY = Math.min(minY, l[j + 1]);
                maxY = Math.max(maxY, l[j + 1]);
            }
        }
        return minX <= box[2] && maxX >= box[0] && minY <= box[3] && maxY >= box[1];
    }
}
