package com.microboxlabs.miot.core.gps;

import com.microboxlabs.miot.core.auth0.FakeAuth0Management;
import jakarta.annotation.Priority;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;
import java.util.Optional;

/** {@link GpsTokenSource} against {@link FakeGpsTokenApi}, for every {@code @QuarkusTest} in this module. */
@ApplicationScoped
@Alternative
@Priority(1)
public class FakeGpsTokenSource extends GpsTokenSource {

    private static final FakeGpsTokenApi API = new FakeGpsTokenApi();

    public FakeGpsTokenSource() {
        super(new FakeAuth0Management(), Optional.of("http://token.test/login"), () -> API);
    }

    public FakeGpsTokenApi api() {
        return API;
    }
}
