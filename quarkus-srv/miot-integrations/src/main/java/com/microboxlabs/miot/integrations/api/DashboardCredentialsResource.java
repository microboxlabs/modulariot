package com.microboxlabs.miot.integrations.api;

import com.microboxlabs.miot.core.model.Organization;
import com.microboxlabs.miot.integrations.auth.AuthResolutionException;
import com.microboxlabs.miot.integrations.auth.ResolvedAuth;
import com.microboxlabs.miot.integrations.dto.AppliedAuthResponse;
import com.microboxlabs.miot.integrations.service.CredentialAuthResolver;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.jboss.logging.Logger;

/**
 * Answers the dashboard server's credential lookups. It stores datasources
 * but no credentials, so it asks here what to send, and the secret stays in
 * this module.
 *
 * <p>Outside {@code /api/v1/orgs/}, so {@code OrganizationRequestFilter} does
 * not run and the caller needs no user. It authenticates with
 * {@code miot.dashboards.proxy-key} instead, the key this modulith sends when
 * it proxies dashboard requests the other way.
 *
 * <p>{@code tenantId} is the org slug, which is all the dashboard server
 * holds. Credentials are keyed by {@code tenant_code}, so the slug is
 * translated here.
 */
@Path("/api/v1/dashboard-credentials/{tenantId}/{credentialRef}")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "Dashboards", description = "Credential lookups for the dashboard server")
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class DashboardCredentialsResource {

    private static final Logger LOG = Logger.getLogger(DashboardCredentialsResource.class);
    private static final String KEY_HEADER = "x-miot-proxy-key";

    private final CredentialAuthResolver resolver;
    private final Optional<String> proxyKey;

    @Inject
    public DashboardCredentialsResource(
            CredentialAuthResolver resolver,
            @ConfigProperty(name = "miot.dashboards.proxy-key") Optional<String> proxyKey) {
        this.resolver = resolver;
        this.proxyKey = proxyKey;
    }

    @GET
    public Uni<Response> resolve(
            @PathParam("tenantId") String tenantId,
            @PathParam("credentialRef") String credentialRef,
            @HeaderParam(KEY_HEADER) String presentedKey) {

        String configured = proxyKey.orElse("");
        if (configured.isBlank()) {
            return Uni.createFrom().item(
                    error(Response.Status.SERVICE_UNAVAILABLE, "Credential lookups are not configured"));
        }
        if (!keyAccepted(configured, presentedKey)) {
            return Uni.createFrom().item(error(Response.Status.UNAUTHORIZED, "Unauthorized"));
        }

        return tenantCodeFor(tenantId)
                .flatMap(tenantCode -> tenantCode.isEmpty()
                        ? Uni.createFrom().item(notFound())
                        : onWorker(() -> applied(tenantCode.get(), credentialRef)));
    }

    /**
     * Constant time. {@code isEqual} is only constant for arrays of the same
     * length, so lengths are compared first.
     */
    static boolean keyAccepted(String configured, String presented) {
        if (presented == null) {
            return false;
        }
        byte[] expected = configured.getBytes(StandardCharsets.UTF_8);
        byte[] actual = presented.getBytes(StandardCharsets.UTF_8);
        return expected.length == actual.length && MessageDigest.isEqual(expected, actual);
    }

    /** The org's tenant code, or empty when no org has that slug. */
    private Uni<Optional<String>> tenantCodeFor(String slug) {
        return Panache.withSession(() -> Organization.findBySlug(slug)
                .map(org -> org == null
                        ? Optional.<String>empty()
                        : Optional.ofNullable(org.tenantClientId)));
    }

    private Response applied(String tenantCode, String credentialRef) {
        ResolvedAuth auth;
        try {
            auth = resolver.resolve(tenantCode, credentialRef);
        } catch (AuthResolutionException e) {
            // The message names the credential and its type, never the secret.
            LOG.warnf("Credential %s could not produce auth: %s", credentialRef, e.getMessage());
            return error(Response.Status.INTERNAL_SERVER_ERROR, "Could not resolve the credential");
        }
        return auth == null ? notFound() : Response.ok(AppliedAuthResponse.httpAuth(auth)).build();
    }

    private static Response notFound() {
        return error(Response.Status.NOT_FOUND, "No such credential");
    }

    private static Response error(Response.Status status, String message) {
        return Response.status(status)
                .type(MediaType.APPLICATION_JSON)
                .entity(Map.of("error", message))
                .build();
    }

    private static <T> Uni<T> onWorker(Supplier<T> work) {
        return Uni.createFrom().item(work).runSubscriptionOn(Infrastructure.getDefaultWorkerPool());
    }
}
