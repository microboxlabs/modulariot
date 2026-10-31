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
 * {@code returnGrace} for backfill, then is checked once with {@code check.loss.returned}.
 */
public class MarkLost implements LossTicker.DueCheck {

    /** What one check found. */
    public enum Outcome {
        NOT_DUE, NO_TRIP, LOST, STILL_LOST, RETURNING, RETURNED, GAVE_UP
    }

    private final LossStore store;
    private final TripChecks trips;
    private final Duration recheck;
    private final Duration maxSilence;
    private final Duration returnGrace;
    private final MeterRegistry meters;

    public MarkLost(LossStore store, TripChecks trips, Duration recheck, Duration maxSilence, Duration returnGrace,
            MeterRegistry meters) {
        this.store = store;
        this.trips = trips;
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
        if (v.profile() == null || v.watch() == null) {
            store.checked(assetId, c, null);
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
            Map<String, Long> open = trips.check(assetId, v, c.cases(), now, new Return(back, v.backfill()));
            store.checked(assetId, new CheckState(null, now, open), deadline);
            return Outcome.RETURNED;
        }
        if (!c.lost() && now.isBefore(deadline)) {
            store.checked(assetId, c, deadline);
            return Outcome.NOT_DUE;
        }
        if (Duration.between(p.at(), now).compareTo(maxSilence) > 0) {
            store.checked(assetId, c, null);
            return Outcome.GAVE_UP;
        }
        Map<String, Long> open = trips.check(assetId, v, c.cases(), now, null);
        store.checked(assetId, new CheckState(c.lost() ? c.lostSince() : p.at(), now, open), now.plus(recheck));
        return c.lost() ? Outcome.STILL_LOST : Outcome.LOST;
    }
}
