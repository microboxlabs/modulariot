package com.microboxlabs.miot.integrations.tester;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.ConnectionTestResponse;
import java.net.URI;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * The fallback tester sends nothing, but it must not bless a base URL the dispatcher's
 * SSRF guard will refuse on first use — that mismatch is exactly how a connection with
 * {@code http://localhost:8080} once tested green and then failed every dispatch.
 *
 * <p>Hosts are IP literals or names that resolve locally, so no live DNS is needed.
 */
class GenericConnectionTesterTest {

    private final GenericConnectionTester tester = new GenericConnectionTester();

    private static IntegrationConnection connection(String baseUrl) {
        return new IntegrationConnection(
                "c-1", "tenant-1", "Partner", ProviderType.CUSTOM_HTTP,
                baseUrl == null ? null : URI.create(baseUrl),
                "cred-1", ConnectionStatus.DRAFT, null, null, Map.of(), null);
    }

    private ConnectionTestResponse test(String baseUrl) {
        return tester.test(connection(baseUrl), null, null);
    }

    @Test
    void aPublicAddressPasses() {
        assertTrue(test("https://8.8.8.8/api").success());
    }

    @Test
    void aLoopbackAddressFails() {
        ConnectionTestResponse response = test("http://127.0.0.1:8080/alfresco/s");
        assertFalse(response.success());
        assertTrue(response.message().contains("internal"), response.message());
    }

    @Test
    void localhostFails() {
        assertFalse(test("http://localhost:8080/alfresco/s").success());
    }

    @Test
    void aSiteLocalAddressFails() {
        assertFalse(test("http://10.0.0.5/api").success());
    }

    @Test
    void anUnresolvableHostFails() {
        // RFC 2606 reserves .invalid: never resolves, no live DNS involved.
        ConnectionTestResponse response = test("http://mock.invalid/api");
        assertFalse(response.success());
        assertTrue(response.message().contains("resolved"), response.message());
    }

    @Test
    void aNonHttpSchemeFails() {
        assertFalse(test("ftp://partner.example/api").success());
    }

    @Test
    void aConnectionWithoutABaseUrlKeepsTheContractOnlyBehaviour() {
        assertTrue(test(null).success());
    }
}
