package com.microboxlabs.miot.symptoms.lostsignal;

import java.time.Duration;
import java.util.Locale;

/**
 * The shadow map: per sender and per grid cell of {@value #CELL_DEGREES}° (about 5 km), how many frames arrive
 * delayed beyond the sender's own usual delay, with a {@code halfLife} decay. A cell is low coverage when enough
 * frames passed through it and the delayed share is well above the sender's own (or, for all senders together,
 * above {@code minShare}).
 */
public record CoverageMap(Duration halfLife, int minFrames, double minShare, double overSender) {

    static final double CELL_DEGREES = 0.05;
    /** A frame this late, or three times its sender's median delay, is delayed. */
    static final Duration DELAYED = Duration.ofMinutes(2);

    public static CoverageMap defaults() {
        return new CoverageMap(Duration.ofDays(7), 20, 0.3, 2);
    }

    /** The cell of a position, or null without one. */
    static String cell(Double lat, Double lon) {
        if (lat == null || lon == null || (lat == 0 && lon == 0)) {
            return null;
        }
        return String.format(Locale.ROOT, "%d:%d", (long) Math.floor(lat / CELL_DEGREES),
                (long) Math.floor(lon / CELL_DEGREES));
    }

    static boolean delayed(Frame f, SenderProfile sender) {
        double median = sender == null || sender.delay().count() == 0 ? 0 : sender.delay().quantile(0.5);
        return f.delaySeconds() > Math.max(DELAYED.toSeconds(), 3 * median);
    }

    /** @param senderShare the sender's delayed share everywhere */
    boolean lowCoverage(Coverage bySender, double senderShare, Coverage byAll) {
        boolean sender = bySender != null && bySender.frames() >= minFrames
                && bySender.share() >= Math.max(minShare, overSender * senderShare);
        boolean all = byAll != null && byAll.frames() >= minFrames && byAll.share() >= minShare;
        return sender || all;
    }
}
