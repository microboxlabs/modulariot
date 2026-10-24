package com.microboxlabs.miot.conversational.api;

import static com.microboxlabs.miot.conversational.api.OrgConversationsResource.work;

import com.microboxlabs.miot.conversational.rules.TemplatesService;
import com.microboxlabs.miot.conversational.rules.TemplatesService.TemplateRequest;
import com.microboxlabs.miot.core.auth.PlatformAuthorizer;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.function.Function;
import java.util.function.Supplier;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * The platform's message templates, which every organization's rules use. Only platform owners call this API;
 * organizations read the templates through their conversations API.
 */
@Path("/api/v1/platform/message-templates")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Platform — Message templates", description = "Templates every organization's rules send")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class PlatformMessageTemplatesResource {

    private static final String KEY = "key";

    private final PlatformAuthorizer authorizer;
    private final TemplatesService templates;

    @Inject
    public PlatformMessageTemplatesResource(PlatformAuthorizer authorizer, TemplatesService templates) {
        this.authorizer = authorizer;
        this.templates = templates;
    }

    @GET
    @Operation(operationId = "listPlatformMessageTemplates",
            summary = "Every template, with every organization's rules that use it")
    public Uni<Response> list() {
        return owner(actor -> () -> Response.ok(templates.platformList()).build());
    }

    @GET
    @Path("/{key}")
    @Operation(operationId = "getPlatformMessageTemplate", summary = "One template, with the rules that use it")
    public Uni<Response> get(@PathParam(KEY) String key) {
        return owner(actor -> () -> Response.ok(templates.platformGet(key)).build());
    }

    @PUT
    @Path("/{key}")
    @Operation(operationId = "savePlatformMessageTemplate",
            summary = "Create or replace a template; its semantic version rises by what changed")
    public Uni<Response> save(@PathParam(KEY) String key, TemplateRequest body) {
        return owner(actor -> () -> Response.ok(templates.save(key, body, actor)).build());
    }

    /** Runs the call for a platform owner, who is its actor; anyone else gets 403. */
    private Uni<Response> owner(Function<String, Supplier<Response>> call) {
        return authorizer.requirePlatformOwner().flatMap(actor -> work(call.apply(actor)));
    }
}
