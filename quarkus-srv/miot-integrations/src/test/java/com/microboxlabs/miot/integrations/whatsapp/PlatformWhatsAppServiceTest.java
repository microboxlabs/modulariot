package com.microboxlabs.miot.integrations.whatsapp;

import static com.microboxlabs.miot.integrations.email.PlatformMailService.PLATFORM_TENANT;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.domain.AuthType;
import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.CredentialProfile;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.ConnectionTestRequest;
import com.microboxlabs.miot.integrations.dto.ConnectionTestResponse;
import com.microboxlabs.miot.integrations.dto.CreateCredentialProfileRequest;
import com.microboxlabs.miot.integrations.dto.CreateIntegrationConnectionRequest;
import com.microboxlabs.miot.integrations.dto.CredentialProfileResponse;
import com.microboxlabs.miot.integrations.dto.UpdateIntegrationConnectionRequest;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import com.microboxlabs.miot.integrations.service.CredentialProfileService;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionService;
import com.microboxlabs.miot.integrations.whatsapp.PlatformWhatsAppService.PlatformWhatsAppView;
import com.microboxlabs.miot.integrations.whatsapp.PlatformWhatsAppService.SetPlatformWhatsAppRequest;
import java.net.URI;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** The platform WhatsApp account over in-memory connections and credentials. Placeholder ids only. */
class PlatformWhatsAppServiceTest {

    private final Map<String, IntegrationConnection> rows = new LinkedHashMap<>();
    private final Map<String, Map<String, Object>> secrets = new LinkedHashMap<>();
    private final List<CredentialProfileResponse> credentialRows = new ArrayList<>();
    private final FakeRepository repository = new FakeRepository();
    private final PlatformWhatsAppService service = new PlatformWhatsAppService(new FakeConnections(), repository,
            new FakeCredentials());

    @Test
    void withNoAccountNothingIsConfigured() {
        assertFalse(service.get().configured());
        assertNull(service.test());
        assertFalse(service.delete("owner"));
    }

    @Test
    void theFirstSaveStoresTheTokenAsABearerCredentialAndTheIdsAsMetadata() {
        PlatformWhatsAppView view = service.put(request("tok-1"), "owner");

        assertTrue(view.configured());
        IntegrationConnection stored = rows.values().iterator().next();
        assertEquals(PLATFORM_TENANT, stored.tenantCode());
        assertEquals(ProviderType.WHATSAPP, stored.providerType());
        assertEquals("Plataforma WhatsApp", stored.name());
        assertEquals(URI.create("https://graph.facebook.com/v25.0"), stored.baseUrl());
        assertEquals("100000000000001", stored.metadata().get("phone_number_id"));
        assertEquals("200000000000002", stored.metadata().get("waba_id"));
        assertEquals("+56 9 0000 0000", stored.metadata().get("display_phone_number"));
        assertEquals("v25.0", stored.metadata().get("graph_version"));
        assertEquals(false, stored.metadata().get("test_mode_enabled"));
        assertEquals(Map.of("token", "tok-1"), secrets.get(stored.credentialProfileId()));
        assertEquals(AuthType.BEARER_TOKEN, credentialRows.get(0).authType());
        assertEquals("ACTIVE", view.status());
        assertEquals(true, view.lastTestResult());
        assertEquals("****", view.tokenPreview());
        assertEquals("100000000000001", view.phoneNumberId());
        assertEquals("https://graph.facebook.com/v25.0", view.baseUrl());
    }

    @Test
    void theFirstSaveNeedsAToken() {
        assertThrows(IllegalArgumentException.class, () -> service.put(request(""), "owner"));
        assertTrue(rows.isEmpty());
    }

    @Test
    void aBlankTokenKeepsTheStoredOneAndTheRestIsReplaced() {
        service.put(request("tok-1"), "owner");

        PlatformWhatsAppView view = service.put(new SetPlatformWhatsAppRequest("100000000000001",
                "200000000000003", null, "v26.0", null, " ", true, List.of(" +56900000001 ", "")), "owner");

        IntegrationConnection stored = rows.values().iterator().next();
        assertEquals(1, rows.size());
        assertEquals(Map.of("token", "tok-1"), secrets.get(stored.credentialProfileId()));
        assertEquals("200000000000003", view.wabaId());
        assertNull(view.displayPhoneNumber());
        assertEquals("https://graph.facebook.com/v26.0", view.baseUrl());
        assertEquals(true, view.testModeEnabled());
        assertEquals(List.of("+56900000001"), view.testRecipients());
    }

    @Test
    void aNewTokenReplacesTheStoredOne() {
        service.put(request("tok-1"), "owner");
        service.put(request("tok-2"), "owner");

        IntegrationConnection stored = rows.values().iterator().next();
        assertEquals(Map.of("token", "tok-2"), secrets.get(stored.credentialProfileId()));
    }

    @Test
    void anOrganizationsNumberCannotBeTaken() {
        rows.put("org-conn", connection("org-conn", "tenant-1", "100000000000001"));

        assertThrows(IllegalStateException.class, () -> service.put(request("tok-1"), "owner"));
        assertEquals(1, rows.size());
    }

    @Test
    void malformedFieldsAreRefused() {
        assertThrows(IllegalArgumentException.class, () -> service.put(new SetPlatformWhatsAppRequest(
                "abc", "200000000000002", null, null, null, "t", false, null), "owner"));
        assertThrows(IllegalArgumentException.class, () -> service.put(new SetPlatformWhatsAppRequest(
                "100000000000001", null, null, null, null, "t", false, null), "owner"));
        assertThrows(IllegalArgumentException.class, () -> service.put(new SetPlatformWhatsAppRequest(
                "100000000000001", "200000000000002", null, "25", null, "t", false, null), "owner"));
        assertThrows(IllegalArgumentException.class, () -> service.put(new SetPlatformWhatsAppRequest(
                "100000000000001", "200000000000002", null, null, "http://graph.example.test", "t", false, null),
                "owner"));
        assertThrows(IllegalArgumentException.class, () -> service.put(new SetPlatformWhatsAppRequest(
                "100000000000001", "200000000000002", null, null, null, "t", true, List.of()), "owner"));
        assertThrows(IllegalArgumentException.class, () -> service.put(null, "owner"));
    }

    @Test
    void deleteRemovesTheConnectionAndItsCredential() {
        service.put(request("tok-1"), "owner");

        assertTrue(service.delete("owner"));

        assertTrue(rows.isEmpty());
        assertTrue(credentialRows.isEmpty());
        assertFalse(service.get().configured());
    }

    private static SetPlatformWhatsAppRequest request(String token) {
        return new SetPlatformWhatsAppRequest(" 100000000000001 ", "200000000000002", "+56 9 0000 0000", null, null,
                token, null, null);
    }

    private static IntegrationConnection connection(String id, String tenant, String phoneNumberId) {
        return new IntegrationConnection(id, tenant, "WhatsApp", ProviderType.WHATSAPP,
                URI.create("https://graph.facebook.com/v25.0"), "cred-x", ConnectionStatus.ACTIVE, null, null,
                Map.of("phone_number_id", phoneNumberId), null);
    }

    private final class FakeRepository extends IntegrationConnectionRepository {
        FakeRepository() {
            super(null);
        }

        @Override
        public IntegrationConnection findActiveByProvider(String tenantCode, ProviderType providerType) {
            return rows.values().stream()
                    .filter(c -> c.tenantCode().equals(tenantCode) && c.providerType() == providerType)
                    .findFirst().orElse(null);
        }

        @Override
        public IntegrationConnection findActiveWhatsAppByPhoneNumberId(String phoneNumberId) {
            return rows.values().stream()
                    .filter(c -> c.providerType() == ProviderType.WHATSAPP
                            && phoneNumberId.equals(c.metadata().get("phone_number_id")))
                    .findFirst().orElse(null);
        }
    }

    private final class FakeConnections extends IntegrationConnectionService {
        FakeConnections() {
            super(null, null, null, null, null, null, null);
        }

        @Override
        public IntegrationConnection createConnection(String tenantCode, CreateIntegrationConnectionRequest req) {
            IntegrationConnection created = new IntegrationConnection("conn-" + (rows.size() + 1), tenantCode,
                    req.name(), req.providerType(), req.baseUrl(), req.credentialProfileId(), ConnectionStatus.DRAFT,
                    null, null, req.metadata(), null);
            rows.put(created.id(), created);
            return created;
        }

        @Override
        public IntegrationConnection updateConnection(
                String tenantCode, String connectionId, UpdateIntegrationConnectionRequest req) {
            IntegrationConnection c = rows.get(connectionId);
            IntegrationConnection updated = new IntegrationConnection(c.id(), c.tenantCode(), c.name(),
                    c.providerType(), req.baseUrl() == null ? c.baseUrl() : req.baseUrl(), c.credentialProfileId(),
                    c.status(), c.lastTestedAt(), c.lastTestResult(),
                    req.metadata() == null ? c.metadata() : req.metadata(), null);
            rows.put(connectionId, updated);
            return updated;
        }

        @Override
        public boolean deleteConnection(String tenantCode, String connectionId) {
            return rows.remove(connectionId) != null;
        }

        @Override
        public ConnectionTestResponse testConnection(
                String tenantCode, String connectionId, ConnectionTestRequest req) {
            IntegrationConnection c = rows.get(connectionId);
            OffsetDateTime now = OffsetDateTime.parse("2026-10-24T12:00:00Z");
            rows.put(connectionId, new IntegrationConnection(c.id(), c.tenantCode(), c.name(), c.providerType(),
                    c.baseUrl(), c.credentialProfileId(), ConnectionStatus.ACTIVE, now, true, c.metadata(), null));
            return new ConnectionTestResponse(true, now, "ok");
        }
    }

    private final class FakeCredentials extends CredentialProfileService {
        FakeCredentials() {
            super(null, null, null, null);
        }

        @Override
        public List<CredentialProfileResponse> list(String tenantCode) {
            return List.copyOf(credentialRows);
        }

        @Override
        public CredentialProfileResponse get(String tenantCode, String id) {
            return credentialRows.stream().filter(c -> c.id().equals(id)).findFirst().orElse(null);
        }

        @Override
        public CredentialProfileResponse create(String tenantCode, String actor, CreateCredentialProfileRequest req) {
            CredentialProfileResponse created = new CredentialProfileResponse("cred-" + (credentialRows.size() + 1),
                    tenantCode, req.displayName(), null, req.authType(), null, req.publicConfig(), null, "****", 1,
                    null, null, List.of(), null, null, actor, actor);
            credentialRows.add(created);
            secrets.put(created.id(), req.secretConfig());
            return created;
        }

        @Override
        public boolean delete(String tenantCode, String actor, String id, boolean force) {
            secrets.remove(id);
            return credentialRows.removeIf(c -> c.id().equals(id));
        }

        @Override
        public CredentialProfile rotateSecret(String tenantCode, String id, Map<String, Object> secretConfig) {
            if (!secrets.containsKey(id)) {
                return null;
            }
            secrets.put(id, secretConfig);
            return new CredentialProfile(id, tenantCode, null, null, AuthType.BEARER_TOKEN, null, Map.of(), null,
                    "****", 2, null, null, null, null, null, null);
        }
    }
}
