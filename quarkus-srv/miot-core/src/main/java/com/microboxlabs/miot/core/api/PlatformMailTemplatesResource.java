package com.microboxlabs.miot.core.api;

import com.microboxlabs.miot.core.auth.PlatformAuthorizer;
import com.microboxlabs.miot.core.mail.MailTemplates;
import com.microboxlabs.miot.core.mail.MailTemplates.SaveTemplateRequest;
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
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.NoSuchElementException;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * The platform's email templates, used by organizations without their own. Only a platform owner reads or changes
 * them. Errors: 400 a template that does not render or lacks {@code {{link}}}, 403, 404.
 */
@Path("/api/v1/platform/mail-templates/{kind}/{lang}")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Platform Mail Templates", description = "The platform's email templates")
@SecurityRequirement(name = "oidc")
public class PlatformMailTemplatesResource {

    private final MailTemplates templates;
    private final PlatformAuthorizer authorizer;

    @Inject
    public PlatformMailTemplatesResource(MailTemplates templates, PlatformAuthorizer authorizer) {
        this.templates = templates;
        this.authorizer = authorizer;
    }

    @GET
    @Operation(summary = "The platform's template, or the built-in one")
    public Uni<Response> get(@PathParam("kind") String kind, @PathParam("lang") String lang) {
        return authorizer.requirePlatformOwner()
                .flatMap(ignored -> IamResponses.ok(() -> templates.get(null, kind, lang)));
    }

    @PUT
    @Operation(summary = "Set the platform's template")
    public Uni<Response> put(@PathParam("kind") String kind, @PathParam("lang") String lang,
            SaveTemplateRequest body) {
        return authorizer.requirePlatformOwner()
                .flatMap(actor -> IamResponses.ok(() -> templates.put(null, kind, lang, body, actor)));
    }

    @DELETE
    @Operation(summary = "Remove the platform's template, going back to the built-in one")
    public Uni<Response> delete(@PathParam("kind") String kind, @PathParam("lang") String lang) {
        return authorizer.requirePlatformOwner()
                .flatMap(ignored -> IamResponses.respond(() -> templates.delete(null, kind, lang).map(deleted -> {
                    if (!Boolean.TRUE.equals(deleted)) {
                        throw new NoSuchElementException("The platform has no template of its own");
                    }
                    return null;
                }), Response.Status.NO_CONTENT));
    }

    @POST
    @Path("/preview")
    @Operation(summary = "Render an unsaved template with sample values")
    public Uni<Response> preview(@PathParam("kind") String kind, @PathParam("lang") String lang,
            SaveTemplateRequest body) {
        return authorizer.requirePlatformOwner()
                .flatMap(ignored -> IamResponses.ok(() -> Uni.createFrom()
                        .item(() -> templates.preview(kind, lang, body, null))));
    }
}
