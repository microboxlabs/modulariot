package com.microboxlabs.miot.core.auth;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.math.BigInteger;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Fake OIDC endpoint mounted under {@code /_test/oidc} for @QuarkusTest runs.
 * Serves the JWKS document that {@code DualJwtAuthMechanism}'s {@code HttpsJwks}
 * resolver fetches when verifying tokens forged by {@link TestTokenFactory}.
 *
 * <p>Only present on the test classpath. {@link HarnessProxyTestProfile} sets
 * {@code miot.auth.jwks-url} to {@code http://localhost:<test-port>/_test/oidc/jwks}
 * so the mechanism reaches this resource on the same JVM it runs in.
 */
@ApplicationScoped
@Path("/_test/oidc")
@Produces(MediaType.APPLICATION_JSON)
public class MockOidcResource {

    @GET
    @Path("/jwks")
    public Map<String, Object> jwks() {
        Base64.Encoder b64Url = Base64.getUrlEncoder().withoutPadding();
        Map<String, Object> key = new LinkedHashMap<>();
        key.put("kty", "RSA");
        key.put("use", "sig");
        key.put("alg", "RS256");
        key.put("kid", TestTokenFactory.KID);
        key.put("n", b64Url.encodeToString(unsignedBytes(TestTokenFactory.modulus())));
        key.put("e", b64Url.encodeToString(unsignedBytes(TestTokenFactory.exponent())));
        return Map.of("keys", List.of(key));
    }

    private static byte[] unsignedBytes(BigInteger value) {
        byte[] bytes = value.toByteArray();
        if (bytes.length > 1 && bytes[0] == 0) {
            byte[] trimmed = new byte[bytes.length - 1];
            System.arraycopy(bytes, 1, trimmed, 0, trimmed.length);
            return trimmed;
        }
        return bytes;
    }
}
