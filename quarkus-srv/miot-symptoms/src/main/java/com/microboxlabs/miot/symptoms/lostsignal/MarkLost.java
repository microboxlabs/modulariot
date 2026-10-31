package com.microboxlabs.miot.symptoms.lostsignal;

import io.micrometer.core.instrument.MeterRegistry;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;

/**
 * The check of a vehicle whose deadline expired, before any symptom reads it: the vehicle is lost from its
 * newest frame on and checked again every {@code recheck}, until a newer frame arrives (it returned), its trip
 * ends, or it stays silent past {@code maxSilence}.
 */
public class MarkLost implements LossTicker.DueCheck {

    /** What one check found. */
    public enum Outcome {
        NOT_DUE, NO_TRIP, LOST, STILL_LOST, RETURNED, GAVE_UP
    }

    private final LossStore store;
    private final Duration recheck;
    private final Duration maxSilence;
    private final MeterRegistry meters;

    public MarkLost(LossStore store, Duration recheck, Duration maxSilence, MeterRegistry meters) {
        this.store = store;
        this.recheck = recheck;
        this.maxSilence = maxSilence;
        this.meters = meters;
    }

    @Override
    public void check(String assetId, Instant now) {
        Outcome o = run(assetId, now);
        meters.counter("miot.symptoms.lost_signal.checks", "outcome", o.name().toLowerCase(Locale.ROOT)).increment();
    }

    Outcome run(String assetId, Instant now) {
        LossStore.Vehicle v = store.vehicle(assetId);
        if (v == null || v.profile() == null || v.watch() == null) {
            store.checked(assetId, CheckState.NONE, null);
            return Outcome.NO_TRIP;
        }
        CheckState c = v.check() == null ? CheckState.NONE : v.check();
        VehicleProfile p = v.profile();
        Instant deadline = p.arrival().plusSeconds(v.watch().expectedS());
        if (c.lost() && p.at().isAfter(c.lostSince())) {
            store.checked(assetId, CheckState.NONE, deadline);
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
        store.checked(assetId, new CheckState(c.lost() ? c.lostSince() : p.at(), now), now.plus(recheck));
        return c.lost() ? Outcome.STILL_LOST : Outcome.LOST;
    }
}
