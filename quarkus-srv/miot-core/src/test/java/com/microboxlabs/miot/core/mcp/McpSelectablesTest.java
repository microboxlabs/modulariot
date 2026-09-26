package com.microboxlabs.miot.core.mcp;

import static io.restassured.RestAssured.given;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.is;

import com.microboxlabs.miot.core.auth.StubAlfrescoMembershipClient;
import com.microboxlabs.miot.core.auth.TestTokenFactory;
import io.agroal.api.AgroalDataSource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.restassured.path.json.JsonPath;
import io.restassured.response.Response;
import io.restassured.specification.RequestSpecification;
import jakarta.inject.Inject;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * The selectables tools over the MCP endpoint, through the real token check
 * and organization membership. DB from Quarkus DevServices Postgres (Docker).
 */
@QuarkusTest
@TestProfile(McpTestProfile.class)
class McpSelectablesTest {

    private static final String ORG_SLUG = "mcp-test-org";
    private static final String ORG_TENANT = "mcp-test-tenant";
    private static final String OUTSIDER = "intruder@test.example";
    private static final String ACCEPT = "application/json, text/event-stream";

    @Inject
    AgroalDataSource ds;

    private String token;

    @BeforeEach
    void seedOrg() throws SQLException {
        try (Connection c = ds.getConnection(); var st = c.prepareStatement(
                "INSERT INTO miot_core.organizations (slug, name, alfresco_group_id, tenant_client_id, active)"
                        + " VALUES (?, ?, ?, ?, true)")) {
            st.setString(1, ORG_SLUG);
            st.setString(2, "MCP Test Org");
            st.setString(3, "GROUP_mcp_test");
            st.setString(4, ORG_TENANT);
            st.executeUpdate();
        }
    }

    @AfterEach
    void cleanup() throws SQLException {
        try (Connection c = ds.getConnection()) {
            for (String sql : List.of(
                    "DELETE FROM miot_core.selectable_bindings WHERE tenant_code = ?",
                    "DELETE FROM miot_core.selectables WHERE tenant_code = ?",
                    "DELETE FROM miot_core.selectable_tenants WHERE tenant_code = ?")) {
                try (var st = c.prepareStatement(sql)) {
                    st.setString(1, ORG_TENANT);
                    st.executeUpdate();
                }
            }
            try (var st = c.prepareStatement("DELETE FROM miot_core.organizations WHERE slug = ?")) {
                st.setString(1, ORG_SLUG);
                st.executeUpdate();
            }
        }
    }

    @Test
    void theEndpointNeedsAToken() {
        int status = given()
                .contentType("application/json")
                .accept(ACCEPT)
                .body(initialize())
                .post(McpTestProfile.MCP_PATH)
                .statusCode();

        assertThat(status, is(401));
    }

    @Test
    void aMemberWritesAndReadsTheOrganizationsLists() {
        String session = open(TestTokenFactory.signWebToken(StubAlfrescoMembershipClient.MEMBER_EMAIL));

        JsonPath saved = call(session, "selectables_replace", Map.of(
                "organization", ORG_SLUG,
                "key", "delay_reason",
                "list", Map.of(
                        "name", Map.of("es", "Motivo", "en", "Reason"),
                        "mode", "SINGLE",
                        "options", List.of(Map.of("value", "traffic", "label", Map.of("es", "Tráfico"))))));
        assertThat(saved.getBoolean("result.isError"), is(false));
        assertThat(saved.getString("result.structuredContent.updatedBy"),
                is(StubAlfrescoMembershipClient.MEMBER_EMAIL));

        JsonPath options = call(session, "selectables_options",
                Map.of("organization", ORG_SLUG, "key", "delay_reason"));
        assertThat(options.getList("result.structuredContent.options.value"), hasItem("traffic"));
    }

    @Test
    void someoneOutsideTheOrganizationGetsAFailedCall() {
        String session = open(TestTokenFactory.signWebToken(OUTSIDER));

        JsonPath listed = call(session, "selectables_list", Map.of("organization", ORG_SLUG));

        assertThat(listed.getBoolean("result.isError"), is(true));
        assertThat(listed.getString("result.content[0].text"),
                is("User is not a member of organization: " + ORG_SLUG));
    }

    /** Initializes an MCP session as the token's caller. */
    private String open(String bearer) {
        token = bearer;
        Response init = request(null).body(initialize()).post(McpTestProfile.MCP_PATH);
        assertThat(init.statusCode(), is(200));
        String session = init.header("Mcp-Session-Id");
        request(session)
                .body(Map.of("jsonrpc", "2.0", "method", "notifications/initialized"))
                .post(McpTestProfile.MCP_PATH);
        return session;
    }

    private JsonPath call(String session, String tool, Map<String, Object> arguments) {
        Response response = request(session)
                .body(Map.of("jsonrpc", "2.0", "id", 2, "method", "tools/call",
                        "params", Map.of("name", tool, "arguments", arguments)))
                .post(McpTestProfile.MCP_PATH);
        assertThat(response.statusCode(), is(200));
        return response.jsonPath();
    }

    private RequestSpecification request(String session) {
        var spec = given()
                .header("Authorization", "Bearer " + token)
                .contentType("application/json")
                .accept(ACCEPT);
        return session == null ? spec : spec.header("Mcp-Session-Id", session);
    }

    private static Map<String, Object> initialize() {
        return Map.of("jsonrpc", "2.0", "id", 1, "method", "initialize", "params", Map.of(
                "protocolVersion", "2025-06-18",
                "capabilities", Map.of(),
                "clientInfo", Map.of("name", "miot-test", "version", "1")));
    }
}
