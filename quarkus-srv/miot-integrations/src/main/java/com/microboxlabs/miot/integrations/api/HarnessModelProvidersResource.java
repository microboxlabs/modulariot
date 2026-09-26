package com.microboxlabs.miot.integrations.api;

import com.microboxlabs.miot.integrations.service.ModelProviderService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import java.util.Optional;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * The model providers with their keys, for the harness.
 *
 * <p>Off {@code /api/*} for the same reason as {@link DashboardCredentialsResource}:
 * the caller holds no user token. It authenticates with
 * {@code miot.harness.provider-key}, which the harness is configured with too.
 */
@Path(HarnessModelProvidersResource.PATH)
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "Harness", description = "Model providers for the harness")
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class HarnessModelProvidersResource {

    /** Matches the permit rule in {@code application.properties}. */
    static final String PATH = "/internal/model-providers";

    private static final String KEY_HEADER = "x-miot-harness-key";

    private final ModelProviderService service;
    private final Optional<String> providerKey;

    @Inject
    public HarnessModelProvidersResource(
            ModelProviderService service,
            @ConfigProperty(name = "miot.harness.provider-key") Optional<String> providerKey) {
        this.service = service;
        this.providerKey = providerKey;
    }

    @GET
    public Uni<Response> list(@HeaderParam(KEY_HEADER) String presentedKey) {
        String configured = providerKey.orElse("");
        if (configured.isBlank()) {
            return Uni.createFrom().item(error(Response.Status.SERVICE_UNAVAILABLE,
                    "Model providers are not configured for the harness"));
        }
        if (!DashboardCredentialsResource.keyAccepted(configured, presentedKey)) {
            return Uni.createFrom().item(error(Response.Status.UNAUTHORIZED, "Unauthorized"));
        }
        return Uni.createFrom()
                .item(() -> Response.ok(Map.of("providers", service.forHarness()))
                        .header(HttpHeaders.CACHE_CONTROL, "no-store")
                        .build())
                .runSubscriptionOn(Infrastructure.getDefaultWorkerPool());
    }

    private static Response error(Response.Status status, String message) {
        return Response.status(status)
                .type(MediaType.APPLICATION_JSON)
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .entity(Map.of("error", message))
                .build();
    }
}
