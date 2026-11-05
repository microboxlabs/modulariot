package com.microboxlabs.miot.integrations.orgaccount;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.auth.AuthResolutionException;
import com.microboxlabs.miot.integrations.auth.CredentialAuthContext;
import com.microboxlabs.miot.integrations.auth.ResolvedAuth;
import com.microboxlabs.miot.integrations.auth.google.GoogleServiceAccountAuthProvider;
import com.microboxlabs.miot.integrations.domain.AuthType;
import com.microboxlabs.miot.integrations.domain.CredentialType;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ManagedGoogleIdentityTest {

    @Test
    void readsTheManagedFlag() {
        assertTrue(ManagedGoogleIdentity.isManaged(Map.of("managed", true)));
        assertTrue(ManagedGoogleIdentity.isManaged(Map.of("managed", "true")));
        assertFalse(ManagedGoogleIdentity.isManaged(Map.of("clientEmail", "x@y")));
        assertFalse(ManagedGoogleIdentity.isManaged(null));
    }

    @Test
    void aManagedCredentialImpersonatesTheBoundAccountWithoutAKey() {
        List<String> asked = new ArrayList<>();
        ManagedGoogleIdentity identity = new ManagedGoogleIdentity() {
            @Override
            public Map<String, Object> bind(String tenantCode, Map<String, Object> publicConfig) {
                throw new AssertionError("not used");
            }

            @Override
            public Token accessToken(String email, String scope) {
                asked.add(email + " " + scope);
                return new Token("ya29.tenant", Instant.parse("2026-10-29T16:00:00Z"));
            }
        };
        GoogleServiceAccountAuthProvider provider = new GoogleServiceAccountAuthProvider(null, identity);
        ResolvedAuth auth = provider.resolve(new CredentialAuthContext(AuthType.GOOGLE_SERVICE_ACCOUNT,
                CredentialType.GOOGLE_SERVICE_ACCOUNT,
                Map.of("managed", true, "clientEmail", "t-acme@tenants-p.iam.gserviceaccount.com"), Map.of()));
        assertEquals("Bearer ya29.tenant", auth.headers().get("Authorization"));
        assertEquals(List.of("t-acme@tenants-p.iam.gserviceaccount.com https://www.googleapis.com/auth/bigquery"),
                asked);
    }

    @Test
    void withoutThePlatformIdentityAManagedCredentialDoesNotResolve() {
        GoogleServiceAccountAuthProvider provider = new GoogleServiceAccountAuthProvider(null);
        CredentialAuthContext context = new CredentialAuthContext(
                AuthType.GOOGLE_SERVICE_ACCOUNT, CredentialType.GOOGLE_SERVICE_ACCOUNT,
                Map.of("managed", true, "clientEmail", "t-acme@tenants-p.iam.gserviceaccount.com"), Map.of());
        assertThrows(AuthResolutionException.class, () -> provider.resolve(context));
    }
}
