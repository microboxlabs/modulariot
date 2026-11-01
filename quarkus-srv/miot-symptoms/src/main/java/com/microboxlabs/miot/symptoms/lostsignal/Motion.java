package com.microboxlabs.miot.symptoms.lostsignal;

/** What the vehicle was doing on a frame; its gap profile is kept per motion. */
public enum Motion {
    MOVING,
    STOPPED,
    ENGINE_OFF;

    /** Above this speed the vehicle is moving, as in the signal builder. */
    static final double MOVING_KMH = 10;

    /** Engine off when the device says so, whatever the speed; unknown engine counts as on. */
    static Motion of(Double speedKmh, Boolean engineOn) {
        if (Boolean.FALSE.equals(engineOn)) {
            return ENGINE_OFF;
        }
        return speedKmh != null && speedKmh > MOVING_KMH ? MOVING : STOPPED;
    }
}
