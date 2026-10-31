package com.microboxlabs.miot.symptoms.lostsignal;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

/** A clock the test moves by hand. */
final class TestClock extends Clock {

    private Instant now;

    TestClock(Instant start) {
        this.now = start;
    }

    void set(Instant at) {
        now = at;
    }

    void advance(long seconds) {
        now = now.plusSeconds(seconds);
    }

    @Override
    public Instant instant() {
        return now;
    }

    @Override
    public ZoneId getZone() {
        return ZoneOffset.UTC;
    }

    @Override
    public Clock withZone(ZoneId zone) {
        return this;
    }
}
