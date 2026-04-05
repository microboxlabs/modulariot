package com.microboxlabs.miot.core.auth;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marks a JAX-RS resource as requiring M2M (machine-to-machine) authentication.
 *
 * <p>Resources annotated with {@code @M2MAuth} are verified using HS256 (shared secret).
 * All other {@code /api/*} resources default to RS256 (JWKS) verification.
 *
 * <p>Apply at class level — the resource's {@code @Path} is automatically registered
 * as an M2M path prefix at startup.
 *
 * <pre>{@code
 * @Path("/api/v1/asset/track")
 * @M2MAuth
 * public class AssetTrackingResource { ... }
 * }</pre>
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface M2MAuth {
}
