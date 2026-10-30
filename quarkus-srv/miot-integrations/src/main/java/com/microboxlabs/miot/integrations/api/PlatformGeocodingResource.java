package com.microboxlabs.miot.integrations.api;

import com.microboxlabs.miot.core.auth.PlatformAuthorizer;
import com.microboxlabs.miot.integrations.geocoding.PlatformGeocodingService;
import com.microboxlabs.miot.integrations.geocoding.PlatformGeocodingService.PlatformGeocodingView;
import com.microboxlabs.miot.integrations.geocoding.PlatformGeocodingService.SetPlatformGeocodingRequest;
import io.quarkus.arc.properties.IfBuildProperty;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * The geocoding provider the platform contracts for every organization. Only a platform owner reads or changes it.
 * Responses identify the linked credential without exposing its token.
 */
@Path("/api/v1/platform/geocoding-provider")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Platform Geocoding Provider", description = "The platform's geocoding provider")
@SecurityRequirement(name = "oidc")
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class PlatformGeocodingResource {

    private final PlatformGeocodingService service;
    private final PlatformSettingEndpoints endpoints;

    @Inject
    public PlatformGeocodingResource(PlatformGeocodingService service, PlatformAuthorizer authorizer) {
        this.service = service;
        this.endpoints = new PlatformSettingEndpoints(authorizer, "No platform geocoding provider");
    }

    @GET
    @Operation(summary = "Get the platform geocoding provider")
    public Uni<PlatformGeocodingView> get() {
        return endpoints.get(service::get);
    }

    @PUT
    @Operation(summary = "Set the platform geocoding provider",
            description = "credentialProfileId is required the first time; omit it to keep the linked credential."
                    + " costPerRequestUsd is the platform's cost of one call.")
    public Uni<Response> put(SetPlatformGeocodingRequest body) {
        return endpoints.put(ignored -> service.put(body));
    }

    @DELETE
    @Operation(summary = "Remove the platform geocoding provider, keeping its credential")
    public Uni<Response> delete() {
        return endpoints.delete(ignored -> service.delete());
    }
}
