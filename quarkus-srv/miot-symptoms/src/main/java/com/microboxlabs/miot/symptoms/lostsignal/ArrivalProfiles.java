package com.microboxlabs.miot.symptoms.lostsignal;

import java.time.Duration;

/**
 * Keeps, for every GPS frame, the vehicle's newest frame and gap profile and the sender's delivery delays (see
 * {@link VehicleProfile}, {@link SenderProfile}). One read and one write per frame, whatever the history.
 */
public class ArrivalProfiles {

    private final LossStore store;
    private final LossSettings settings;

    /**
     * The frame's effect on the profiles.
     *
     * @param late     older than the vehicle's newest frame
     * @param replay   the same time as the newest frame
     * @param expected how long a silence after the newest frame is normal: the vehicle's expected gap plus the
     *                 sender's delivery delay
     * @param delayed  the frame arrived later than its sender usually does ({@link CoverageMap#delayed})
     */
    public record Arrival(boolean late, boolean replay, VehicleProfile vehicle, SenderProfile sender,
            Duration expected, boolean delayed) {
    }

    public ArrivalProfiles(LossStore store, LossSettings settings) {
        this.store = store;
        this.settings = settings;
    }

    public LossSettings settings() {
        return settings;
    }

    /** Loads the profiles, applies the frame and saves them. */
    public Arrival record(Frame f) {
        Arrival a = apply(store.load(f.assetId(), f.sender()), f);
        store.save(f.assetId(), a.vehicle(), f.sender(), a.sender());
        return a;
    }

    /** The profiles after the frame. */
    public Arrival apply(LossStore.Profiles before, Frame f) {
        VehicleProfile old = before.vehicle();
        boolean late = old != null && f.at().isBefore(old.at());
        boolean replay = old != null && f.at().equals(old.at());
        VehicleProfile vehicle = old == null ? VehicleProfile.first(f) : old.with(f, settings);
        SenderProfile sender = before.sender() == null ? SenderProfile.empty() : before.sender();
        boolean delayed = CoverageMap.delayed(f, sender);
        if (f.sender() != null && !replay) {
            sender = sender.with(f, settings, delayed);
        }
        return new Arrival(late, replay, vehicle, sender, expected(vehicle, sender), delayed);
    }

    public Duration expected(VehicleProfile vehicle, SenderProfile sender) {
        return vehicle.expectedGap(settings).plus(sender.deliveryDelay(settings));
    }
}
