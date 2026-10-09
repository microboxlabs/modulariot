package com.microboxlabs.miot.core.api;

import com.microboxlabs.miot.core.iam.AccessEvaluator;
import com.microboxlabs.miot.core.iam.CoreAccessCatalog;
import com.microboxlabs.miot.core.iam.IamIdentityAugmentor;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.core.mail.MailTemplates;
import com.microboxlabs.miot.core.mail.MailTemplates.SaveTemplateRequest;
import com.microboxlabs.miot.core.model.Organization;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.quarkus.security.Authenticated;
import io.quarkus.security.PermissionsAllowed;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.NoSuchElementException;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * The organization's own email templates, which replace the platform's. Only a top-level organization has them;
 * its sub-accounts use the same. Errors: 400 a template that does not render or lacks {@code {{link}}}, 403, 404,
 * 409 a sub-account.
 */
@Path("/api/v1/orgs/{organizationId}/mail-templates/{kind}/{lang}")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Mail Templates", description = "The organization's email templates")
@SecurityRequirement(name = "oidc")
@Authenticated
public class OrgMailTemplatesResource {

    private static final String ORG = "organizationId";

    private final MailTemplates templates;
    private final AccessEvaluator evaluator;
    private final SecurityIdentity identity;
    private final List<String> clientIdClaims;

    @Inject
    public OrgMailTemplatesResource(MailTemplates templates, AccessEvaluator evaluator, SecurityIdentity identity,
            @ConfigProperty(name = "miot.auth.client-id-claims", defaultValue = "aud,azp")
            List<String> clientIdClaims) {
        this.templates = templates;
        this.evaluator = evaluator;
        this.identity = identity;
        this.clientIdClaims = clientIdClaims;
    }

    @GET
    @Operation(operationId = "getMailTemplate",
            summary = "The template the organization uses: its own, the platform's or the built-in one")
    @PermissionsAllowed(value = CoreAccessCatalog.ORG_UPDATE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> get(@PathParam(ORG) String organizationId, @PathParam("kind") String kind,
            @PathParam("lang") String lang) {
        return IamResponses.ok(() -> topLevel(organizationId).flatMap(root -> templates.get(root.id, kind, lang)));
    }

    @PUT
    @Operation(operationId = "setMailTemplate", summary = "Set the organization's own template")
    @PermissionsAllowed(value = CoreAccessCatalog.ORG_UPDATE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> put(@PathParam(ORG) String organizationId, @PathParam("kind") String kind,
            @PathParam("lang") String lang, @HeaderParam(IamIdentityAugmentor.DEV_EMAIL_HEADER) String devEmail,
            SaveTemplateRequest body) {
        String actor = IamIdentityAugmentor.callerOf(identity, devEmail, clientIdClaims).name();
        return IamResponses.ok(() -> topLevel(organizationId)
                .flatMap(root -> templates.put(root.id, kind, lang, body, actor)));
    }

    @DELETE
    @Operation(operationId = "resetMailTemplate", summary = "Remove the organization's own template")
    @PermissionsAllowed(value = CoreAccessCatalog.ORG_UPDATE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> delete(@PathParam(ORG) String organizationId, @PathParam("kind") String kind,
            @PathParam("lang") String lang) {
        return IamResponses.respond(() -> topLevel(organizationId)
                .flatMap(root -> templates.delete(root.id, kind, lang))
                .map(deleted -> {
                    if (!Boolean.TRUE.equals(deleted)) {
                        throw new NoSuchElementException("The organization has no template of its own");
                    }
                    return null;
                }), Response.Status.NO_CONTENT);
    }

    @POST
    @Path("/preview")
    @Operation(operationId = "previewMailTemplate", summary = "Render an unsaved template with sample values")
    @PermissionsAllowed(value = CoreAccessCatalog.ORG_UPDATE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> preview(@PathParam(ORG) String organizationId, @PathParam("kind") String kind,
            @PathParam("lang") String lang, SaveTemplateRequest body) {
        return IamResponses.ok(() -> topLevel(organizationId)
                .map(root -> templates.preview(kind, lang, body, root.name)));
    }

    private Uni<Organization> root(String slug) {
        return Panache.withSession(() -> Organization.findBySlug(slug).flatMap(org -> {
            if (org == null) {
                throw new NoSuchElementException("Organization not found: " + slug);
            }
            return evaluator.root(org);
        }));
    }

    /** Sub-accounts send their parent's invitations, so only the parent has templates. */
    private Uni<Organization> topLevel(String slug) {
        return root(slug).map(root -> {
            if (!root.slug.equalsIgnoreCase(slug)) {
                throw new IllegalStateException("Set the template on the parent organization");
            }
            return root;
        });
    }
}
