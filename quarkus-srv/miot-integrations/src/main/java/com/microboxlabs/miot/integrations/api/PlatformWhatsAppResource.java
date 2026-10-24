package com.microboxlabs.miot.integrations.api;

import com.microboxlabs.miot.core.auth.PlatformAuthorizer;
import com.microboxlabs.miot.integrations.whatsapp.PlatformWhatsAppService;
import com.microboxlabs.miot.integrations.whatsapp.PlatformWhatsAppService.PlatformWhatsAppView;
import com.microboxlabs.miot.integrations.whatsapp.PlatformWhatsAppService.SetPlatformWhatsAppRequest;
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
 * The platform's WhatsApp account, which sends the rule messages of every organization. Only a platform owner
 * reads or changes it. The access token is write-only: responses carry a preview.
 */
@Path("/api/v1/platform/whatsapp")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Platform WhatsApp", description = "The platform's WhatsApp account")
@SecurityRequirement(name = "oidc")
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class PlatformWhatsAppResource {

    private final PlatformWhatsAppService service;
    private final PlatformSettingEndpoints endpoints;

    @Inject
    public PlatformWhatsAppResource(PlatformWhatsAppService service, PlatformAuthorizer authorizer) {
        this.service = service;
        this.endpoints = new PlatformSettingEndpoints(authorizer, "No platform WhatsApp account");
    }

    @GET
    @Operation(summary = "Get the platform WhatsApp account")
    public Uni<PlatformWhatsAppView> get() {
        return endpoints.get(service::get);
    }

    @PUT
    @Operation(summary = "Set the platform WhatsApp account",
            description = "The access token is required the first time; leave it blank to keep the stored token.")
    public Uni<Response> put(SetPlatformWhatsAppRequest body) {
        return endpoints.put(actor -> service.put(body, actor));
    }

    @DELETE
    @Operation(summary = "Remove the platform WhatsApp account and its token")
    public Uni<Response> delete() {
        return endpoints.delete(service::delete);
    }

    @POST
    @Path("/test")
    @Consumes(MediaType.WILDCARD)
    @Operation(summary = "Check the platform account's token and phone number id with Meta")
    public Uni<Response> test() {
        return endpoints.test(service::test);
    }
}
