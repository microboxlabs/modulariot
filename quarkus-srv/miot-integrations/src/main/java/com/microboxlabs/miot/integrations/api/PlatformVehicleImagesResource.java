package com.microboxlabs.miot.integrations.api;

import com.microboxlabs.miot.core.auth.PlatformAuthorizer;
import com.microboxlabs.miot.integrations.vehicleimages.PlatformVehicleImagesService;
import com.microboxlabs.miot.integrations.vehicleimages.PlatformVehicleImagesService.PlatformVehicleImagesView;
import com.microboxlabs.miot.integrations.vehicleimages.PlatformVehicleImagesService.SetPlatformVehicleImagesRequest;
import io.quarkus.arc.properties.IfBuildProperty;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * The platform's vehicle image provider, used by organizations without their own. Only a platform owner reads or
 * changes it. The API secret is write-only: responses carry a preview.
 */
@Path("/api/v1/platform/vehicle-images")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Platform Vehicle Images", description = "The platform's vehicle image provider")
@SecurityRequirement(name = "oidc")
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class PlatformVehicleImagesResource {

    private final PlatformVehicleImagesService service;
    private final PlatformSettingEndpoints endpoints;

    @Inject
    public PlatformVehicleImagesResource(PlatformVehicleImagesService service, PlatformAuthorizer authorizer) {
        this.service = service;
        this.endpoints = new PlatformSettingEndpoints(authorizer, "No platform vehicle image provider");
    }

    @GET
    @Operation(summary = "Get the platform vehicle image provider")
    public Uni<PlatformVehicleImagesView> get() {
        return endpoints.get(service::get);
    }

    @PUT
    @Operation(summary = "Set the platform vehicle image provider",
            description = "The API secret is required the first time; leave it blank to keep the stored secret.")
    public Uni<Response> put(SetPlatformVehicleImagesRequest body) {
        return endpoints.put(actor -> service.put(body, actor));
    }

    @DELETE
    @Operation(summary = "Remove the platform vehicle image provider and its secret")
    public Uni<Response> delete() {
        return endpoints.delete(service::delete);
    }

    @POST
    @Path("/test")
    @Consumes(MediaType.WILDCARD)
    @Operation(summary = "Check the platform key and secret with carimagesapi.com")
    public Uni<Response> test() {
        return endpoints.test(service::test);
    }
}
