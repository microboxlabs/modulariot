package com.microboxlabs.miot.symptoms.lostsignal;

import com.microboxlabs.miot.symptoms.lostsignal.TripChecks.Return;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;

/**
 * The check of a vehicle whose deadline expired: the vehicle is lost from its newest frame on and checked again
 * every {@code recheck}, until a newer frame arrives, its trip ends, or it stays silent past {@code maxSilence}.
 * Each check runs the organizations' {@code trip_check} versions ({@link TripChecks}). A return waits up to
 * {@code returnGrace} for backfill, then is checked once with {@code check.loss.returned}. A lost check also
 * reads the shadow map at the last position, the sender's lost vehicles against its usual count, and the
 * vehicles reporting within {@value #NEARBY_KM} km.
 */
public class MarkLost implements LossTicker.DueCheck {

    /** What one check found. */
    public enum Outcome {
        NOT_DUE, NO_TRIP, LOST, STILL_LOST, RETURNING, RETURNED, GAVE_UP
    }

    private final LossStore store;
    static final double NEARBY_KM = 10;

    private final TripChecks trips;
    private final CoverageMap coverage;
    private final Duration recheck;
    private final Duration maxSilence;
    private final Duration returnGrace;
    private final MeterRegistry meters;

    public MarkLost(LossStore store, TripChecks trips, CoverageMap coverage, Duration recheck, Duration maxSilence,
            Duration returnGrace, MeterRegistry meters) {
        this.store = store;
        this.trips = trips;
        this.coverage = coverage;
        this.recheck = recheck;
        this.maxSilence = maxSilence;
        this.returnGrace = returnGrace;
        this.meters = meters;
    }

    @Override
    public void check(String assetId, Instant now) {
        Outcome o = run(assetId, now);
        meters.counter("miot.symptoms.lost_signal.checks", "outcome", o.name().toLowerCase(Locale.ROOT)).increment();
    }

    Outcome run(String assetId, Instant now) {
        LossStore.Vehicle v = store.vehicle(assetId);
        CheckState c = v.check() == null ? CheckState.NONE : v.check();
        String sender = v.watch() == null ? null : v.watch().sender();
        if (v.profile() == null || v.watch() == null) {
            store.checked(assetId, c, null);
            leaves(sender, assetId, c);
            return Outcome.NO_TRIP;
        }
        VehicleProfile p = v.profile();
        Instant deadline = p.arrival().plusSeconds(v.watch().expectedS());
        if (c.lost() && p.at().isAfter(c.lostSince())) {
            Instant back = v.returnedAt() != null ? v.returnedAt() : p.arrival();
            if (!v.backfill() && now.isBefore(back.plus(returnGrace))) {
                store.checked(assetId, c, back.plus(returnGrace));
                return Outcome.RETURNING;
            }
            Map<String, Long> open = trips.check(assetId, v, c.cases(), now, new Return(back, v.backfill()),
                    TripChecks.Area.NONE);
            store.checked(assetId, new CheckState(null, now, open), deadline);
            leaves(sender, assetId, c);
            return Outcome.RETURNED;
        }
        if (!c.lost() && now.isBefore(deadline)) {
            store.checked(assetId, c, deadline);
            return Outcome.NOT_DUE;
        }
        if (Duration.between(p.at(), now).compareTo(maxSilence) > 0) {
            store.checked(assetId, c, null);
            leaves(sender, assetId, c);
            return Outcome.GAVE_UP;
        }
        Map<String, Long> open = trips.check(assetId, v, c.cases(), now, null, area(assetId, v, sender, now));
        store.checked(assetId, new CheckState(c.lost() ? c.lostSince() : p.at(), now, open), now.plus(recheck));
        return c.lost() ? Outcome.STILL_LOST : Outcome.LOST;
    }

    private TripChecks.Area area(String assetId, LossStore.Vehicle v, String sender, Instant now) {
        VehicleProfile.Last last = v.profile().last();
        Double lat = last == null ? null : last.latitude();
        Double lon = last == null ? null : last.longitude();
        LossStore.Around around = store.around(sender, CoverageMap.cell(lat, lon), lat, lon, assetId, now, NEARBY_KM);
        boolean low = coverage.lowCoverage(around.bySender(), senderShare(sender), around.byAll());
        boolean outage = false;
        if (sender != null) {
            int lost = store.lost(sender, assetId, true);
            Cohort before = store.cohort(sender);
            outage = Cohort.outage(before, lost);
            store.cohort(sender, Cohort.with(before, lost, now));
        }
        return new TripChecks.Area(low, outage, around.nearby());
    }

    /** The sender's delayed share everywhere, from its profile. */
    private double senderShare(String sender) {
        if (sender == null) {
            return 0;
        }
        SenderProfile p = store.sender(sender);
        return p == null ? 0 : p.delayedShare();
    }

    /** A vehicle no longer lost leaves its sender's lost set. */
    private void leaves(String sender, String assetId, CheckState c) {
        if (sender != null && c.lost()) {
            store.lost(sender, assetId, false);
        }
    }
}
