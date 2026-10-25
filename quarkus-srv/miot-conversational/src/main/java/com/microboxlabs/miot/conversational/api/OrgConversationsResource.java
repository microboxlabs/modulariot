package com.microboxlabs.miot.conversational.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.microboxlabs.miot.conversational.accounts.ChannelAccountsService;
import com.microboxlabs.miot.conversational.accounts.ChannelMode;
import com.microboxlabs.miot.conversational.client.MetaGraphException;
import com.microboxlabs.miot.conversational.rules.ConnectionChannel;
import com.microboxlabs.miot.conversational.rules.ConnectionChannels;
import com.microboxlabs.miot.conversational.rules.Rule;
import com.microboxlabs.miot.conversational.rules.RuleBump;
import com.microboxlabs.miot.conversational.rules.Run;
import com.microboxlabs.miot.conversational.rules.RulesService;
import com.microboxlabs.miot.conversational.rules.RuleSimulator;
import com.microboxlabs.miot.conversational.access.ConversationsAccessCatalog;
import com.microboxlabs.miot.conversational.rules.Invocation;
import com.microboxlabs.miot.conversational.rules.RuleInvocations;
import com.microboxlabs.miot.conversational.rules.RuleSimulator.SampleEvent;
import com.microboxlabs.miot.conversational.rules.RunsService;
import com.microboxlabs.miot.conversational.rules.TemplatesService;
import com.microboxlabs.miot.conversational.rules.TemplatesService.TemplateRequest;
import com.microboxlabs.miot.conversational.service.WhatsAppTemplateDraft;
import com.microboxlabs.miot.conversational.service.WhatsAppTemplatesService;
import com.microboxlabs.miot.core.auth.OrganizationAccess;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.PlatformScope;
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
import jakarta.ws.rs.DELETE;
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
import java.util.Optional;
import java.util.function.Function;
import java.util.function.Supplier;
import org.eclipse.microprofile.config.ConfigProvider;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * Conversation rules, the platform's templates, the event catalog, the runs, the connection channels and the
 * WhatsApp and email accounts of an organization. Any authenticated user of the organization reads; writes need an Owner or Admin of the organization,
 * or the Control Tower maintainer's {@value #MAINTAINER_PERMISSION}; invoking a published rule also takes
 * {@value ConversationsAccessCatalog#RULE_INVOKE}; the accounts only an Owner changes. Endpoints return {@link Uni} so the request stays on the event loop for the
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
    private static final String CHANNEL = "channel";

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

    /** See {@link Invocation}; every field is optional. */
    public record InvokeRequest(String version, SampleEvent event, Map<String, List<Invocation.Person>> to,
            String key) {
    }

    public record CreateConnectionRequest(String name, String baseUrl, String credentialProfileId) {
    }

    public record AccountModeRequest(ChannelMode mode) {
    }

    /** {@code names} empty or null: every template of the platform's account. */
    public record CopyTemplatesRequest(List<String> names) {
    }

    private final TenantContext tenantContext;
    private final OrganizationContext organizationContext;
    private final Function<String, Uni<Access>> access;
    private final Supplier<String> actor;
    private final RulesService service;
    private final RuleSimulator simulator;
    private final RuleInvocations invocations;
    private final TemplatesService templates;
    private final RunsService runs;
    private final ConnectionChannels channels;
    private final ChannelAccountsService accounts;
    private final WhatsAppTemplatesService whatsappTemplates;

    /** The services behind the endpoints. */
    public record Services(RulesService rules, RuleSimulator simulator, TemplatesService templates,
            RunsService runs, ConnectionChannels channels, ChannelAccountsService accounts,
            WhatsAppTemplatesService whatsappTemplates, RuleInvocations invocations) {

        public Services(RulesService rules, RuleSimulator simulator, TemplatesService templates, RunsService runs,
                ConnectionChannels channels, ChannelAccountsService accounts,
                WhatsAppTemplatesService whatsappTemplates) {
            this(rules, simulator, templates, runs, channels, accounts, whatsappTemplates, null);
        }
    }

    @Inject
    public OrgConversationsResource(TenantContext tenantContext, OrganizationContext organizationContext,
            OrganizationRoleService roleService, SecurityIdentity identity, RulesService rules,
            RuleSimulator simulator, TemplatesService templates, RunsService runs, ConnectionChannels channels,
            ChannelAccountsService accounts, WhatsAppTemplatesService whatsappTemplates, RuleInvocations invocations) {
        this(tenantContext, organizationContext,
                org -> roleService.access(org, caller(identity, organizationContext, tenantContext)),
                () -> actor(identity, organizationContext),
                new Services(rules, simulator, templates, runs, channels, accounts, whatsappTemplates,
                        invocations));
    }

    public OrgConversationsResource(TenantContext tenantContext, OrganizationContext organizationContext,
            Function<String, Uni<Access>> access, Supplier<String> actor, Services services) {
        this.tenantContext = tenantContext;
        this.organizationContext = organizationContext;
        this.access = access;
        this.actor = actor;
        this.service = services.rules();
        this.simulator = services.simulator();
        this.invocations = services.invocations();
        this.templates = services.templates();
        this.runs = services.runs();
        this.channels = services.channels();
        this.accounts = services.accounts();
        this.whatsappTemplates = services.whatsappTemplates();
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

    @DELETE
    @Path("/rules/{id}/draft")
    @Operation(operationId = "discardConversationRuleDraft",
            summary = "Discard the draft; the rule shows its version in force again. 400 before the first publish")
    public Uni<Response> discardDraft(@PathParam(ORG) String organizationId, @PathParam(ID) String id) {
        String tenant = tenantCode(organizationId);
        return write(organizationId, () -> {
            service.discardDraft(tenant, id);
            return Response.noContent().build();
        });
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
                return notPublishable(e);
            }
        });
    }

    @POST
    @Path("/rules/{id}/invoke")
    @Operation(operationId = "invokeConversationRule",
            summary = "Start the rule without its trigger: the version in force or the draft, to its groups or to "
                    + "the people named for them; 409 when the rule is off or the draft has errors")
    public Uni<Response> invoke(@PathParam(ORG) String organizationId, @PathParam(ID) String id,
            InvokeRequest body) {
        String tenant = tenantCode(organizationId);
        Invocation invocation = body == null ? new Invocation(null, null, null, null)
                : new Invocation(body.version(), body.event(), body.to(), body.key());
        return access.apply(organizationId).flatMap(a -> {
            if (!(invocation.draft() ? canWrite(a) : canInvoke(a))) {
                return Uni.createFrom().item(error(Response.Status.FORBIDDEN, invocation.draft()
                        ? "Owner, Admin or Control Tower maintainer required"
                        : "Owner, Admin, Control Tower maintainer or " + ConversationsAccessCatalog.RULE_INVOKE
                                + " required"));
            }
            return work(() -> {
                try {
                    return Response.ok(invocations.start(tenant, id, invocation)).build();
                } catch (RulesService.NotPublishable e) {
                    return notPublishable(e);
                }
            });
        });
    }

    private static Response notPublishable(RulesService.NotPublishable e) {
        Map<String, Object> entity = new LinkedHashMap<>();
        entity.put(ERROR, e.getMessage());
        entity.put("findings", e.findings());
        return Response.status(Response.Status.CONFLICT).type(MediaType.APPLICATION_JSON).entity(entity).build();
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
        return work(() -> Response.ok(platform(tenant) ? templates.platformList() : templates.list(tenant)).build());
    }

    @GET
    @Path("/templates/{key}")
    @Operation(operationId = "getConversationTemplate",
            summary = "One platform template, with the organization's rules that use it")
    public Uni<Response> getTemplate(@PathParam(ORG) String organizationId, @PathParam(KEY) String key) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(platform(tenant) ? templates.platformGet(key) : templates.get(tenant, key))
                .build());
    }

    @PUT
    @Path("/templates/{key}")
    @Operation(operationId = "saveConversationTemplate",
            summary = "In the platform scope, create or replace a template; its semantic version rises by what changed")
    public Uni<Response> saveTemplate(@PathParam(ORG) String organizationId, @PathParam(KEY) String key,
            TemplateRequest body) {
        String tenant = tenantCode(organizationId);
        String who = actor.get();
        if (!platform(tenant)) {
            return Uni.createFrom().item(error(Response.Status.FORBIDDEN,
                    "Message templates are the platform's; edit them in the platform scope"));
        }
        return owner(organizationId, () -> Response.ok(templates.save(key, body, who)).build());
    }

    // Channels

    @GET
    @Path("/channels/{channel}")
    @Operation(operationId = "getConversationConnectionChannel",
            summary = "A connection channel (webhook, slack, teams): the body its connections receive, and the "
                    + "organization's connections")
    public Uni<Response> connectionChannel(@PathParam(ORG) String organizationId,
            @PathParam(CHANNEL) String channel) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(channels.view(channel(channel), tenant)).build());
    }

    @POST
    @Path("/channels/{channel}/connections")
    @Operation(operationId = "createConversationChannelConnection",
            summary = "Create a connection from the channel's integration template")
    public Uni<Response> createChannelConnection(@PathParam(ORG) String organizationId,
            @PathParam(CHANNEL) String channel, CreateConnectionRequest body) {
        String tenant = tenantCode(organizationId);
        Optional<ConnectionChannel> kind = ConnectionChannel.of(channel);
        if (kind.isEmpty()) {
            return Uni.createFrom().item(unknownChannel(channel));
        }
        return write(organizationId, () -> {
            if (body == null) {
                throw new IllegalArgumentException("name and baseUrl are required");
            }
            return Response.status(Response.Status.CREATED).entity(ConnectionChannels.Connection.of(
                    channels.create(kind.get(), tenant, body.name(), body.baseUrl(), body.credentialProfileId())))
                    .build();
        });
    }

    private static ConnectionChannel channel(String channel) {
        return ConnectionChannel.of(channel).orElseThrow(() -> new NoSuchElementException(unknown(channel)));
    }

    private static Response unknownChannel(String channel) {
        return error(Response.Status.NOT_FOUND, unknown(channel));
    }

    private static String unknown(String channel) {
        return "Unknown channel " + channel + ": webhook, slack or teams";
    }

    // WhatsApp and email accounts

    @GET
    @Path("/accounts")
    @Operation(operationId = "listConversationAccounts",
            summary = "Whether the rules send WhatsApp and email from the platform's account or the organization's own")
    public Uni<Response> listAccounts(@PathParam(ORG) String organizationId) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(accounts.list(tenant)).build());
    }

    @PUT
    @Path("/accounts/{channel}")
    @Operation(operationId = "setConversationAccountMode",
            summary = "Send a channel from the platform's account or the organization's own; OWN needs an active "
                    + "connection")
    public Uni<Response> setAccountMode(@PathParam(ORG) String organizationId, @PathParam(CHANNEL) String channel,
            AccountModeRequest body) {
        String tenant = tenantCode(organizationId);
        String who = actor.get();
        return owner(organizationId,
                () -> Response.ok(accounts.set(tenant, channel, body == null ? null : body.mode(), who)).build());
    }

    @GET
    @Path("/whatsapp-templates")
    @Operation(operationId = "listConversationWhatsAppTemplates",
            summary = "The templates on the WABA of the organization's WhatsApp connection, with their status")
    public Uni<Response> listWhatsAppTemplates(@PathParam(ORG) String organizationId) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(whatsappTemplates.list(tenant)).build());
    }

    @POST
    @Path("/whatsapp-templates")
    @Operation(operationId = "createConversationWhatsAppTemplate", summary = "Submit a new template to Meta for review")
    public Uni<Response> createWhatsAppTemplate(@PathParam(ORG) String organizationId, WhatsAppTemplateDraft body) {
        String tenant = tenantCode(organizationId);
        return owner(organizationId,
                () -> Response.status(Response.Status.CREATED).entity(whatsappTemplates.create(tenant, body)).build());
    }

    @PUT
    @Path("/whatsapp-templates/{id}")
    @Operation(operationId = "editConversationWhatsAppTemplate",
            summary = "Change a template's category or components; Meta reviews it again")
    public Uni<Response> editWhatsAppTemplate(@PathParam(ORG) String organizationId, @PathParam(ID) String id,
            WhatsAppTemplateDraft body) {
        String tenant = tenantCode(organizationId);
        return owner(organizationId, () -> Response.ok(whatsappTemplates.edit(tenant, id, body)).build());
    }

    @DELETE
    @Path("/whatsapp-templates/{name}")
    @Operation(operationId = "deleteConversationWhatsAppTemplate",
            summary = "Delete a template by name, in every language, or only the one with the given id")
    public Uni<Response> deleteWhatsAppTemplate(@PathParam(ORG) String organizationId,
            @PathParam("name") String name, @QueryParam(ID) String id) {
        String tenant = tenantCode(organizationId);
        return owner(organizationId, () -> {
            whatsappTemplates.delete(tenant, name, id == null || id.isBlank() ? null : id.trim());
            return Response.noContent().build();
        });
    }

    @POST
    @Path("/whatsapp-templates/copy")
    @Operation(operationId = "copyConversationWhatsAppTemplates",
            summary = "Submit the platform's WhatsApp templates to the organization's own WABA for Meta's review")
    public Uni<Response> copyWhatsAppTemplates(@PathParam(ORG) String organizationId, CopyTemplatesRequest body) {
        String tenant = tenantCode(organizationId);
        return owner(organizationId, () -> Response.ok(
                whatsappTemplates.copyFromPlatform(tenant, body == null ? null : body.names())).build());
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

    private static boolean platform(String tenant) {
        return PlatformScope.TENANT.equals(tenant);
    }

    /** Runs a change to the organization's accounts or templates when the caller is an Owner; 403 otherwise. */
    private Uni<Response> owner(String organizationId, Supplier<Response> work) {
        return access.apply(organizationId).flatMap(a -> a != null && a.baseRole() == BaseRole.OWNER ? work(work)
                : Uni.createFrom().item(error(Response.Status.FORBIDDEN, "Owner required")));
    }

    static boolean canWrite(Access access) {
        return access != null && ((access.baseRole() != null && access.baseRole().atLeast(BaseRole.ADMIN))
                || access.can(MAINTAINER_PERMISSION));
    }

    static boolean canInvoke(Access access) {
        return canWrite(access) || (access != null && access.can(ConversationsAccessCatalog.RULE_INVOKE));
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
