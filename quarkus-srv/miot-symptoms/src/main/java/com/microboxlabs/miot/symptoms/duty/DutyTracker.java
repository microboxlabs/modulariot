package com.microboxlabs.miot.symptoms.duty;

import com.microboxlabs.miot.symptoms.duty.DutyState.Drive;
import com.microboxlabs.miot.symptoms.duty.DutyState.Rest;
import java.time.Duration;
import java.time.Instant;
import java.util.Objects;
import java.util.Optional;

/**
 * Net driving, duty and current rest of one vehicle on one organization's trip, frame by frame, as the GPS
 * database's driving and resting trackers count them.
 *
 * <p>Frames: a frame without a position, with a device speed outside 0–150 km/h, or not newer than the last one
 * applied is not applied. Moving is more than 2.78 m/s between two applied frames, distance over time. The time
 * between two frames goes to the state they share: driving when the later one moves or the earlier one moved, rest
 * between two stopped frames. No trip, or a new trip, starts both counts again.
 *
 * <p>Unobserved time is never driving. A frame more than {@link Rules#maxGap} after the last one applied is
 * applied as stopped, without the 150 km/h check, as the GPS database's gate does once its previous position
 * expires: the gap is rest after a stop and neither driving nor rest after a movement. A frame more than 150 km/h
 * away from the last one is not applied but kept; when the next frame is within 150 km/h of it and not of the last
 * one, the kept frame becomes the last one, the time up to it unobserved, and the next frame counts from there.
 *
 * <p>Net driving: a stop of {@link Rules#payBackAfter} or longer pays back driving at {@link Rules#payBackRate}
 * times its length, never more than was driven before it. When all driving is paid back the count starts again.
 *
 * <p>Duty: from the first moving frame of the trip, every second counts. A stop of {@link Rules#longRest} ends the
 * duty; the next frame starts it again. The current rest is the length of the stop in progress, 0 while moving.
 */
public class DutyTracker {

    /**
     * The trackers' thresholds; the defaults are the GPS database's.
     *
     * @param movingMps    above this computed speed (m/s) the vehicle moves
     * @param maxKmh       a device speed above this, or an implied jump above it, is not applied
     * @param payBackAfter a stop this long starts paying back driving
     * @param payBackRate  seconds of driving paid back per second of such a stop
     * @param longRest     a stop this long ends the duty
     * @param maxGap       the time between two frames past which it is unobserved
     */
    public record Rules(double movingMps, double maxKmh, Duration payBackAfter, double payBackRate,
            Duration longRest, Duration maxGap) {

        /** The GPS database's gate forgets the previous position an hour after it. */
        public static final Duration MAX_GAP = Duration.ofHours(1);

        public Rules(double movingMps, double maxKmh, Duration payBackAfter, double payBackRate, Duration longRest) {
            this(movingMps, maxKmh, payBackAfter, payBackRate, longRest, MAX_GAP);
        }

        public static final Rules DEFAULT = new Rules(2.78, 150, Duration.ofSeconds(1440), 3600.0 / 1440,
                Duration.ofHours(8));
    }

    /** One frame as the tracker reads it; {@code trip} is null when the vehicle is not on a trip. */
    public record Frame(Instant at, Double lat, Double lon, Double speedKmh, String trip) {
    }

    /** What the frame's check publishes, in minutes. */
    public record Counters(double drivingMinutes, double restingMinutes, double dutyMinutes) {
    }

    /** The state after a frame and what it publishes; {@code counters} is null when the frame is not applied. */
    public record Step(DutyState next, Counters counters, boolean moving) {

        public boolean applied() {
            return counters != null;
        }
    }

    private static final double EARTH_M = 6_371_000;

    private final Rules rules;

    public DutyTracker() {
        this(Rules.DEFAULT);
    }

    public DutyTracker(Rules rules) {
        this.rules = rules;
    }

    /**
     * The state after the frame and what it publishes; empty when the frame changes nothing. A frame kept for an
     * implied jump gives a step without counters: the state changed, but the frame is not applied.
     */
    public Optional<Step> step(DutyState prev, Frame f) {
        if (!usable(f)) {
            return Optional.empty();
        }
        if (prev == null) {
            return Optional.of(advance(null, f, false, 0, false));
        }
        double dt = seconds(prev.at(), f.at());
        if (dt <= 0) {
            return Optional.empty();
        }
        if (dt > rules.maxGap().toSeconds()) {
            return Optional.of(advance(prev, f, false, dt, true));
        }
        double mps = metres(prev.lat(), prev.lon(), f.lat(), f.lon()) / dt;
        if (mps <= maxMps()) {
            return Optional.of(advance(prev, f, mps > rules.movingMps(), dt, false));
        }
        DutyState.Fix kept = prev.skipped();
        if (kept != null && kept.at().isBefore(f.at())) {
            double keptDt = seconds(kept.at(), f.at());
            double keptMps = metres(kept.lat(), kept.lon(), f.lat(), f.lon()) / keptDt;
            if (keptMps <= maxMps()) {
                // Two frames agree with each other and not with the last one: that one was the stale position.
                Frame anchor = new Frame(kept.at(), kept.lat(), kept.lon(), null, f.trip());
                DutyState moved = advance(prev, anchor, false, seconds(prev.at(), kept.at()), true).next();
                return Optional.of(advance(moved, f, keptMps > rules.movingMps(), keptDt, false));
            }
        }
        DutyState.Fix skipped = new DutyState.Fix(f.at(), f.lat(), f.lon());
        return Optional.of(new Step(new DutyState(prev.at(), prev.lat(), prev.lon(), prev.drive(), prev.rest(),
                prev.restarts(), skipped), null, false));
    }

    /** The frame applied after {@code prev}; an unobserved interval is never driving. */
    private Step advance(DutyState prev, Frame f, boolean moving, double dt, boolean unobserved) {
        Drive drive = prev == null ? null : prev.drive();
        Rest rest = prev == null ? null : prev.rest();
        DriveStep d = drive(drive, f.trip(), moving, dt, unobserved);
        RestStep r = rest(rest, f.trip(), moving, dt, f.at());
        DutyState next = new DutyState(f.at(), f.lat(), f.lon(), d.drive(), r.rest(),
                prev == null ? 0 : prev.restarts());
        return new Step(next, new Counters(d.net() / 60, r.restingS() / 60, r.dutyS() / 60), moving);
    }

    /** The state with the duty count ended, as after a long rest: the next frame starts it again. */
    public static DutyState restartDuty(DutyState s, long restarts) {
        return new DutyState(s.at(), s.lat(), s.lon(), s.drive(), null, restarts, s.skipped());
    }

    private double maxMps() {
        return rules.maxKmh() / 3.6;
    }

    private static double seconds(Instant from, Instant to) {
        return (to.toEpochMilli() - from.toEpochMilli()) / 1000.0;
    }

    private boolean usable(Frame f) {
        if (f.at() == null || f.lat() == null || f.lon() == null || !Double.isFinite(f.lat())
                || !Double.isFinite(f.lon()) || Math.abs(f.lat()) > 90 || Math.abs(f.lon()) > 180
                || (f.lat() == 0 && f.lon() == 0)) {
            return false;
        }
        return f.speedKmh() == null || (f.speedKmh() >= 0 && f.speedKmh() <= rules.maxKmh());
    }

    private record DriveStep(Drive drive, double net) {
    }

    private DriveStep drive(Drive d, String trip, boolean moving, double dt, boolean unobserved) {
        if (trip == null) {
            return new DriveStep(null, 0);
        }
        if (d == null || !trip.equals(d.trip())) {
            return new DriveStep(Drive.start(trip, moving, 0), 0);
        }
        double driven = d.driven() + d.run();
        if (driven > 0 && driven <= d.paidBack() + d.stopPays()) {
            // All driving paid back: the count starts again from the previous frame.
            Drive again = Drive.start(trip, moving, moving && !d.moving() ? dt : 0);
            return new DriveStep(again, 0);
        }
        Drive next;
        if (unobserved && d.moving()) {
            // The run ends at the last frame before the gap; the stop starts at this one.
            next = new Drive(trip, false, d.driven() + d.run(), 0, d.paidBack(), d.stopPays(), 0);
        } else if (moving && !d.moving()) {
            next = new Drive(trip, true, d.driven(), dt, d.paidBack() + d.stopPays(), 0, 0);
        } else if (moving) {
            next = new Drive(trip, true, d.driven(), d.run() + dt, d.paidBack(), d.stopPays(), d.stopped());
        } else if (d.moving()) {
            next = new Drive(trip, false, d.driven() + d.run() + dt, 0, d.paidBack(), d.stopPays(), 0);
        } else {
            next = stoppedDrive(d, dt);
        }
        return new DriveStep(next, Math.max(0, next.net()));
    }

    private Drive stoppedDrive(Drive d, double dt) {
        double driven = d.driven() + d.run();
        double stopped = driven > 0 ? d.stopped() + dt : 0;
        double pays = stopped >= rules.payBackAfter().toSeconds() && driven > 0
                ? Math.rint(stopped * rules.payBackRate()) : 0;
        pays = Math.max(Math.min(d.driven(), d.paidBack() + pays) - d.paidBack(), 0);
        return new Drive(d.trip(), false, d.driven(), 0, d.paidBack(), pays, stopped);
    }

    private record RestStep(Rest rest, double dutyS, double restingS) {
    }

    private RestStep rest(Rest r, String trip, boolean moving, double dt, Instant at) {
        if (trip == null) {
            return new RestStep(null, 0, 0);
        }
        if (r == null || !trip.equals(r.trip())) {
            return new RestStep(new Rest(trip, moving ? 0.0 : null, moving ? null : at), 0, 0);
        }
        double resting = moving || r.stopSince() == null ? 0
                : (at.toEpochMilli() - r.stopSince().toEpochMilli()) / 1000.0;
        if (!moving && resting >= rules.longRest().toSeconds()) {
            return new RestStep(null, 0, resting);
        }
        Double duty = nextDuty(r, moving, dt);
        Instant stopSince = moving ? null : Objects.requireNonNullElse(r.stopSince(), at);
        return new RestStep(new Rest(trip, duty, stopSince), duty == null ? 0 : duty, resting);
    }

    private static Double nextDuty(Rest r, boolean moving, double dt) {
        if (r.dutyS() != null) {
            return r.dutyS() + dt;
        }
        return moving ? Double.valueOf(dt) : null;
    }

    static double metres(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double h = Math.pow(Math.sin(dLat / 2), 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.pow(Math.sin(dLon / 2), 2);
        return 2 * EARTH_M * Math.asin(Math.sqrt(h));
    }
}
