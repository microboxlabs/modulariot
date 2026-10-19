package com.microboxlabs.miot.integrations.api;

import com.microboxlabs.miot.core.auth.PlatformAuthorizer;
import com.microboxlabs.miot.integrations.service.ModelUsageService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.Map;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** Model token usage and its cost per organization, for the platform owner. */
@Path("/api/v1/platform/model-usage")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "Platform Model Usage", description = "Tokens used per organization and model")
@SecurityRequirement(name = "oidc")
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class PlatformModelUsageResource {

    private final ModelUsageService service;
    private final PlatformAuthorizer authorizer;

    @Inject
    public PlatformModelUsageResource(ModelUsageService service, PlatformAuthorizer authorizer) {
        this.service = service;
        this.authorizer = authorizer;
    }

    @GET
    @Operation(summary = "Token usage per organization and model",
            description = "from and to are ISO-8601 timestamps with an offset; to is exclusive."
                    + " organization narrows the result to one organization slug.")
    public Uni<Response> totals(
            @QueryParam("from") String from,
            @QueryParam("to") String to,
            @QueryParam("organization") String organization) {
        return authorizer.requirePlatformOwner().flatMap(ignored -> Uni.createFrom()
                .item(() -> {
                    try {
                        return Response.ok(Map.of("totals",
                                service.totals(parse(from), parse(to), organization))).build();
                    } catch (IllegalArgumentException | DateTimeParseException e) {
                        return Response.status(Response.Status.BAD_REQUEST)
                                .type(MediaType.APPLICATION_JSON)
                                .entity(Map.of("error", e.getMessage()))
                                .build();
                    }
                })
                .runSubscriptionOn(Infrastructure.getDefaultWorkerPool()));
    }

    private static OffsetDateTime parse(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("from and to are required");
        }
        return OffsetDateTime.parse(value.strip());
    }
}
