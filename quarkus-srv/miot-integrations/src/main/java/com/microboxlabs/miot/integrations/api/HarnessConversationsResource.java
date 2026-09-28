package com.microboxlabs.miot.integrations.api;

import com.microboxlabs.miot.integrations.dto.HarnessConversationDtos.ConversationMemory;
import com.microboxlabs.miot.integrations.service.HarnessConversationService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * Where the harness saves and loads its memory of each conversation, so a
 * restart does not lose it. Authenticated like {@link HarnessModelProvidersResource}.
 */
@Path(HarnessConversationsResource.PATH)
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Harness", description = "Conversation memory from the harness")
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class HarnessConversationsResource {

    /** Matches the permit rule in {@code application.properties}. */
    static final String PATH = "/internal/harness-conversations";

    private final HarnessConversationService service;
    private final Optional<String> providerKey;

    @Inject
    public HarnessConversationsResource(
            HarnessConversationService service,
            @ConfigProperty(name = "miot.harness.provider-key") Optional<String> providerKey) {
        this.service = service;
        this.providerKey = providerKey;
    }

    @GET
    public Uni<Response> load(@HeaderParam(HarnessKey.HEADER) String presentedKey, @QueryParam("key") String key) {
        return guarded(presentedKey, () -> service.load(key)
                .map(memory -> Response.ok(memory).build())
                .orElseGet(() -> HarnessKey.error(Response.Status.NOT_FOUND, "no memory for this conversation")));
    }

    @PUT
    public Uni<Response> save(@HeaderParam(HarnessKey.HEADER) String presentedKey, ConversationMemory body) {
        return guarded(presentedKey, () -> service.save(body)
                ? Response.ok(Map.of("stored", true)).build()
                : HarnessKey.error(Response.Status.CONFLICT, "the key belongs to another tenant"));
    }

    private Uni<Response> guarded(String presentedKey, Supplier<Response> work) {
        Optional<Response> refused = HarnessKey.refusal(providerKey, presentedKey);
        if (refused.isPresent()) {
            return Uni.createFrom().item(refused.get());
        }
        return Uni.createFrom()
                .item(() -> {
                    try {
                        return work.get();
                    } catch (IllegalArgumentException e) {
                        return HarnessKey.error(Response.Status.BAD_REQUEST, e.getMessage());
                    }
                })
                .runSubscriptionOn(Infrastructure.getDefaultWorkerPool());
    }
}
