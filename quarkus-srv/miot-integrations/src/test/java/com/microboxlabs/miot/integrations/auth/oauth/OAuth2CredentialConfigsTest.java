package com.microboxlabs.miot.integrations.auth.oauth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.domain.CredentialType;
import com.microboxlabs.miot.integrations.domain.TokenRequestFormat;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

class OAuth2CredentialConfigsTest {

    private static final Map<String, Object> ENTRA = Map.of(
            "tenantId", "11111111-2222-3333-4444-555555555555",
            "clientId", "66666666-7777-8888-9999-000000000000",
            "scope", "api://partner-api/.default");

    @Test
    void derivesTheEntraTokenEndpointFromTheDirectoryId() {
        assertEquals(
                "https://login.microsoftonline.com/11111111-2222-3333-4444-555555555555/oauth2/v2.0/token",
                OAuth2CredentialConfigs
                        .tokenUrl(CredentialType.AZURE_ENTRA_CLIENT_CREDENTIALS, ENTRA)
                        .toString());
    }

    @Test
    void anOverrideWinsOverTheDerivedEntraEndpoint() {
        Map<String, Object> config = new HashMap<>(ENTRA);
        config.put("tokenUrlOverride", "https://login.microsoftonline.us/tenant/oauth2/v2.0/token");

        assertEquals(
                "https://login.microsoftonline.us/tenant/oauth2/v2.0/token",
                OAuth2CredentialConfigs
                        .tokenUrl(CredentialType.AZURE_ENTRA_CLIENT_CREDENTIALS, config)
                        .toString());
    }

    /** A blank override is what an untouched optional field submits — it must not win. */
    @Test
    void aBlankOverrideFallsBackToTheDerivedEndpoint() {
        Map<String, Object> config = new HashMap<>(ENTRA);
        config.put("tokenUrlOverride", "   ");

        assertTrue(OAuth2CredentialConfigs
                .tokenUrl(CredentialType.AZURE_ENTRA_CLIENT_CREDENTIALS, config)
                .toString()
                .startsWith(OAuth2CredentialConfigs.ENTRA_LOGIN_HOST));
    }

    @Test
    void namesTheMissingFieldRatherThanFailingGenerically() {
        Map<String, Object> withoutTenant = Map.of("clientId", "abc", "scope", "x/.default");

        IllegalArgumentException error = assertThrows(
                IllegalArgumentException.class,
                () -> OAuth2CredentialConfigs.validatePublicConfig(
                        CredentialType.AZURE_ENTRA_CLIENT_CREDENTIALS, withoutTenant));

        assertEquals("tenantId is required", error.getMessage());
    }

    @Test
    void aGenericProviderMustStateItsTokenUrl() {
        IllegalArgumentException error = assertThrows(
                IllegalArgumentException.class,
                () -> OAuth2CredentialConfigs.validatePublicConfig(
                        CredentialType.OAUTH2_CLIENT_CREDENTIALS, Map.of("clientId", "abc")));

        assertEquals("tokenUrl is required", error.getMessage());
    }

    /** The SSRF guard's shape half runs at validation time, offline. */
    @Test
    void rejectsATokenUrlThatIsNotHttp() {
        Map<String, Object> config = Map.of("clientId", "abc", "tokenUrl", "file:///etc/passwd");

        IllegalArgumentException error = assertThrows(
                IllegalArgumentException.class,
                () -> OAuth2CredentialConfigs.validatePublicConfig(
                        CredentialType.OAUTH2_CLIENT_CREDENTIALS, config));

        assertEquals("tokenUrl must be http or https", error.getMessage());
    }

    @Test
    void defaultsTheTokenRequestFormatToFormEncoding() {
        OAuth2ClientCredentialsConfig config = OAuth2CredentialConfigs.toConfig(
                CredentialType.AZURE_ENTRA_CLIENT_CREDENTIALS, ENTRA, Map.of("clientSecret", "s3cret"));

        assertEquals(TokenRequestFormat.FORM, config.tokenRequestFormat());
        assertEquals("api://partner-api/.default", config.scope().orElseThrow());
    }

    @Test
    void carriesTheClientSecretIntoTheGrantConfig() {
        OAuth2ClientCredentialsConfig config = OAuth2CredentialConfigs.toConfig(
                CredentialType.AZURE_ENTRA_CLIENT_CREDENTIALS, ENTRA, Map.of("clientSecret", "s3cret"));

        assertEquals("s3cret", config.clientSecret());
        // Whatever else it prints, the secret is not in it.
        assertTrue(config.toString().contains("<redacted>"));
    }

    @Test
    void aMissingClientSecretIsReportedAsSuch() {
        IllegalArgumentException error = assertThrows(
                IllegalArgumentException.class,
                () -> OAuth2CredentialConfigs.toConfig(
                        CredentialType.AZURE_ENTRA_CLIENT_CREDENTIALS, ENTRA, Map.of()));

        assertEquals("clientSecret is required", error.getMessage());
    }
}
