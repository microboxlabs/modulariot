package com.microboxlabs.miot.core.alfresco.auth;

/**
 * Resolves the {@code Authorization} header value to send with every
 * Alfresco REST call. One-method SPI so the authentication scheme can
 * be swapped per deployment via {@code miot.alfresco.auth}
 * ({@code oauth} | {@code ticket} | {@code basic}) without touching
 * any client code.
 *
 * <p>Implementations return a fully-formed header value, e.g.
 * {@code "Bearer eyJ..."} or {@code "Basic YWRt..."}. The call is
 * synchronous because it runs inside a JAX-RS {@code ClientRequestFilter},
 * which executes on the event loop. Providers MUST NOT perform blocking
 * I/O here; if credentials need to be fetched remotely (e.g. an Alfresco
 * login ticket), cache them eagerly at startup or on first use.
 *
 * <p>Implementations MUST NOT return {@code null}: if no credentials are
 * available, throw so the caller sees a clear error instead of a silently
 * anonymous request.
 */
public interface AlfrescoAuthProvider {

    String resolveAuthHeader();
}
