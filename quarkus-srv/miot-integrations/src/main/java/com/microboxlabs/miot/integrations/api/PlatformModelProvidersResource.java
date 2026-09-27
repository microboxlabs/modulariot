package com.microboxlabs.miot.integrations.api;

import com.microboxlabs.miot.core.auth.PlatformAuthorizer;
import com.microboxlabs.miot.integrations.dto.ModelProviderDtos.ModelProviderResponse;
import com.microboxlabs.miot.integrations.dto.ModelProviderDtos.SetModelProviderRequest;
import com.microboxlabs.miot.integrations.service.ModelProviderService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * The AI model providers the harness calls, platform-wide. Only a platform
 * owner reads or changes them; tenants use every enabled model and are charged
 * per token. API keys are write-only: responses carry a preview.
 */
@Path("/api/v1/platform/model-providers")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Platform Model Providers", description = "AI model providers and their keys")
@SecurityRequirement(name = "oidc")
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class PlatformModelProvidersResource {

    private final ModelProviderService service;
    private final PlatformAuthorizer authorizer;

    @Inject
    public PlatformModelProvidersResource(ModelProviderService service, PlatformAuthorizer authorizer) {
        this.service = service;
        this.authorizer = authorizer;
    }

    @GET
    @Operation(summary = "List the model providers")
    public Uni<List<ModelProviderResponse>> list() {
        return authorizer.requirePlatformOwner().flatMap(ignored -> onWorker(service::list));
    }

    @PUT
    @Path("/{provider}")
    @Operation(summary = "Create or replace a model provider",
            description = "Known providers: anthropic, openai, openrouter, deepseek, qwen, kimi, glm."
                    + " Leave apiKey blank to keep the stored key.")
    public Uni<Response> put(@PathParam("provider") String provider, SetModelProviderRequest body) {
        return authorizer.requirePlatformOwner().flatMap(actor -> onWorker(() -> {
            try {
                return Response.ok(service.put(provider, body, actor)).build();
            } catch (IllegalArgumentException e) {
                return error(Response.Status.BAD_REQUEST, e.getMessage());
            }
        }));
    }

    @DELETE
    @Path("/{provider}")
    @Operation(summary = "Remove a model provider and its key")
    public Uni<Response> delete(@PathParam("provider") String provider) {
        return authorizer.requirePlatformOwner().flatMap(ignored -> onWorker(() -> service.delete(provider)
                ? Response.noContent().build()
                : error(Response.Status.NOT_FOUND, "no such provider")));
    }

    private static Response error(Response.Status status, String message) {
        return Response.status(status).type(MediaType.APPLICATION_JSON).entity(Map.of("error", message)).build();
    }

    private static <T> Uni<T> onWorker(Supplier<T> work) {
        return Uni.createFrom().item(work).runSubscriptionOn(Infrastructure.getDefaultWorkerPool());
    }
}
