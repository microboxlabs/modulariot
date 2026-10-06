package com.microboxlabs.miot.core.iam;

import com.microboxlabs.miot.core.model.Organization;
import io.quarkus.arc.DefaultBean;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;

/** Used when the integrations module is not in the build: no token exchange. */
@ApplicationScoped
@DefaultBean
public class NoTokenIssuer implements ServiceAccountTokenIssuer {

    @Override
    public Uni<IssuedToken> issue(Organization organization, String credentialRef) {
        return Uni.createFrom().failure(new IllegalStateException("Token exchange is not available"));
    }
}
