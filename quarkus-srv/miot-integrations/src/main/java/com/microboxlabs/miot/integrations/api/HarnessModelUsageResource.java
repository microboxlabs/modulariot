package com.microboxlabs.miot.integrations.api;

import com.microboxlabs.miot.integrations.dto.ModelUsageDtos.RecordUsageRequest;
import com.microboxlabs.miot.integrations.service.ModelUsageService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import java.util.Optional;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * Where the harness reports the tokens a run used. Authenticated like
 * {@link HarnessModelProvidersResource}. A repeated report for the same run and
 * model is ignored.
 */
@Path(HarnessModelUsageResource.PATH)
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Harness", description = "Model token usage from the harness")
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class HarnessModelUsageResource {

    /** Matches the permit rule in {@code application.properties}. */
    static final String PATH = "/internal/model-usage";

    private final ModelUsageService service;
    private final Optional<String> providerKey;

    @Inject
    public HarnessModelUsageResource(
            ModelUsageService service,
            @ConfigProperty(name = "miot.harness.provider-key") Optional<String> providerKey) {
        this.service = service;
        this.providerKey = providerKey;
    }

    @POST
    public Uni<Response> record(@HeaderParam(HarnessKey.HEADER) String presentedKey, RecordUsageRequest body) {
        Optional<Response> refused = HarnessKey.refusal(providerKey, presentedKey);
        if (refused.isPresent()) {
            return Uni.createFrom().item(refused.get());
        }
        return Uni.createFrom()
                .item(() -> {
                    try {
                        return Response.ok(Map.of("stored", service.record(body))).build();
                    } catch (IllegalArgumentException e) {
                        return HarnessKey.error(Response.Status.BAD_REQUEST, e.getMessage());
                    }
                })
                .runSubscriptionOn(Infrastructure.getDefaultWorkerPool());
    }
}
