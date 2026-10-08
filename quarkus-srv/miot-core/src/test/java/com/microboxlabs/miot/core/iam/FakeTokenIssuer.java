package com.microboxlabs.miot.core.iam;

import com.microboxlabs.miot.core.model.Organization;
import io.smallrye.mutiny.Uni;
import jakarta.annotation.Priority;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicInteger;

/** Issues {@code token-<credentialRef>} valid for an hour and counts the calls. */
@ApplicationScoped
@Alternative
@Priority(1)
public class FakeTokenIssuer implements ServiceAccountTokenIssuer {

    private final AtomicInteger calls = new AtomicInteger();

    public int calls() {
        return calls.get();
    }

    @Override
    public Uni<IssuedToken> issue(Organization organization, String credentialRef) {
        calls.incrementAndGet();
        return Uni.createFrom().item(new IssuedToken("token-" + credentialRef, Instant.now().plusSeconds(3600)));
    }
}
