package com.microboxlabs.miot.conversational.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.microboxlabs.miot.conversational.client.MetaGraphException;
import com.microboxlabs.miot.conversational.rules.Rule;
import com.microboxlabs.miot.conversational.rules.RuleBump;
import com.microboxlabs.miot.conversational.rules.Run;
import com.microboxlabs.miot.conversational.rules.RulesService;
import com.microboxlabs.miot.conversational.rules.RuleSimulator;
import com.microboxlabs.miot.conversational.rules.RuleSimulator.SampleEvent;
import com.microboxlabs.miot.conversational.rules.RunsService;
import com.microboxlabs.miot.conversational.rules.TemplatesService;
import com.microboxlabs.miot.core.auth.OrganizationAccess;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.iam.Access;
import com.microboxlabs.miot.core.iam.BaseRole;
import com.microboxlabs.miot.core.iam.Caller;
import com.microboxlabs.miot.core.iam.IamIdentityAugmentor;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.integrations.service.ConnectionResolutionException;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.function.Function;
import java.util.function.Supplier;
import org.eclipse.microprofile.config.ConfigProvider;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * Conversation rules, the platform's templates, the event catalog and the runs of an organization. Any authenticated
 * user of the organization reads; writes need an Owner or Admin of the organization, or the Control Tower maintainer's
 * {@value #MAINTAINER_PERMISSION}. Endpoints return {@link Uni} so the request stays on the event loop for the
 * reactive org filter; the blocking work runs on the worker pool.
 */
@Path("/api/v1/orgs/{organizationId}/conversations")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Conversations", description = "Conversation rules, templates, events and runs")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class OrgConversationsResource {

    /** The Control Tower maintainer's publish permission (miot-symptoms' ControlTowerAccessCatalog). */
    public static final String MAINTAINER_PERMISSION = "controltower:symptom.publish";
    private static final String ORG = "organizationId";
    private static final String ID = "id";
    private static final String KEY = "key";
    private static final String ERROR = "error";

    public record CreateRuleRequest(String key, String name, JsonNode spec) {
    }

    public record DraftRequest(JsonNode spec) {
    }

    /** {@code bump} may raise the computed bump; null keeps it. */
    public record PublishRequest(String reason, RuleBump bump) {
    }

    public record StateRequest(Rule.State state) {
    }

    public record SimulateRequest(SampleEvent event) {
    }

    private final TenantContext tenantContext;
    private final OrganizationContext organizationContext;
    private final Function<String, Uni<Access>> access;
    private final Supplier<String> actor;
    private final RulesService service;
    private final RuleSimulator simulator;
    private final TemplatesService templates;
    private final RunsService runs;

    /** The services behind the endpoints. */
    public record Services(RulesService rules, RuleSimulator simulator, TemplatesService templates,
            RunsService runs) {
    }

    @Inject
    public OrgConversationsResource(TenantContext tenantContext, OrganizationContext organizationContext,
            OrganizationRoleService roleService, SecurityIdentity identity, RulesService rules,
            RuleSimulator simulator, TemplatesService templates, RunsService runs) {
        this(tenantContext, organizationContext,
                org -> roleService.access(org, caller(identity, organizationContext, tenantContext)),
                () -> actor(identity, organizationContext),
                new Services(rules, simulator, templates, runs));
    }

    public OrgConversationsResource(TenantContext tenantContext, OrganizationContext organizationContext,
            Function<String, Uni<Access>> access, Supplier<String> actor, Services services) {
        this.tenantContext = tenantContext;
        this.organizationContext = organizationContext;
        this.access = access;
        this.actor = actor;
        this.service = services.rules();
        this.simulator = services.simulator();
        this.templates = services.templates();
        this.runs = services.runs();
    }

    // Rules

    @GET
    @Path("/rules")
    @Operation(operationId = "listConversationRules", summary = "The organization's conversation rules")
    public Uni<Response> listRules(@PathParam(ORG) String organizationId) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(service.list(tenant)).build());
    }

    @POST
    @Path("/rules")
    @Operation(operationId = "createConversationRule", summary = "Create a rule, OFF, with a draft")
    public Uni<Response> createRule(@PathParam(ORG) String organizationId, CreateRuleRequest body) {
        String tenant = tenantCode(organizationId);
        String who = actor.get();
        return write(organizationId, () -> {
            if (body == null) {
                throw new IllegalArgumentException("key and name are required");
            }
            return Response.status(Response.Status.CREATED)
                    .entity(service.create(tenant, body.key(), body.name(), body.spec(), who)).build();
        });
    }

    @GET
    @Path("/rules/{id}")
    @Operation(operationId = "getConversationRule", summary = "A rule, its version in force, its draft and versions")
    public Uni<Response> getRule(@PathParam(ORG) String organizationId, @PathParam(ID) String id) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(service.detail(tenant, id)).build());
    }

    @PUT
    @Path("/rules/{id}/draft")
    @Operation(operationId = "saveConversationRuleDraft", summary = "Save the draft and return its findings")
    public Uni<Response> saveDraft(@PathParam(ORG) String organizationId, @PathParam(ID) String id,
            DraftRequest body) {
        String tenant = tenantCode(organizationId);
        String who = actor.get();
        return write(organizationId,
                () -> Response.ok(service.saveDraft(tenant, id, body == null ? null : body.spec(), who)).build());
    }

    @POST
    @Path("/rules/{id}/publish")
    @Operation(operationId = "publishConversationRule",
            summary = "Publish the draft as the semantic version its changes call for; 409 with the findings when it has errors")
    public Uni<Response> publish(@PathParam(ORG) String organizationId, @PathParam(ID) String id,
            PublishRequest body) {
        String tenant = tenantCode(organizationId);
        String who = actor.get();
        return write(organizationId, () -> {
            try {
                return Response.ok(service.publish(tenant, id, body == null ? null : body.reason(),
                        body == null ? null : body.bump(), who)).build();
            } catch (RulesService.NotPublishable e) {
                Map<String, Object> entity = new LinkedHashMap<>();
                entity.put(ERROR, e.getMessage());
                entity.put("findings", e.findings());
                return Response.status(Response.Status.CONFLICT).type(MediaType.APPLICATION_JSON).entity(entity)
                        .build();
            }
        });
    }

    @PUT
    @Path("/rules/{id}/state")
    @Operation(operationId = "setConversationRuleState", summary = "Turn a rule OFF, to TEST or ACTIVE")
    public Uni<Response> setState(@PathParam(ORG) String organizationId, @PathParam(ID) String id,
            StateRequest body) {
        String tenant = tenantCode(organizationId);
        return write(organizationId,
                () -> Response.ok(service.setState(tenant, id, body == null ? null : body.state())).build());
    }

    @POST
    @Path("/rules/{id}/simulate")
    @Operation(operationId = "simulateConversationRule",
            summary = "What the draft (else the version in force) would send for a sample event; sends nothing")
    public Uni<Response> simulate(@PathParam(ORG) String organizationId, @PathParam(ID) String id,
            SimulateRequest body) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(simulator.simulate(tenant, id, body == null ? null : body.event())).build());
    }

    // Templates

    @GET
    @Path("/templates")
    @Operation(operationId = "listConversationTemplates",
            summary = "The platform's message templates, with the organization's rules that use each")
    public Uni<Response> listTemplates(@PathParam(ORG) String organizationId) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(templates.list(tenant)).build());
    }

    @GET
    @Path("/templates/{key}")
    @Operation(operationId = "getConversationTemplate",
            summary = "One platform template, with the organization's rules that use it")
    public Uni<Response> getTemplate(@PathParam(ORG) String organizationId, @PathParam(KEY) String key) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(templates.get(tenant, key)).build());
    }

    // Events and runs

    @GET
    @Path("/events/catalog")
    @Operation(operationId = "conversationEventCatalog",
            summary = "The event types rules can start on, with their fields and template variables")
    public Uni<Response> catalog(@PathParam(ORG) String organizationId) {
        tenantCode(organizationId);
        return work(() -> Response.ok(service.events()).build());
    }

    @GET
    @Path("/runs")
    @Operation(operationId = "listConversationRuns", summary = "Runs, newest first, with their messages")
    public Uni<Response> listRuns(@PathParam(ORG) String organizationId, @QueryParam("rule") String rule,
            @QueryParam("status") String status, @QueryParam("limit") Integer limit) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(runs.list(tenant, blankToNull(rule), runStatus(status), limit)).build());
    }

    private static Run.Status runStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        try {
            return Run.Status.valueOf(status.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("status: WAITING, REPLIED, DONE, FAILED or CANCELLED");
        }
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    /** Runs a write when the caller may change the organization's rules; 403 otherwise. */
    private Uni<Response> write(String organizationId, Supplier<Response> work) {
        return access.apply(organizationId).flatMap(a -> canWrite(a) ? work(work)
                : Uni.createFrom().item(error(Response.Status.FORBIDDEN,
                        "Owner, Admin or Control Tower maintainer required")));
    }

    static boolean canWrite(Access access) {
        return access != null && ((access.baseRole() != null && access.baseRole().atLeast(BaseRole.ADMIN))
                || access.can(MAINTAINER_PERMISSION));
    }

    static Uni<Response> work(Supplier<Response> work) {
        return Uni.createFrom().item(() -> guarded(work)).runSubscriptionOn(Infrastructure.getDefaultWorkerPool());
    }

    private static Response guarded(Supplier<Response> work) {
        try {
            return work.get();
        } catch (IllegalArgumentException e) {
            return error(Response.Status.BAD_REQUEST, e.getMessage());
        } catch (NoSuchElementException e) {
            return error(Response.Status.NOT_FOUND, e.getMessage());
        } catch (IllegalStateException | ConnectionResolutionException e) {
            return error(Response.Status.CONFLICT, e.getMessage());
        } catch (MetaGraphException e) {
            return error(metaStatus(e), e.getMessage());
        }
    }

    /** Meta refusing the request is the caller's 400 (404 for an unknown template); anything else is a 502. */
    static Response.Status metaStatus(MetaGraphException e) {
        if (!e.isClientError()) {
            return Response.Status.BAD_GATEWAY;
        }
        return e.httpStatus() == 404 ? Response.Status.NOT_FOUND : Response.Status.BAD_REQUEST;
    }

    private static Response error(Response.Status status, String message) {
        return Response.status(status).type(MediaType.APPLICATION_JSON)
                .entity(Map.of(ERROR, message == null ? status.getReasonPhrase() : message)).build();
    }

    private String tenantCode(String organizationId) {
        if (!Objects.equals(organizationId, organizationContext.getOrganizationId())) {
            throw new WebApplicationException(Response.status(Response.Status.FORBIDDEN)
                    .type(MediaType.APPLICATION_JSON)
                    .entity(Map.of(ERROR, "Organization context does not match request path"))
                    .build());
        }
        return tenantContext.getTenantCode() != null ? tenantContext.getTenantCode() : tenantContext.getClientId();
    }

    /** The caller as the access evaluator sees it: API key account, user, else the token's client id. */
    private static Caller caller(SecurityIdentity identity, OrganizationContext org, TenantContext tenant) {
        Caller serviceAccount = IamIdentityAugmentor.serviceAccountOf(identity);
        if (serviceAccount != null) {
            return serviceAccount;
        }
        String email = org.getUserEmail();
        if (email != null && !email.isBlank()) {
            return Caller.user(email);
        }
        List<String> claims = ConfigProvider.getConfig()
                .getOptionalValues("miot.auth.client-id-claims", String.class)
                .orElse(List.of("aud", "azp"));
        String clientId = OrganizationAccess.clientId(identity, claims);
        return Caller.client(clientId != null ? clientId : tenant.getClientId());
    }

    /** The user's email for a session token, the principal otherwise. */
    private static String actor(SecurityIdentity identity, OrganizationContext org) {
        String email = org.getUserEmail();
        if (email != null && !email.isBlank()) {
            return email;
        }
        return identity != null && identity.getPrincipal() != null ? identity.getPrincipal().getName() : null;
    }
}
