package com.microboxlabs.miot.core.iam;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.quarkus.runtime.LaunchMode;
import io.quarkus.security.identity.SecurityIdentity;
import io.quarkus.security.runtime.QuarkusPrincipal;
import io.quarkus.security.runtime.QuarkusSecurityIdentity;
import java.util.List;
import org.junit.jupiter.api.Test;

/** X-Dev-User-Email names a user only in dev and test mode. */
class DevHeaderTest {

    private static final String HEADER = "victim@example.test";

    /** A signed-in caller whose token carries no email, like an M2M token. */
    private final SecurityIdentity emailless = QuarkusSecurityIdentity.builder()
            .setPrincipal(new QuarkusPrincipal("m2m-client"))
            .build();

    @Test
    void inProductionTheHeaderCannotNameAUser() {
        Caller caller = IamIdentityAugmentor.callerOf(emailless, HEADER, List.of("azp"), LaunchMode.NORMAL);

        assertFalse(caller.isUser());
        assertNull(IamIdentityAugmentor.devHeaderEmail(HEADER, LaunchMode.NORMAL));
    }

    @Test
    void inDevAndTestTheHeaderNamesTheUser() {
        for (LaunchMode mode : List.of(LaunchMode.DEVELOPMENT, LaunchMode.TEST)) {
            Caller caller = IamIdentityAugmentor.callerOf(emailless, HEADER, List.of("azp"), mode);

            assertTrue(caller.isUser(), mode.name());
            assertEquals(HEADER, caller.email());
            assertEquals(HEADER, IamIdentityAugmentor.devHeaderEmail(HEADER, mode));
        }
        assertNull(IamIdentityAugmentor.devHeaderEmail(" ", LaunchMode.DEVELOPMENT));
    }
}
