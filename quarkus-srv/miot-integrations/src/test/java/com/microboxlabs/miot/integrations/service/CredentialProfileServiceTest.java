package com.microboxlabs.miot.integrations.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.integrations.domain.AuthType;
import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.CredentialProfile;
import com.microboxlabs.miot.integrations.domain.CredentialType;
import com.microboxlabs.miot.integrations.domain.CredentialUsageKind;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.CreateCredentialProfileRequest;
import com.microboxlabs.miot.integrations.dto.CredentialProfileResponse;
import com.microboxlabs.miot.integrations.dto.CredentialTestResponse;
import com.microboxlabs.miot.integrations.dto.UpdateCredentialProfileRequest;
import com.microboxlabs.miot.integrations.persistence.CredentialProfileRepository;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import com.microboxlabs.miot.integrations.persistence.UpdateCredentialProfileParams;
import com.microboxlabs.miot.integrations.secret.IntegrationSecretCipher;
import com.microboxlabs.miot.integrations.tester.CredentialTesterRegistry;
import java.net.URI;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class CredentialProfileServiceTest {

    private static final String TENANT = "tenant-1";
    private static final String ACTOR = "operator@microboxlabs.com";
    private static final Map<String, Object> ENTRA_CONFIG = Map.of(
            "tenantId", "11111111-2222-3333-4444-555555555555",
            "clientId", "66666666-7777-8888-9999-000000000000",
            "scope", "api://partner-api/.default");

    private final FakeCredentials credentials = new FakeCredentials();
    private final FakeConnections connections = new FakeConnections();

    @Test
    void createsAnEntraCredentialWithTheActorAndTheDerivedAuthType() {
        CredentialProfileResponse created = service().create(TENANT, ACTOR, entraRequest("Partner API", "QA"));

        assertEquals(CredentialType.AZURE_ENTRA_CLIENT_CREDENTIALS, created.credentialType());
        assertEquals(AuthType.OAUTH2_CLIENT_CREDENTIALS, created.authType());
        assertEquals("QA", created.environment());
        assertEquals(ACTOR, created.createdBy());
        assertEquals(ACTOR, created.updatedBy());
    }

    /** The list identifies a credential by its client id — never by anything secret. */
    @Test
    void summarisesAnOAuthCredentialByItsClientId() {
        CredentialProfileResponse created = service().create(TENANT, ACTOR, entraRequest("Partner API", "QA"));

        assertEquals("66666666-7777-8888-9999-000000000000", created.summary());
        assertEquals("****", created.secretPreview());
    }

    @Test
    void neverReturnsTheStoredSecret() {
        service().create(TENANT, ACTOR, entraRequest("Partner API", "QA"));

        CredentialProfile stored = credentials.rows.get(0);
        assertFalse(stored.encryptedSecretJson().contains("s3cret"));
        // The response record has no field that could carry it.
        assertTrue(service().list(TENANT).stream().noneMatch(c -> String.valueOf(c).contains("s3cret")));
    }

    /**
     * Providers issue one pair per environment, so the same name in QA and PRODUCTION is
     * the normal case, not a mistake.
     */
    @Test
    void allowsTheSameNameInADifferentEnvironment() {
        service().create(TENANT, ACTOR, entraRequest("Partner API", "QA"));

        assertNotNull(service().create(TENANT, ACTOR, entraRequest("Partner API", "PRODUCTION")));
    }

    @Test
    void rejectsTheSameNameTwiceInOneEnvironment() {
        service().create(TENANT, ACTOR, entraRequest("Partner API", "QA"));

        IllegalArgumentException error = assertThrows(
                IllegalArgumentException.class,
                () -> service().create(TENANT, ACTOR, entraRequest("partner api", "QA")));

        assertTrue(error.getMessage().contains("already exists"), error.getMessage());
    }

    /** Typing "qa" must join the existing "QA", not create a twin the index would reject. */
    @Test
    void reusesAnExistingEnvironmentsCasing() {
        service().create(TENANT, ACTOR, entraRequest("First", "QA"));

        CredentialProfileResponse second = service().create(TENANT, ACTOR, entraRequest("Second", " qa "));

        assertEquals("QA", second.environment());
    }

    /** The WhatsApp channel predates the screen and sends only an auth type. */
    @Test
    void acceptsALegacyRequestThatStatesOnlyAnAuthType() {
        CredentialProfileResponse created = service().create(TENANT, ACTOR, new CreateCredentialProfileRequest(
                "WhatsApp token", null, AuthType.BEARER_TOKEN, null, Map.of(), Map.of("token", "abc")));

        assertEquals(CredentialType.BEARER_TOKEN, created.credentialType());
        assertEquals(AuthType.BEARER_TOKEN, created.authType());
        assertEquals("PRODUCTION", created.environment());
    }

    /** An explicit auth type wins, because API_KEY cannot say "in the query string". */
    @Test
    void keepsAnExplicitAuthTypeTheCredentialTypeCannotExpress() {
        CredentialProfileResponse created = service().create(TENANT, ACTOR, new CreateCredentialProfileRequest(
                "Legacy key", CredentialType.API_KEY, AuthType.API_KEY_QUERY, "QA",
                Map.of(), Map.of("apiKey", "abc")));

        assertEquals(CredentialType.API_KEY, created.credentialType());
        assertEquals(AuthType.API_KEY_QUERY, created.authType());
    }

    @Test
    void refusesToCreateACredentialWithNoSecret() {
        IllegalArgumentException error = assertThrows(
                IllegalArgumentException.class,
                () -> service().create(TENANT, ACTOR, new CreateCredentialProfileRequest(
                        "Empty", CredentialType.AZURE_ENTRA_CLIENT_CREDENTIALS, null, "QA",
                        ENTRA_CONFIG, Map.of())));

        assertEquals("secretConfig is required", error.getMessage());
    }

    @Test
    void refusesAnEntraCredentialWithNoDirectory() {
        assertThrows(
                IllegalArgumentException.class,
                () -> service().create(TENANT, ACTOR, new CreateCredentialProfileRequest(
                        "Incomplete", CredentialType.AZURE_ENTRA_CLIENT_CREDENTIALS, null, "QA",
                        Map.of("clientId", "abc", "scope", "x/.default"), Map.of("clientSecret", "s3cret"))));
    }

    /**
     * The edit form cannot show a stored secret, so it submits nothing to mean "keep it".
     * Treating that as a rotation would wipe the credential.
     */
    @Test
    void leavesTheStoredSecretAloneWhenTheFormSendsNone() {
        CredentialProfileResponse created = service().create(TENANT, ACTOR, entraRequest("Partner API", "QA"));

        service().update(TENANT, ACTOR, created.id(), new UpdateCredentialProfileRequest(
                "Partner API renamed", null, null, Map.of()));

        assertNull(credentials.lastUpdate.encryptedSecretJson());
        assertNull(credentials.lastUpdate.secretPreview());
        assertEquals("Partner API renamed", credentials.lastUpdate.displayName());
    }

    @Test
    void rotatesTheSecretWhenTheFormSendsANewOne() {
        CredentialProfileResponse created = service().create(TENANT, ACTOR, entraRequest("Partner API", "QA"));

        service().update(TENANT, ACTOR, created.id(), new UpdateCredentialProfileRequest(
                null, null, null, Map.of("clientSecret", "rotated")));

        assertNotNull(credentials.lastUpdate.encryptedSecretJson());
        assertEquals("****", credentials.lastUpdate.secretPreview());
    }

    /**
     * A caller may send only the half it changed; the stored half still has to satisfy
     * the type, so validation runs against the merged result.
     */
    @Test
    void validatesAnUpdatedConfigAgainstTheStoredOne() {
        CredentialProfileResponse created = service().create(TENANT, ACTOR, entraRequest("Partner API", "QA"));

        assertThrows(
                IllegalArgumentException.class,
                () -> service().update(TENANT, ACTOR, created.id(), new UpdateCredentialProfileRequest(
                        null, null, Map.of("clientId", "abc"), null)));
    }

    @Test
    void updatingSomethingThatIsNotThereIsNotFound() {
        assertNull(service().update(TENANT, ACTOR, UUID.randomUUID().toString(),
                new UpdateCredentialProfileRequest("x", null, null, null)));
    }

    @Test
    void reportsWhichConnectionsUseACredential() {
        CredentialProfileResponse created = service().create(TENANT, ACTOR, entraRequest("Partner API", "QA"));
        connections.rows.add(connection("WhatsApp Cloud", ProviderType.WHATSAPP, created.id()));
        connections.rows.add(connection("Partner API connection", ProviderType.CUSTOM_HTTP, created.id()));

        List<CredentialProfileResponse> listed = service().list(TENANT);

        assertEquals(2, listed.get(0).usedBy().size());
        assertEquals(CredentialUsageKind.CHANNEL, listed.get(0).usedBy().get(0).kind());
        assertEquals(CredentialUsageKind.INTEGRATION, listed.get(0).usedBy().get(1).kind());
    }

    @Test
    void refusesToDeleteACredentialSomethingStillUses() {
        CredentialProfileResponse created = service().create(TENANT, ACTOR, entraRequest("Partner API", "QA"));
        connections.rows.add(connection("Partner API connection", ProviderType.CUSTOM_HTTP, created.id()));

        CredentialInUseException error = assertThrows(
                CredentialInUseException.class,
                () -> service().delete(TENANT, ACTOR, created.id(), false));

        assertEquals("Partner API connection", error.usages().get(0).label());
        assertFalse(credentials.deleted, "nothing may be deactivated when the delete is refused");
    }

    @Test
    void deletesAReferencedCredentialWhenForced() {
        CredentialProfileResponse created = service().create(TENANT, ACTOR, entraRequest("Partner API", "QA"));
        connections.rows.add(connection("Partner API connection", ProviderType.CUSTOM_HTTP, created.id()));

        assertTrue(service().delete(TENANT, ACTOR, created.id(), true));
        assertTrue(credentials.deleted);
    }

    @Test
    void deletingSomethingThatIsNotThereIsNotFound() {
        assertFalse(service().delete(TENANT, ACTOR, UUID.randomUUID().toString(), false));
    }

    @Test
    void recordsTheOutcomeOfTestingAStoredCredential() {
        CredentialProfileResponse created = service().create(TENANT, ACTOR, entraRequest("Partner API", "QA"));

        CredentialTestResponse response = service().test(TENANT, created.id());

        assertTrue(response.success());
        assertEquals(Boolean.TRUE, credentials.recordedTestResult);
        assertNotNull(credentials.recordedTestedAt);
    }

    @Test
    void testingSomethingThatIsNotThereIsNotFound() {
        assertNull(service().test(TENANT, UUID.randomUUID().toString()));
    }

    /**
     * The token endpoint is fetched by the server, so an operator must not be able to
     * aim it at the cluster's own network.
     */
    @Test
    void refusesToTestATokenEndpointOnTheInternalNetwork() {
        CredentialTestResponse response = service().testConfig(new com.microboxlabs.miot.integrations.dto
                .CredentialTestRequest(
                CredentialType.OAUTH2_CLIENT_CREDENTIALS,
                Map.of("clientId", "abc", "tokenUrl", "http://127.0.0.1:8080/token"),
                Map.of("clientSecret", "s3cret")));

        assertFalse(response.success());
        assertEquals("tokenUrl must not point to an internal address", response.message());
    }

    private CredentialProfileService service() {
        return new CredentialProfileService(
                credentials,
                connections,
                new IntegrationSecretCipher(new ObjectMapper(), "unit-test-key"),
                alwaysPassingTester());
    }

    private static CredentialTesterRegistry alwaysPassingTester() {
        return new CredentialTesterRegistry(null) {
            @Override
            public CredentialTestResponse test(
                    CredentialType type, Map<String, Object> publicConfig, Map<String, Object> secretConfig) {
                return new CredentialTestResponse(true, OffsetDateTime.now(), "Token issued", 3599L);
            }
        };
    }

    private static CreateCredentialProfileRequest entraRequest(String name, String environment) {
        return new CreateCredentialProfileRequest(
                name,
                CredentialType.AZURE_ENTRA_CLIENT_CREDENTIALS,
                null,
                environment,
                ENTRA_CONFIG,
                Map.of("clientSecret", "s3cret"));
    }

    private static IntegrationConnection connection(String name, ProviderType type, String credentialId) {
        return new IntegrationConnection(
                UUID.randomUUID().toString(), TENANT, name, type,
                URI.create("https://example.test"), credentialId,
                ConnectionStatus.ACTIVE, null, null, Map.of());
    }

    /** In-memory stand-in; the repository's own SQL is covered by the integrity test. */
    private static class FakeCredentials extends CredentialProfileRepository {

        final List<CredentialProfile> rows = new ArrayList<>();
        UpdateCredentialProfileParams lastUpdate;
        OffsetDateTime recordedTestedAt;
        Boolean recordedTestResult;
        boolean deleted;

        FakeCredentials() {
            super(null);
        }

        @Override
        public List<CredentialProfile> listByTenant(String tenantCode) {
            return List.copyOf(rows);
        }

        @Override
        public CredentialProfile findByTenantAndId(String tenantCode, String id) {
            return rows.stream().filter(row -> row.id().equals(id)).findFirst().orElse(null);
        }

        @Override
        public CredentialProfile create(CredentialProfile profile) {
            rows.add(profile);
            return profile;
        }

        @Override
        public CredentialProfile update(UpdateCredentialProfileParams params) {
            lastUpdate = params;
            return findByTenantAndId(params.tenantCode(), params.id());
        }

        @Override
        public CredentialProfile updateTestResult(
                String tenantCode, String id, OffsetDateTime testedAt, Boolean testResult) {
            recordedTestedAt = testedAt;
            recordedTestResult = testResult;
            return findByTenantAndId(tenantCode, id);
        }

        @Override
        public boolean softDelete(String tenantCode, String id, String deletedBy) {
            deleted = true;
            return true;
        }
    }

    private static class FakeConnections extends IntegrationConnectionRepository {

        final List<IntegrationConnection> rows = new ArrayList<>();

        FakeConnections() {
            super(null);
        }

        @Override
        public List<IntegrationConnection> listByCredentialProfiles(
                String tenantCode, Collection<String> credentialProfileIds) {
            return rows.stream()
                    .filter(row -> credentialProfileIds.contains(row.credentialProfileId()))
                    .toList();
        }
    }
}
