package com.microboxlabs.miot.symptoms.api;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.domain.VersionBump;
import com.microboxlabs.miot.symptoms.catalog.service.PreviewService;
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
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * The organization's symptoms: what each one detects, at which levels, and
 * its version history. Members read; owners edit drafts, publish, roll back,
 * duplicate and turn symptoms on or off.
 */
@Path("/api/v1/orgs/{organizationId}/control-tower/symptom-definitions")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Control Tower — Symptom definitions",
        description = "Symptom rules in CEL, drafts, validation and semantic versions")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class OrgSymptomDefinitionsResource extends ControlTowerResourceSupport {

    private static final String ORG = "organizationId";
    private static final String ID = "id";

    private final SymptomCatalogService catalog;
    private final PreviewService previews;

    /** Publishes the draft. {@code bump} may raise the computed bump; {@code state} defaults to TEST. */
    public record PublishRequest(String reason, VersionBump bump, SymptomState state) {
    }

    public record RollbackRequest(String version, String reason) {
    }

    public record ForkRequest(String version, String key, String name) {
    }

    public record StateRequest(SymptomState state) {
    }

    @Inject
    public OrgSymptomDefinitionsResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity,
            SymptomCatalogService catalog,
            PreviewService previews) {
        super(tenantContext, organizationContext, roleService, identity);
        this.catalog = catalog;
        this.previews = previews;
    }

    @GET
    @Operation(operationId = "listSymptomDefinitions", summary = "List the organization's symptoms")
    public Uni<Response> list(@PathParam(ORG) String organizationId) {
        String tenant = tenantCode(organizationId);
        return memberWork(() -> Response.ok(catalog.list(tenant)).build());
    }

    @POST
    @Operation(operationId = "createSymptomDefinition", summary = "Create a symptom with a first draft")
    public Uni<Response> create(@PathParam(ORG) String organizationId, CreateRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return ownerWork(organizationId, () -> Response.status(Response.Status.CREATED)
                .entity(catalog.create(tenant, actor, body)).build());
    }

    @GET
    @Path("/{id}")
    @Operation(operationId = "getSymptomDefinition",
            summary = "A symptom with its version in force, its draft and its published versions")
    public Uni<Response> get(@PathParam(ORG) String organizationId, @PathParam(ID) String id) {
        String tenant = tenantCode(organizationId);
        return memberWork(() -> Response.ok(catalog.get(tenant, uuid(id))).build());
    }

    @PATCH
    @Path("/{id}")
    @Operation(operationId = "updateSymptomIdentity", summary = "Change name, family, icon or description")
    public Uni<Response> updateIdentity(@PathParam(ORG) String organizationId, @PathParam(ID) String id,
            IdentityRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return ownerWork(organizationId, () -> Response.ok(catalog.updateIdentity(tenant, actor, uuid(id),
                body == null ? new IdentityRequest(null, null, null, null) : body)).build());
    }

    @PUT
    @Path("/{id}/draft")
    @Operation(operationId = "saveSymptomDraft", summary = "Save the draft spec; it may still have errors")
    public Uni<Response> saveDraft(@PathParam(ORG) String organizationId, @PathParam(ID) String id,
            SymptomSpec spec) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return ownerWork(organizationId,
                () -> Response.ok(catalog.saveDraft(tenant, actor, uuid(id), spec)).build());
    }

    @DELETE
    @Path("/{id}/draft")
    @Operation(operationId = "discardSymptomDraft", summary = "Discard the draft")
    public Uni<Response> discardDraft(@PathParam(ORG) String organizationId, @PathParam(ID) String id) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return ownerWork(organizationId, () -> {
            catalog.discardDraft(tenant, actor, uuid(id));
            return Response.noContent().build();
        });
    }

    @POST
    @Path("/{id}/validate")
    @Operation(operationId = "validateSymptomSpec",
            summary = "Check a spec (or the draft when the body is empty); errors block publishing")
    public Uni<Response> validate(@PathParam(ORG) String organizationId, @PathParam(ID) String id,
            SymptomSpec spec) {
        String tenant = tenantCode(organizationId);
        return memberWork(() -> Response.ok(catalog.validate(tenant, uuid(id), spec)).build());
    }

    @POST
    @Path("/{id}/preview")
    @Operation(operationId = "previewSymptomSpec",
            summary = "Run a spec (or the draft) on the source's samples: activation, measure and level per sample")
    public Uni<Response> preview(@PathParam(ORG) String organizationId, @PathParam(ID) String id,
            SymptomSpec spec) {
        String tenant = tenantCode(organizationId);
        return memberWork(() -> Response.ok(previews.preview(tenant, uuid(id), spec)).build());
    }

    @GET
    @Path("/{id}/publish-plan")
    @Operation(operationId = "planSymptomPublish",
            summary = "What publishing the draft would do: changes, bump, next version and checks")
    public Uni<Response> plan(@PathParam(ORG) String organizationId, @PathParam(ID) String id) {
        String tenant = tenantCode(organizationId);
        return memberWork(() -> Response.ok(catalog.plan(tenant, uuid(id))).build());
    }

    @POST
    @Path("/{id}/publish")
    @Operation(operationId = "publishSymptomDraft", summary = "Publish the draft as a new version")
    public Uni<Response> publish(@PathParam(ORG) String organizationId, @PathParam(ID) String id,
            PublishRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        PublishRequest req = body == null ? new PublishRequest(null, null, null) : body;
        return ownerWork(organizationId, () -> Response.ok(
                catalog.publish(tenant, actor, uuid(id), req.reason(), req.bump(), req.state())).build());
    }

    @POST
    @Path("/{id}/rollback")
    @Operation(operationId = "rollbackSymptom", summary = "Publish an earlier version's spec as a new version")
    public Uni<Response> rollback(@PathParam(ORG) String organizationId, @PathParam(ID) String id,
            RollbackRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return ownerWork(organizationId, () -> {
            if (body == null || body.version() == null) {
                throw new IllegalArgumentException("version is required");
            }
            return Response.ok(catalog.rollback(tenant, actor, uuid(id), body.version(), body.reason())).build();
        });
    }

    @POST
    @Path("/{id}/fork")
    @Operation(operationId = "forkSymptom", summary = "Create a new symptom from a version of this one")
    public Uni<Response> fork(@PathParam(ORG) String organizationId, @PathParam(ID) String id, ForkRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return ownerWork(organizationId, () -> {
            if (body == null) {
                throw new IllegalArgumentException("key and name are required");
            }
            return Response.status(Response.Status.CREATED)
                    .entity(catalog.fork(tenant, actor, uuid(id), body.version(), body.key(), body.name())).build();
        });
    }

    @PUT
    @Path("/{id}/state")
    @Operation(operationId = "setSymptomState", summary = "Turn a symptom OFF, to TEST, or ACTIVE")
    public Uni<Response> setState(@PathParam(ORG) String organizationId, @PathParam(ID) String id,
            StateRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return ownerWork(organizationId, () -> {
            if (body == null || body.state() == null) {
                throw new IllegalArgumentException("state is required");
            }
            return Response.ok(catalog.setState(tenant, actor, uuid(id), body.state())).build();
        });
    }

    @GET
    @Path("/{id}/compare")
    @Operation(operationId = "compareSymptomVersions", summary = "Differences between two published versions")
    public Uni<Response> compare(@PathParam(ORG) String organizationId, @PathParam(ID) String id,
            @QueryParam("from") String from, @QueryParam("to") String to) {
        String tenant = tenantCode(organizationId);
        return memberWork(() -> {
            if (from == null || to == null) {
                throw new IllegalArgumentException("from and to are required");
            }
            return Response.ok(catalog.compare(tenant, uuid(id), from, to)).build();
        });
    }

    private static UUID uuid(String raw) {
        try {
            return UUID.fromString(raw);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("id must be a UUID");
        }
    }
}
