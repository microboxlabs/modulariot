package com.microboxlabs.miot.integrations.auth.customheaders;

import com.microboxlabs.miot.integrations.auth.AuthResolutionException;
import com.microboxlabs.miot.integrations.auth.CredentialAuthContext;
import com.microboxlabs.miot.integrations.auth.CredentialAuthProvider;
import com.microboxlabs.miot.integrations.auth.ResolvedAuth;
import com.microboxlabs.miot.integrations.domain.AuthType;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * {@link AuthType#CUSTOM_HEADERS} — the escape hatch for providers whose scheme is none
 * of the standard ones (a signed vendor header, a paired key/secret, a tenant header
 * alongside a token).
 *
 * <p>Credential shape: {@code secret.headers}, an object of header name → value. The
 * whole map is secret because a custom scheme usually carries the key <i>in</i> a
 * header, and we cannot tell which of them is sensitive.
 *
 * <p>Unlike the other providers this has no {@code AuthStrategy} behind it — there is
 * nothing to compute, only to copy — so it builds the {@link ResolvedAuth} directly.
 */
@ApplicationScoped
public class CustomHeadersCredentialAuthProvider implements CredentialAuthProvider {

    /** The decrypted key holding the header map. */
    public static final String SECRET_HEADERS = "headers";

    @Override
    public Set<AuthType> supportedTypes() {
        return Set.of(AuthType.CUSTOM_HEADERS);
    }

    @Override
    public ResolvedAuth resolve(CredentialAuthContext context) {
        Object raw = context.secret().get(SECRET_HEADERS);
        if (!(raw instanceof Map<?, ?> map) || map.isEmpty()) {
            throw new AuthResolutionException(
                    "CUSTOM_HEADERS credential is missing a non-empty 'headers' object in its secret config");
        }
        Map<String, String> headers = new LinkedHashMap<>();
        map.forEach((name, value) -> {
            if (name == null || value == null) {
                return;
            }
            String header = name.toString();
            String text = value.toString();
            // A newline here would let a stored credential inject extra headers or a
            // body into every request this connection makes.
            if (containsControlChar(header) || containsControlChar(text)) {
                throw new AuthResolutionException(
                        "CUSTOM_HEADERS credential has an illegal character in header '" + header + "'");
            }
            headers.put(header, text);
        });
        if (headers.isEmpty()) {
            throw new AuthResolutionException(
                    "CUSTOM_HEADERS credential resolved to no usable headers");
        }
        return ResolvedAuth.headers(headers, null);
    }

    private static boolean containsControlChar(String value) {
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (c == '\r' || c == '\n' || c < 0x20) {
                return true;
            }
        }
        return false;
    }
}
