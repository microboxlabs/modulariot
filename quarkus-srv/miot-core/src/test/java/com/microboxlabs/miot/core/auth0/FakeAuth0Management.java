package com.microboxlabs.miot.core.auth0;

import jakarta.annotation.Priority;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;
import java.util.Optional;

/** {@link Auth0Management} against {@link FakeAuth0Api}, for every {@code @QuarkusTest} in this module. */
@ApplicationScoped
@Alternative
@Priority(1)
public class FakeAuth0Management extends Auth0Management {

    public static final String AUDIENCE = "https://gps.example.test/track";
    public static final String PREFIX = "test:";
    public static final String MANAGEMENT_CLIENT = "mgmt-client";

    private static final FakeAuth0Api API = new FakeAuth0Api();

    public FakeAuth0Management() {
        super(Optional.of("tenant.auth0.test"), Optional.of(MANAGEMENT_CLIENT), Optional.of("mgmt-secret"),
                Optional.of(AUDIENCE), "asset:track:write", PREFIX, () -> API);
    }

    public FakeAuth0Api api() {
        return API;
    }
}
