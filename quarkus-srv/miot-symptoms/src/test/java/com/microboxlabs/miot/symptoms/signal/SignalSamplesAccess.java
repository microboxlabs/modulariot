package com.microboxlabs.miot.symptoms.signal;

import io.vertx.mutiny.redis.client.RedisAPI;
import java.time.Clock;

/** Samples kept in a given Redis, for tests and benchmarks outside this package. */
public final class SignalSamplesAccess {

    private SignalSamplesAccess() {
    }

    public static SignalSamples redis(RedisAPI api, Clock clock) {
        return new SignalSamples(api, clock);
    }
}
