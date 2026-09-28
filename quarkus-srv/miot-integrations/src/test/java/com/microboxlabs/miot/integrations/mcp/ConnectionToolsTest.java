package com.microboxlabs.miot.integrations.mcp;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.auth.OrganizationAccess;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.mcp.McpCaller;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.CredentialProfile;
import com.microboxlabs.miot.integrations.domain.CredentialType;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.IntegrationOperation;
import com.microboxlabs.miot.integrations.domain.IntegrationTemplate;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.ConnectionTestRequest;
import com.microboxlabs.miot.integrations.dto.ConnectionTestResponse;
import com.microboxlabs.miot.integrations.dto.CredentialProfileResponse;
import com.microboxlabs.miot.integrations.persistence.CredentialProfileRepository;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import com.microboxlabs.miot.integrations.persistence.IntegrationOperationRepository;
import com.microboxlabs.miot.integrations.persistence.IntegrationTemplateRepository;
import com.microboxlabs.miot.integrations.service.CredentialProfileService;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionService;
import com.microboxlabs.miot.integrations.service.IntegrationTemplateService;
import com.microboxlabs.miot.integrations.tester.ConnectionTester;
import com.microboxlabs.miot.integrations.tester.ConnectionTesterRegistry;
import io.quarkiverse.mcp.server.ToolCallException;
import io.quarkus.security.runtime.QuarkusSecurityIdentity;
import io.smallrye.jwt.auth.principal.DefaultJWTCallerPrincipal;
import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.core.Response;
import java.net.URI;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jose4j.jwt.JwtClaims;
import org.junit.jupiter.api.Test;

class ConnectionToolsTest {

    private static final String ORG = "acme";
    private static final String TENANT = "tenant-acme";
    private static final String OWNER = "owner@acme.test";
    private static final String MEMBER = "member@acme.test";

    private final Connections connectionRows = new Connections();
    private final Operations operationRows = new Operations();
    private final Templates templateRows = new Templates();
    private final List<String> tested = new ArrayList<>();

    ConnectionToolsTest() {
        templateRows.rows.put("tmpl-1", new IntegrationTemplate("tmpl-1", TENANT, "Orders API",
                ProviderType.CUSTOM_HTTP, "list_orders", "GET", "/orders", Map.of("type", "object"), Map.of()));
    }

    private ConnectionTools toolsFor(String email) {
        JwtClaims claims = new JwtClaims();
        claims.setSubject("auth0|" + email);
        claims.setClaim("email", email);
        QuarkusSecurityIdentity identity = QuarkusSecurityIdentity.builder()
                .setPrincipal(new DefaultJWTCallerPrincipal(claims))
                .build();
        TenantContext tenant = new TenantContext();
        OrganizationContext organization = new OrganizationContext();
        McpCaller caller = new McpCaller(identity, new FakeAccess(tenant, organization), new FakeRoles(organization),
                tenant, List.of("azp", "aud"));
        ConnectionTesterRegistry testers = new ConnectionTesterRegistry(null, null) {
            @Override
            public ConnectionTester testerFor(ProviderType providerType) {
                return new ConnectionTester() {
                    @Override
                    public boolean supports(ProviderType type) {
                        return true;
                    }

                    @Override
                    public ConnectionTestResponse test(IntegrationConnection connection,
                            CredentialProfile credential,
                            ConnectionTestRequest request) {
                        tested.add(connection.id() + " " + request.method() + " " + request.path());
                        return new ConnectionTestResponse(true, OffsetDateTime.now(), "reachable");
                    }
                };
            }
        };
        IntegrationConnectionService connections = new IntegrationConnectionService(new NoCredentialRows(), null,
                connectionRows, operationRows, templateRows, null, testers);
        return new ConnectionTools(caller, connections, new IntegrationTemplateService(templateRows, connectionRows),
                new Credentials());
    }

    private static <T> T await(Uni<T> call) {
        return call.await().indefinitely();
    }

    private static ToolCallException failure(Uni<?> call) {
        var awaiting = call.await();
        return assertThrows(ToolCallException.class, awaiting::indefinitely);
    }

    private ConnectionTools.ConnectionView createOrders(ConnectionTools tools) {
        return await(tools.create(ORG, "Orders", "tmpl-1", "https://203.0.113.10", "cred-1",
                Map.of("region", "north")));
    }

    @Test
    void anOwnerCreatesAConnectionFromATemplateAndItGetsTheTemplatesOperation() {
        ConnectionTools tools = toolsFor(OWNER);
        ConnectionTools.ConnectionView created = createOrders(tools);

        assertEquals(ProviderType.CUSTOM_HTTP, created.providerType());
        assertEquals(ConnectionStatus.DRAFT, created.status());
        assertEquals("tmpl-1", created.templateId());
        assertEquals("cred-1", created.credentialProfileId());
        assertEquals(TENANT, connectionRows.rows.get(created.id()).tenantCode());

        ConnectionTools.ConnectionDetail detail = await(tools.get(ORG, created.id()));
        assertEquals(List.of(new ConnectionTools.OperationView("list_orders", "GET", "/orders", false)),
                detail.operations());
        assertEquals(List.of("Orders"), await(tools.list(ORG)).connections().stream()
                .map(ConnectionTools.ConnectionView::name).toList());
    }

    @Test
    void templatesComeWithTheCredentialsByReferenceOnly() {
        ConnectionTools.Templates found = await(toolsFor(OWNER).templates(ORG));

        assertEquals(List.of("Orders API"), found.templates().stream().map(IntegrationTemplate::name).toList());
        assertEquals(List.of(new ConnectionTools.CredentialRef("cred-1", "Orders key", CredentialType.API_KEY,
                "PRODUCTION")), found.credentials());
    }

    @Test
    void secretLookingMetadataIsMaskedOnTheWayOut() {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("region", "north");
        metadata.put("accessToken", "raw-value");
        metadata.put("token_value", "raw-value");
        metadata.put("headers", Map.of("Authorization", "Bearer raw-value", "Accept", "application/json"));
        connectionRows.rows.put("legacy", new IntegrationConnection("legacy", TENANT, "Legacy",
                ProviderType.CUSTOM_HTTP, URI.create("https://legacy.example.test"), null, ConnectionStatus.ACTIVE,
                null, null, metadata, null));

        Map<String, Object> shown = await(toolsFor(OWNER).get(ORG, "legacy")).connection().metadata();

        assertEquals("north", shown.get("region"));
        assertEquals(ConnectionTools.MASK, shown.get("accessToken"));
        assertEquals(ConnectionTools.MASK, shown.get("token_value"));
        assertEquals(Map.of("Authorization", ConnectionTools.MASK, "Accept", "application/json"),
                shown.get("headers"));
        assertFalse(shown.toString().contains("raw-value"));
    }

    @Test
    void secretsAreRefusedAsCreateArguments() {
        ConnectionTools tools = toolsFor(OWNER);

        String message = failure(tools.create(ORG, "Orders", "tmpl-1", "https://203.0.113.10", null,
                Map.of("auth", Map.of("password", "x")))).getMessage();

        assertTrue(message.startsWith("metadata.auth.password looks like a secret"), message);
        assertTrue(connectionRows.rows.isEmpty());
    }

    @Test
    void theTestRunsAgainstAnExistingConnectionAndRecordsItsResult() {
        ConnectionTools tools = toolsFor(OWNER);
        ConnectionTools.ConnectionView created = createOrders(tools);

        ConnectionTestResponse result = await(tools.test(ORG, created.id(), "GET", "/health"));

        assertTrue(result.success());
        assertEquals(List.of(created.id() + " GET /health"), tested);
        assertEquals(ConnectionStatus.ACTIVE, connectionRows.rows.get(created.id()).status());
        assertEquals("connection not found: nope", failure(tools.test(ORG, "nope", null, null)).getMessage());
        assertEquals(1, tested.size(), "a missing connection is not probed");
    }

    @Test
    void aConnectionToAnInternalAddressIsNotProbed() {
        ConnectionTools tools = toolsFor(OWNER);
        ConnectionTools.ConnectionView created = await(tools.create(ORG, "Local", "tmpl-1", "http://127.0.0.1:8080",
                null, null));

        assertEquals("baseUrl must not point to an internal address",
                failure(tools.test(ORG, created.id(), null, null)).getMessage());
        assertTrue(tested.isEmpty());
    }

    @Test
    void refusalsAreFailedToolCalls() {
        ConnectionTools owner = toolsFor(OWNER);

        assertEquals("Organization owner access required", failure(toolsFor(MEMBER).list(ORG)).getMessage());
        assertEquals("User is not a member of organization: acme",
                failure(toolsFor("stranger@else.test").list(ORG)).getMessage());
        assertEquals("template not found: tmpl-x",
                failure(owner.create(ORG, "A", "tmpl-x", "https://a.example.test", null, null)).getMessage());
        assertEquals("credential not found: cred-x",
                failure(owner.create(ORG, "A", "tmpl-1", "https://a.example.test", "cred-x", null)).getMessage());
        assertEquals("baseUrl must be an absolute http(s) URL",
                failure(owner.create(ORG, "A", "tmpl-1", "ftp://a.example.test", null, null)).getMessage());
        assertEquals("baseUrl must not carry a user or password; use a credential",
                failure(owner.create(ORG, "A", "tmpl-1", "https://u:p@a.example.test", null, null)).getMessage());
        assertEquals("baseUrl must not have a query or fragment",
                failure(owner.create(ORG, "A", "tmpl-1", "https://a.example.test/?key=x", null, null)).getMessage());
        assertEquals("name is required",
                failure(owner.create(ORG, " ", "tmpl-1", "https://a.example.test", null, null)).getMessage());
        assertEquals("connection not found: nope", failure(owner.get(ORG, "nope")).getMessage());
        assertTrue(connectionRows.rows.isEmpty());
    }

    @Test
    void maskingKeepsNonSecretKeysAndEmptiesNull() {
        assertEquals(Map.of(), ConnectionTools.masked(null));
        assertEquals("https://idp.example.test",
                ConnectionTools.masked(Map.of("tokenUrl", "https://idp.example.test")).get("tokenUrl"));
    }

    /* ---- fakes ---- */

    static final class FakeAccess extends OrganizationAccess {
        final TenantContext tenant;
        final OrganizationContext organization;

        FakeAccess(TenantContext tenant, OrganizationContext organization) {
            super(tenant, organization, null);
            this.tenant = tenant;
            this.organization = organization;
        }

        @Override
        public Uni<Refusal> enter(String slug, String email, String m2mClientId) {
            if (!ORG.equals(slug) || !Set.of(OWNER, MEMBER).contains(email)) {
                return Uni.createFrom().item(new Refusal(Response.Status.FORBIDDEN,
                        "User is not a member of organization: " + slug));
            }
            tenant.setTenantCode("tenant-" + slug);
            organization.setUserEmail(email);
            return Uni.createFrom().nullItem();
        }
    }

    static final class FakeRoles extends OrganizationRoleService {
        final OrganizationContext organization;

        FakeRoles(OrganizationContext organization) {
            super(null, organization);
            this.organization = organization;
        }

        @Override
        public Uni<Void> requireOwner(String organizationSlug) {
            return OWNER.equals(organization.getUserEmail())
                    ? Uni.createFrom().voidItem()
                    : Uni.createFrom().failure(new ForbiddenException("Organization owner access required"));
        }
    }

    static final class Connections extends IntegrationConnectionRepository {
        final Map<String, IntegrationConnection> rows = new LinkedHashMap<>();

        Connections() {
            super(null);
        }

        @Override
        public List<IntegrationConnection> listByTenant(String tenantCode) {
            return rows.values().stream().filter(c -> c.tenantCode().equals(tenantCode)).toList();
        }

        @Override
        public IntegrationConnection create(IntegrationConnection connection) {
            rows.put(connection.id(), connection);
            return connection;
        }

        @Override
        public IntegrationConnection findByTenantAndId(String tenantCode, String connectionId) {
            IntegrationConnection c = rows.get(connectionId);
            return c != null && c.tenantCode().equals(tenantCode) ? c : null;
        }

        @Override
        public IntegrationConnection updateTestResult(String tenantCode, String connectionId,
                ConnectionStatus status, OffsetDateTime testedAt, Boolean testResult) {
            IntegrationConnection c = rows.get(connectionId);
            IntegrationConnection updated = new IntegrationConnection(c.id(), c.tenantCode(), c.name(),
                    c.providerType(), c.baseUrl(), c.credentialProfileId(), status, testedAt, testResult,
                    c.metadata(), c.templateId());
            rows.put(connectionId, updated);
            return updated;
        }
    }

    static final class Operations extends IntegrationOperationRepository {
        final List<IntegrationOperation> rows = new ArrayList<>();

        Operations() {
            super(null);
        }

        @Override
        public IntegrationOperation create(IntegrationOperation operation) {
            rows.add(operation);
            return operation;
        }

        @Override
        public List<IntegrationOperation> listByConnection(String connectionId) {
            return rows.stream().filter(o -> o.connectionId().equals(connectionId)).toList();
        }
    }

    static final class Templates extends IntegrationTemplateRepository {
        final Map<String, IntegrationTemplate> rows = new LinkedHashMap<>();

        Templates() {
            super(null);
        }

        @Override
        public List<IntegrationTemplate> listByTenant(String tenantCode) {
            return rows.values().stream().filter(t -> t.tenantCode().equals(tenantCode)).toList();
        }

        @Override
        public IntegrationTemplate findByTenantAndId(String tenantCode, String templateId) {
            IntegrationTemplate t = rows.get(templateId);
            return t != null && t.tenantCode().equals(tenantCode) ? t : null;
        }
    }

    static final class NoCredentialRows extends CredentialProfileRepository {
        NoCredentialRows() {
            super(null);
        }

        @Override
        public CredentialProfile findByTenantAndId(String t, String id) {
            return null;
        }
    }

    static final class Credentials extends CredentialProfileService {
        private static final CredentialProfileResponse ORDERS_KEY = new CredentialProfileResponse("cred-1", TENANT,
                "Orders key", CredentialType.API_KEY, null, "PRODUCTION", Map.of(), null, "****", 1, null, null,
                List.of(), null, null, null, null);

        Credentials() {
            super(null, null, null, null);
        }

        @Override
        public List<CredentialProfileResponse> list(String tenantCode) {
            return TENANT.equals(tenantCode) ? List.of(ORDERS_KEY) : List.of();
        }

        @Override
        public CredentialProfileResponse get(String tenantCode, String id) {
            return list(tenantCode).stream().filter(c -> c.id().equals(id)).findFirst().orElse(null);
        }
    }
}
