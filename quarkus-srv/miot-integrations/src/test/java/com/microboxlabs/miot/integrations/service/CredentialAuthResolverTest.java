package com.microboxlabs.miot.integrations.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.integrations.auth.AuthResolutionException;
import com.microboxlabs.miot.integrations.auth.CredentialAuthContext;
import com.microboxlabs.miot.integrations.auth.CredentialAuthProvider;
import com.microboxlabs.miot.integrations.auth.CredentialAuthRegistry;
import com.microboxlabs.miot.integrations.auth.ResolvedAuth;
import com.microboxlabs.miot.integrations.domain.AuthType;
import com.microboxlabs.miot.integrations.domain.CredentialProfile;
import com.microboxlabs.miot.integrations.domain.CredentialType;
import com.microboxlabs.miot.integrations.persistence.CredentialProfileRepository;
import com.microboxlabs.miot.integrations.secret.IntegrationSecretCipher;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** The lookup behind the dashboard server's credential endpoint. */
class CredentialAuthResolverTest {

    private static final String TENANT = "tenant-1";
    private static final String OTHER_TENANT = "tenant-2";
    private static final String SECRET = "pgrst_live_0123456789abcdef";

    private final FakeCredentials credentials = new FakeCredentials();
    private final IntegrationSecretCipher cipher =
            new IntegrationSecretCipher(new ObjectMapper(), "unit-test-key");

    @Test
    void answersTheHeaderTheGrantProduced() {
        String id = store(TENANT);

        ResolvedAuth auth = resolver().resolve(TENANT, id);

        assertEquals(Map.of("Authorization", "Bearer " + SECRET), auth.headers());
    }

    @Test
    void decryptsTheStoredSecretRatherThanReadingItBack() {
        String id = store(TENANT);

        // What is stored is ciphertext; the grant only works if it was decrypted.
        assertEquals(1, credentials.rows.size());
        String stored = credentials.rows.get(0).encryptedSecretJson();
        assertEquals(false, stored.contains(SECRET));
        assertEquals(
                Map.of("Authorization", "Bearer " + SECRET),
                resolver().resolve(TENANT, id).headers());
    }

    @Test
    void doesNotReachAnotherTenantsCredential() {
        String id = store(TENANT);

        assertNull(resolver().resolve(OTHER_TENANT, id));
    }

    @Test
    void readsAnUnknownReferenceAsNoSuchCredential() {
        store(TENANT);

        assertNull(resolver().resolve(TENANT, UUID.randomUUID().toString()));
        assertNull(resolver().resolve(TENANT, "not-a-uuid"));
    }

    @Test
    void reportsACredentialNoProviderHandles() {
        String id = store(TENANT);
        CredentialAuthResolver unsupported = new CredentialAuthResolver(
                credentials, cipher, new CredentialAuthRegistry(List.of()));

        assertThrows(AuthResolutionException.class, () -> unsupported.resolve(TENANT, id));
    }

    private CredentialAuthResolver resolver() {
        return new CredentialAuthResolver(credentials, cipher, new CredentialAuthRegistry(List.of(bearer())));
    }

    /** Stands in for the real grant; this test is about the lookup around it. */
    private static CredentialAuthProvider bearer() {
        return new CredentialAuthProvider() {
            @Override
            public Set<AuthType> supportedTypes() {
                return Set.of(AuthType.BEARER_TOKEN);
            }

            @Override
            public ResolvedAuth resolve(CredentialAuthContext context) {
                return ResolvedAuth.headers(
                        Map.of("Authorization", "Bearer " + context.secretValue("token").orElseThrow()),
                        null);
            }
        };
    }

    private String store(String tenantCode) {
        String id = UUID.randomUUID().toString();
        credentials.rows.add(new CredentialProfile(
                id,
                tenantCode,
                "Fleet",
                CredentialType.BEARER_TOKEN,
                AuthType.BEARER_TOKEN,
                "PRODUCTION",
                Map.of(),
                cipher.encrypt(Map.of("token", SECRET)),
                "pgrst_…",
                1,
                null,
                null,
                OffsetDateTime.now(),
                OffsetDateTime.now(),
                "operator@microboxlabs.com",
                "operator@microboxlabs.com"));
        return id;
    }

    /** In-memory stand-in; the repository's own SQL is covered by the integrity test. */
    private static class FakeCredentials extends CredentialProfileRepository {

        final List<CredentialProfile> rows = new ArrayList<>();

        FakeCredentials() {
            super(null);
        }

        @Override
        public CredentialProfile findByTenantAndId(String tenantCode, String id) {
            return rows.stream()
                    .filter(row -> row.tenantCode().equals(tenantCode) && row.id().equals(id))
                    .findFirst()
                    .orElse(null);
        }
    }
}
