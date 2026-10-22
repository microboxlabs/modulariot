package com.microboxlabs.miot.symptoms.api;

import static com.microboxlabs.miot.symptoms.catalog.domain.SymptomTemplate.PLATFORM_TENANT;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.PlatformAuthorizer;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.symptoms.api.OrgSymptomDefinitionsResource.DescribeRequest;
import com.microboxlabs.miot.symptoms.api.OrgSymptomDefinitionsResource.ForkRequest;
import com.microboxlabs.miot.symptoms.api.OrgSymptomDefinitionsResource.PublishRequest;
import com.microboxlabs.miot.symptoms.api.OrgSymptomDefinitionsResource.RollbackRequest;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.service.DataSourceService;
import com.microboxlabs.miot.symptoms.catalog.service.PreviewService;
import com.microboxlabs.miot.symptoms.catalog.service.RuleDescriptionService;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService.CreateRequest;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService.IdentityRequest;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Supplier;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * The platform's symptom templates, edited like an organization's symptoms: drafts, checks, versions. Templates
 * are always off. Organizations list the published ones and copy them. Only platform owners call this API.
 */
@Path("/api/v1/platform/symptom-templates")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Platform — Symptom templates", description = "Templates organizations create their symptoms from")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class PlatformSymptomTemplatesResource extends ControlTowerResourceSupport {

    private static final String ID = "id";

    private final PlatformAuthorizer authorizer;
    private final SymptomCatalogService catalog;
    private final PreviewService previews;
    private final RuleDescriptionService descriptions;
    private final DataSourceService sources;

    @Inject
    public PlatformSymptomTemplatesResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity,
            PlatformAuthorizer authorizer,
            SymptomCatalogService catalog,
            PreviewService previews,
            RuleDescriptionService descriptions,
            DataSourceService sources) {
        super(tenantContext, organizationContext, roleService, identity);
        this.authorizer = authorizer;
        this.catalog = catalog;
        this.previews = previews;
        this.descriptions = descriptions;
        this.sources = sources;
    }

    @GET
    @Operation(operationId = "listSymptomTemplatesForEditing", summary = "Every template, published or not")
    public Uni<Response> list() {
        return owner(actor -> () -> Response.ok(descriptions.withActivationTexts(catalog.list(PLATFORM_TENANT)))
                .build());
    }

    @POST
    @Operation(operationId = "createSymptomTemplate", summary = "Create a template with a first draft")
    public Uni<Response> create(CreateRequest body) {
        return owner(actor -> () -> Response.status(Response.Status.CREATED)
                .entity(catalog.create(PLATFORM_TENANT, actor, body)).build());
    }

    @GET
    @Path("/data-sources")
    @Operation(operationId = "listTemplateDataSources", summary = "The platform data sources templates can read")
    public Uni<Response> dataSources() {
        return owner(actor -> () -> Response.ok(sources.list(PLATFORM_TENANT)).build());
    }

    @GET
    @Path("/data-sources/{key}")
    @Operation(operationId = "getTemplateDataSource", summary = "A platform data source with its fields and samples")
    public Uni<Response> dataSource(@PathParam("key") String key) {
        return owner(actor -> () -> Response.ok(sources.get(PLATFORM_TENANT, key)).build());
    }

    @POST
    @Path("/describe")
    @Operation(operationId = "describeTemplateRule",
            summary = "A short plain-language description of one rule, as for an organization's symptom")
    public Uni<Response> describe(@HeaderParam("Authorization") String authorization, DescribeRequest body) {
        RuleDescriptionService.Caller caller = harnessCaller(authorization);
        return owner(actor -> () -> {
            if (body == null) {
                throw new IllegalArgumentException("section, rule and sourceKey are required");
            }
            return Response.ok(descriptions.describe(PLATFORM_TENANT, body.section(), body.rule(), body.sourceKey(),
                    body.locale(), caller)).build();
        });
    }

    @GET
    @Path("/{id}")
    @Operation(operationId = "getSymptomTemplate", summary = "A template with its version in force, draft and versions")
    public Uni<Response> get(@PathParam(ID) String id) {
        return owner(actor -> () -> Response.ok(catalog.get(PLATFORM_TENANT, uuid(id))).build());
    }

    @PATCH
    @Path("/{id}")
    @Operation(operationId = "updateSymptomTemplateIdentity", summary = "Change name, family, icon or description")
    public Uni<Response> updateIdentity(@PathParam(ID) String id, IdentityRequest body) {
        return owner(actor -> () -> Response.ok(catalog.updateIdentity(PLATFORM_TENANT, actor, uuid(id),
                body == null ? new IdentityRequest(null, null, null, null) : body)).build());
    }

    @PUT
    @Path("/{id}/draft")
    @Operation(operationId = "saveSymptomTemplateDraft", summary = "Save the draft spec; it may still have errors")
    public Uni<Response> saveDraft(@PathParam(ID) String id, SymptomSpec spec) {
        return owner(actor -> () -> Response.ok(catalog.saveDraft(PLATFORM_TENANT, actor, uuid(id), spec)).build());
    }

    @DELETE
    @Path("/{id}/draft")
    @Operation(operationId = "discardSymptomTemplateDraft", summary = "Discard the draft")
    public Uni<Response> discardDraft(@PathParam(ID) String id) {
        return owner(actor -> () -> {
            catalog.discardDraft(PLATFORM_TENANT, actor, uuid(id));
            return Response.noContent().build();
        });
    }

    @POST
    @Path("/{id}/validate")
    @Operation(operationId = "validateSymptomTemplateSpec",
            summary = "Check a spec, or the draft when the body is empty")
    public Uni<Response> validate(@PathParam(ID) String id, SymptomSpec spec) {
        return owner(actor -> () -> Response.ok(catalog.validate(PLATFORM_TENANT, uuid(id), spec)).build());
    }

    @POST
    @Path("/{id}/preview")
    @Operation(operationId = "previewSymptomTemplateSpec",
            summary = "Run a spec, or the draft, on the source's samples")
    public Uni<Response> preview(@PathParam(ID) String id, SymptomSpec spec) {
        return owner(actor -> () -> Response.ok(previews.preview(PLATFORM_TENANT, uuid(id), spec)).build());
    }

    @GET
    @Path("/{id}/publish-plan")
    @Operation(operationId = "planSymptomTemplatePublish",
            summary = "What publishing the draft would do: changes, bump, next version and checks")
    public Uni<Response> plan(@PathParam(ID) String id) {
        return owner(actor -> () -> Response.ok(catalog.plan(PLATFORM_TENANT, uuid(id))).build());
    }

    @POST
    @Path("/{id}/publish")
    @Operation(operationId = "publishSymptomTemplateDraft",
            summary = "Publish the draft as a new version, which organizations copy from then on")
    public Uni<Response> publish(@PathParam(ID) String id, PublishRequest body) {
        PublishRequest req = body == null ? new PublishRequest(null, null, null) : body;
        return owner(actor -> () -> Response.ok(
                catalog.publish(PLATFORM_TENANT, actor, uuid(id), req.reason(), req.bump(), null)).build());
    }

    @POST
    @Path("/{id}/rollback")
    @Operation(operationId = "rollbackSymptomTemplate", summary = "Publish an earlier version's spec as a new version")
    public Uni<Response> rollback(@PathParam(ID) String id, RollbackRequest body) {
        return owner(actor -> () -> {
            if (body == null || body.version() == null) {
                throw new IllegalArgumentException("version is required");
            }
            return Response.ok(catalog.rollback(PLATFORM_TENANT, actor, uuid(id), body.version(), body.reason()))
                    .build();
        });
    }

    @POST
    @Path("/{id}/fork")
    @Operation(operationId = "forkSymptomTemplate", summary = "Create a new template from a version of this one")
    public Uni<Response> fork(@PathParam(ID) String id, ForkRequest body) {
        return owner(actor -> () -> {
            if (body == null) {
                throw new IllegalArgumentException("key and name are required");
            }
            return Response.status(Response.Status.CREATED).entity(catalog.fork(PLATFORM_TENANT, actor, uuid(id),
                    body.version(), body.key(), body.name())).build();
        });
    }

    @GET
    @Path("/{id}/compare")
    @Operation(operationId = "compareSymptomTemplateVersions", summary = "Differences between two published versions")
    public Uni<Response> compare(@PathParam(ID) String id, @QueryParam("from") String from,
            @QueryParam("to") String to) {
        return owner(actor -> () -> {
            if (from == null || to == null) {
                throw new IllegalArgumentException("from and to are required");
            }
            return Response.ok(catalog.compare(PLATFORM_TENANT, uuid(id), from, to)).build();
        });
    }

    /** Runs the call for a platform owner, who is its actor; anyone else gets 403. */
    private Uni<Response> owner(Function<String, Supplier<Response>> call) {
        return authorizer.requirePlatformOwner().flatMap(actor -> work(call.apply(actor)));
    }

    private static UUID uuid(String raw) {
        try {
            return UUID.fromString(raw);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("id must be a UUID");
        }
    }
}
