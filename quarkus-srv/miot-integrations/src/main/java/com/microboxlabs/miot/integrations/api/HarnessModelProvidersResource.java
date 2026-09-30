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
    public Uni<Response> list(@HeaderParam(HarnessKey.HEADER) String presentedKey) {
        Optional<Response> refused = HarnessKey.refusal(providerKey, presentedKey);
        if (refused.isPresent()) {
            return Uni.createFrom().item(refused.get());
        }
        return Uni.createFrom()
                .item(() -> Response.ok(Map.of("providers", service.forHarness()))
                        .header(HttpHeaders.CACHE_CONTROL, "no-store")
                        .build())
                .runSubscriptionOn(Infrastructure.getDefaultWorkerPool());
    }
}
