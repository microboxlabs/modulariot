package com.microboxlabs.miot.integrations.net;

import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;

/**
 * Guard for URLs an operator supplies that the server then fetches — a webhook target,
 * an OAuth token endpoint override. Without it, anyone who can configure an integration
 * can aim the server at the cluster's own network (SSRF).
 *
 * <p>DNS rebinding remains a residual TOCTOU risk: the name is resolved here and again
 * by the HTTP client, and nothing pins the address in between.
 */
public final class OutboundUrlGuard {

    private OutboundUrlGuard() {
    }

    /**
     * Shape-only check: scheme and host, no name resolution. Cheap enough to run when a
     * URL is merely being stored, and it works offline — the resolving check belongs at
     * the moment the server actually fetches the URL.
     *
     * @throws IllegalArgumentException when the URL is absent or is not http(s)
     */
    public static void requireHttpUrl(URI url, String field) {
        if (url == null) {
            throw new IllegalArgumentException(field + " is required");
        }
        String scheme = url.getScheme();
        if (scheme == null || !(scheme.equalsIgnoreCase("https") || scheme.equalsIgnoreCase("http"))) {
            throw new IllegalArgumentException(field + " must be http or https");
        }
        String host = url.getHost();
        if (host == null || host.isBlank()) {
            throw new IllegalArgumentException(field + " host is required");
        }
    }

    /**
     * Full check, to run immediately before fetching: everything
     * {@link #requireHttpUrl} covers, plus the resolved address.
     *
     * @throws IllegalArgumentException when the URL is absent, is not http(s), or
     *                                  resolves to an internal address
     */
    public static void requirePublicHttpUrl(URI url, String field) {
        requireHttpUrl(url, field);
        String host = url.getHost();
        try {
            InetAddress addr = InetAddress.getByName(host);
            if (addr.isLoopbackAddress()
                    || addr.isAnyLocalAddress()
                    || addr.isLinkLocalAddress()
                    || addr.isSiteLocalAddress()) {
                throw new IllegalArgumentException(field + " must not point to an internal address");
            }
        } catch (UnknownHostException e) {
            throw new IllegalArgumentException(field + " host could not be resolved");
        }
    }
}
