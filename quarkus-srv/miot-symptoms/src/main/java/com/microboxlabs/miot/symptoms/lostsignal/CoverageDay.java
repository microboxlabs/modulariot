package com.microboxlabs.miot.symptoms.lostsignal;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * One UTC day of frames turned into the shadow map's rows. Takes the sender's median delay and frame interval of
 * the day first, then every frame with a position, in {@code timestamp} order per asset and sender:
 * <ul>
 * <li>a frame is delayed when its delay is above {@link CoverageSettings#threshold} of the median delay;</li>
 * <li>two consecutive frames further apart than the threshold of the median interval are a gap when the vehicle
 * moved at least {@code gapMinKm} and no faster than {@code gapMaxKmh}: {@code dt / median interval - 1} frames
 * are missing, spread evenly over the cells the straight line between them crosses.</li>
 * </ul>
 */
public final class CoverageDay {

    /** One row of {@code coverage_day}. */
    public record CellDay(String sender, String cell, LocalDate day, long frames, long delayed, double missing) {

        double share() {
            double seen = frames + missing;
            return seen <= 0 ? 0 : (delayed + missing) / seen;
        }
    }

    /** One row of {@code coverage_sender_day}. */
    public record SenderDay(String sender, LocalDate day, long frames, long delayed, double missing,
            Double medianDelayS, Double medianIntervalS, boolean anomalous) {

        double share() {
            double seen = frames + missing;
            return seen <= 0 ? 0 : (delayed + missing) / seen;
        }

        SenderDay anomalous(boolean flag) {
            return new SenderDay(sender, day, frames, delayed, missing, medianDelayS, medianIntervalS, flag);
        }
    }

    /** A sender's medians for the day, in seconds; either may be null. */
    public record Medians(Double delayS, Double intervalS) {
    }

    private record Point(long atMs, double lat, double lon) {
    }

    private static final class Counts {
        long frames;
        long delayed;
        double missing;
    }

    private final LocalDate day;
    private final CoverageSettings settings;
    private final Map<String, Medians> medians;
    private final Map<String, Point> last = new HashMap<>();
    private final Map<String, Map<String, Counts>> cells = new HashMap<>();
    private final Map<String, Counts> senders = new HashMap<>();

    public CoverageDay(LocalDate day, CoverageSettings settings, Map<String, Medians> medians) {
        this.day = day;
        this.settings = settings;
        this.medians = medians;
    }

    /** The newest frame before the day of an asset and sender, so a gap across midnight is seen. */
    public void before(String assetId, String sender, long atMs, double lat, double lon) {
        if (sender != null && CoverageMap.cell(lat, lon) != null) {
            last.put(key(assetId, sender), new Point(atMs, lat, lon));
        }
    }

    /** One frame of the day; frames of the same asset and sender arrive in time order. */
    public void frame(String assetId, String sender, long atMs, double delayS, double lat, double lon) {
        String cell = CoverageMap.cell(lat, lon);
        if (sender == null || cell == null) {
            return;
        }
        Medians m = medians.getOrDefault(sender, new Medians(null, null));
        boolean delayed = delayS > settings.threshold(m.delayS());
        Counts c = counts(sender, cell);
        c.frames++;
        Counts s = senders.computeIfAbsent(sender, k -> new Counts());
        s.frames++;
        if (delayed) {
            c.delayed++;
            s.delayed++;
        }
        Point now = new Point(atMs, lat, lon);
        Point prev = last.put(key(assetId, sender), now);
        if (prev != null) {
            gap(sender, m.intervalS(), prev, now, s);
        }
    }

    private void gap(String sender, Double intervalS, Point a, Point b, Counts s) {
        if (intervalS == null || intervalS <= 0) {
            return;
        }
        double dtS = (b.atMs() - a.atMs()) / 1000.0;
        if (dtS <= settings.threshold(intervalS)) {
            return;
        }
        double km = km(a.lat(), a.lon(), b.lat(), b.lon());
        if (km < settings.gapMinKm() || km / (dtS / 3600) > settings.gapMaxKmh()) {
            return; // parked or off, or a GPS jump
        }
        double missing = dtS / intervalS - 1;
        Set<String> crossed = crossed(a.lat(), a.lon(), b.lat(), b.lon());
        for (String cell : crossed) {
            counts(sender, cell).missing += missing / crossed.size();
        }
        s.missing += missing;
    }

    private Counts counts(String sender, String cell) {
        return cells.computeIfAbsent(sender, k -> new HashMap<>()).computeIfAbsent(cell, k -> new Counts());
    }

    public List<CellDay> cells() {
        List<CellDay> out = new ArrayList<>();
        cells.forEach((sender, byCell) -> byCell.forEach((cell, c) -> out.add(
                new CellDay(sender, cell, day, c.frames, c.delayed, round(c.missing)))));
        return out;
    }

    public List<SenderDay> senders() {
        List<SenderDay> out = new ArrayList<>();
        senders.forEach((sender, c) -> {
            Medians m = medians.getOrDefault(sender, new Medians(null, null));
            out.add(new SenderDay(sender, day, c.frames, c.delayed, round(c.missing), m.delayS(), m.intervalS(),
                    false));
        });
        return out;
    }

    /** The cells a straight line crosses, from the first to the last, sampled a quarter of a cell apart. */
    static Set<String> crossed(double lat1, double lon1, double lat2, double lon2) {
        double span = Math.max(Math.abs(lat2 - lat1), Math.abs(lon2 - lon1));
        int steps = (int) Math.ceil(span / (CoverageMap.CELL_DEGREES / 4));
        Set<String> out = new LinkedHashSet<>();
        for (int i = 0; i <= steps; i++) {
            double t = steps == 0 ? 0 : (double) i / steps;
            String cell = CoverageMap.cell(lat1 + t * (lat2 - lat1), lon1 + t * (lon2 - lon1));
            if (cell != null) {
                out.add(cell);
            }
        }
        return out;
    }

    static double km(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double h = Math.pow(Math.sin(dLat / 2), 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.pow(Math.sin(dLon / 2), 2);
        return 2 * 6371.0 * Math.asin(Math.min(1, Math.sqrt(h)));
    }

    private static String key(String assetId, String sender) {
        return assetId + "\u0000" + sender;
    }

    private static double round(double v) {
        return Math.round(v * 1000) / 1000.0;
    }
}
