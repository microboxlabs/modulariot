package com.microboxlabs.miot.integrations.api;

import com.microboxlabs.miot.core.auth.PlatformAuthorizer;
import com.microboxlabs.miot.core.model.Organization;
import com.microboxlabs.miot.integrations.orgaccount.GoogleCallException;
import com.microboxlabs.miot.integrations.orgaccount.OrgServiceAccount;
import com.microboxlabs.miot.integrations.orgaccount.OrgServiceAccountService;
import com.microboxlabs.miot.integrations.service.ManagedBigQueryConnections;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * An organization's Google service account, managed by a platform owner. The
 * account has no key; the platform acts as it when the organization needs it.
 */
@Path("/api/v1/platform/orgs/{slug}/service-account")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "Platform Organization Service Accounts", description = "One Google service account per organization")
@SecurityRequirement(name = "oidc")
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class PlatformOrgServiceAccountResource {

    public record AccountView(String email, String accountId, boolean disabled, OffsetDateTime createdAt,
            String createdBy, OffsetDateTime updatedAt, String updatedBy) {
        static AccountView of(OrgServiceAccount a) {
            return new AccountView(a.email(), a.accountId(), a.disabled(), a.createdAt(), a.createdBy(),
                    a.updatedAt(), a.updatedBy());
        }
    }

    /** {@code account} is null until one is created. */
    public record StateView(boolean configured, String projectId, AccountView account) {
    }

    public record CheckView(boolean disabled, Instant tokenExpiresAt) {
    }

    record Org(String tenantCode, String name) {
    }

    public record ManagedConnectionView(String connectionId, String name, String status, boolean tested,
            String testMessage) {
    }

    private final OrgServiceAccountService service;
    private final ManagedBigQueryConnections bigQuery;
    private final PlatformAuthorizer authorizer;

    @Inject
    public PlatformOrgServiceAccountResource(OrgServiceAccountService service, ManagedBigQueryConnections bigQuery,
            PlatformAuthorizer authorizer) {
        this.service = service;
        this.bigQuery = bigQuery;
        this.authorizer = authorizer;
    }

    @POST
    @Path("/bigquery-connection")
    @Operation(summary = "Connect the organization to BigQuery as its own service account",
            description = "Creates the account when missing, lets it run jobs in the organizations' project,"
                    + " creates the connection once and tests it. Idempotent.")
    public Uni<Response> connectBigQuery(@PathParam("slug") String slug) {
        return run(slug, (org, actor) -> {
            ManagedBigQueryConnections.Result result = bigQuery.create(org.tenantCode(), slug, org.name(), actor);
            return Response.ok(new ManagedConnectionView(result.connection().id(), result.connection().name(),
                    result.connection().status().name(), result.test().success(), result.test().message())).build();
        });
    }

    @GET
    @Operation(summary = "The organization's service account, if it has one")
    public Uni<Response> get(@PathParam("slug") String slug) {
        return run(slug, (org, actor) -> Response.ok(state(service.find(org.tenantCode()))).build());
    }

    @POST
    @Operation(summary = "Create the organization's service account",
            description = "Idempotent: an organization keeps the account it was given first.")
    public Uni<Response> create(@PathParam("slug") String slug) {
        return run(slug, (org, actor) -> Response.ok(state(Optional.of(
                service.create(org.tenantCode(), slug, org.name(), actor)))).build());
    }

    @POST
    @Path("/disable")
    @Operation(summary = "Disable the account in Google: nothing can act as it until it is enabled")
    public Uni<Response> disable(@PathParam("slug") String slug) {
        return run(slug, (org, actor) -> Response.ok(state(Optional.of(
                service.setDisabled(org.tenantCode(), true, actor)))).build());
    }

    @POST
    @Path("/enable")
    @Operation(summary = "Enable a disabled account")
    public Uni<Response> enable(@PathParam("slug") String slug) {
        return run(slug, (org, actor) -> Response.ok(state(Optional.of(
                service.setDisabled(org.tenantCode(), false, actor)))).build());
    }

    @POST
    @Path("/check")
    @Operation(summary = "Check that the platform can act as the account",
            description = "Mints a five-minute token and reports when it expires; the token is not returned.")
    public Uni<Response> check(@PathParam("slug") String slug) {
        return run(slug, (org, actor) -> {
            OrgServiceAccountService.Check check = service.check(org.tenantCode());
            return Response.ok(new CheckView(check.disabled(), check.tokenExpiresAt())).build();
        });
    }

    interface Action {
        Response apply(Org org, String actor);
    }

    private Uni<Response> run(String slug, Action action) {
        return owner().flatMap(actor -> organization(slug).flatMap(org -> org.isEmpty()
                ? Uni.createFrom().item(error(Response.Status.NOT_FOUND, "Organization not found"))
                : onWorker(() -> respond(org.get(), actor, action))));
    }

    static Response respond(Org org, String actor, Action action) {
        try {
            return action.apply(org, actor);
        } catch (OrgServiceAccountService.NotConfiguredException e) {
            return error(Response.Status.SERVICE_UNAVAILABLE, e.getMessage());
        } catch (OrgServiceAccountService.NotFoundException e) {
            return error(Response.Status.NOT_FOUND, e.getMessage());
        } catch (GoogleCallException e) {
            return error(Response.Status.BAD_GATEWAY, e.getMessage());
        }
    }

    private StateView state(Optional<OrgServiceAccount> account) {
        return new StateView(service.configured(), service.projectId().orElse(null),
                account.map(AccountView::of).orElse(null));
    }

    protected Uni<String> owner() {
        return authorizer.requirePlatformOwner();
    }

    protected Uni<Optional<Org>> organization(String slug) {
        return Panache.withSession(() -> Organization.findBySlug(slug)).map(org -> {
            if (org == null || org.tenantClientId == null || org.tenantClientId.isBlank()) return Optional.empty();
            String name = org.displayName == null || org.displayName.isBlank() ? org.name : org.displayName;
            return Optional.of(new Org(org.tenantClientId, name));
        });
    }

    private static Uni<Response> onWorker(Supplier<Response> work) {
        return Uni.createFrom().item(work).runSubscriptionOn(Infrastructure.getDefaultWorkerPool());
    }

    private static Response error(Response.Status status, String message) {
        return Response.status(status).type(MediaType.APPLICATION_JSON).entity(Map.of("error", message)).build();
    }
}
