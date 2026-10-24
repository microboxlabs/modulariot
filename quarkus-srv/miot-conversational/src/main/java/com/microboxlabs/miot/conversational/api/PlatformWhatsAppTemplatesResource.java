package com.microboxlabs.miot.conversational.api;

import static com.microboxlabs.miot.conversational.api.OrgConversationsResource.work;

import com.microboxlabs.miot.conversational.service.WhatsAppTemplateDraft;
import com.microboxlabs.miot.conversational.service.WhatsAppTemplatesService;
import com.microboxlabs.miot.core.auth.PlatformAuthorizer;
import com.microboxlabs.miot.integrations.email.PlatformMailService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.function.Supplier;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * The WhatsApp templates on Meta of the platform's WhatsApp connection, the account the platform lends the
 * organizations. Read and written live against Meta. Only platform owners call this API.
 */
@Path("/api/v1/platform/whatsapp-templates")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Platform — WhatsApp templates", description = "Templates on the platform's WhatsApp Business account")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class PlatformWhatsAppTemplatesResource {

    /** The reserved tenant of the platform's connections; no organization can take a tenant code starting with "_". */
    private static final String PLATFORM = PlatformMailService.PLATFORM_TENANT;
    private static final String ID = "id";

    private final Supplier<Uni<String>> owner;
    private final WhatsAppTemplatesService templates;

    @Inject
    public PlatformWhatsAppTemplatesResource(PlatformAuthorizer authorizer, WhatsAppTemplatesService templates) {
        this(authorizer::requirePlatformOwner, templates);
    }

    /** {@code owner} yields the platform owner calling, or fails for anyone else. */
    public PlatformWhatsAppTemplatesResource(Supplier<Uni<String>> owner, WhatsAppTemplatesService templates) {
        this.owner = owner;
        this.templates = templates;
    }

    @GET
    @Operation(operationId = "listPlatformWhatsAppTemplates",
            summary = "The templates on the WABA of the platform's WhatsApp connection, with their status")
    public Uni<Response> list() {
        return owner(() -> Response.ok(templates.list(PLATFORM)).build());
    }

    @POST
    @Operation(operationId = "createPlatformWhatsAppTemplate", summary = "Submit a new template to Meta for review")
    public Uni<Response> create(WhatsAppTemplateDraft body) {
        return owner(() -> Response.status(Response.Status.CREATED).entity(templates.create(PLATFORM, body)).build());
    }

    @PUT
    @Path("/{id}")
    @Operation(operationId = "editPlatformWhatsAppTemplate",
            summary = "Change a template's category or components; Meta reviews it again")
    public Uni<Response> edit(@PathParam(ID) String id, WhatsAppTemplateDraft body) {
        return owner(() -> Response.ok(templates.edit(PLATFORM, id, body)).build());
    }

    @DELETE
    @Path("/{name}")
    @Operation(operationId = "deletePlatformWhatsAppTemplate",
            summary = "Delete a template by name, in every language, or only the one with the given id")
    public Uni<Response> delete(@PathParam("name") String name, @QueryParam(ID) String id) {
        return owner(() -> {
            templates.delete(PLATFORM, name, id == null || id.isBlank() ? null : id.trim());
            return Response.noContent().build();
        });
    }

    private Uni<Response> owner(Supplier<Response> call) {
        return owner.get().flatMap(actor -> work(call));
    }
}
