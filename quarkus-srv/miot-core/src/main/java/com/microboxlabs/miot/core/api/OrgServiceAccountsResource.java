package com.microboxlabs.miot.core.api;

import com.microboxlabs.miot.core.iam.ApiKeyService;
import com.microboxlabs.miot.core.iam.ApiKeyService.CreateKeyRequest;
import com.microboxlabs.miot.core.iam.ApiKeyService.CreateServiceAccountRequest;
import com.microboxlabs.miot.core.iam.Caller;
import com.microboxlabs.miot.core.iam.ApiKeyService.TokenCredentialRequest;
import com.microboxlabs.miot.core.iam.CoreAccessCatalog;
import com.microboxlabs.miot.core.iam.IamIdentityAugmentor;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.core.iam.TeamService.RolesRequest;
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
import java.util.UUID;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * Service accounts and their API keys. A key is shown once, when created; clients send it as
 * {@code Authorization: Bearer miot_sk_...}.
 */
@Path("/api/v1/orgs/{organizationId}/team/service-accounts")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Team", description = "Members, their roles, and invitations")
@SecurityRequirement(name = "oidc")
@Authenticated
public class OrgServiceAccountsResource {

    private static final String ORG = "organizationId";

    private final ApiKeyService keys;
    private final SecurityIdentity identity;
    private final List<String> clientIdClaims;

    @Inject
    public OrgServiceAccountsResource(ApiKeyService keys, SecurityIdentity identity,
            @ConfigProperty(name = "miot.auth.client-id-claims", defaultValue = "aud,azp")
            List<String> clientIdClaims) {
        this.keys = keys;
        this.identity = identity;
        this.clientIdClaims = clientIdClaims;
    }

    @GET
    @Operation(operationId = "listServiceAccounts", summary = "Service accounts with their roles and keys")
    @PermissionsAllowed(value = CoreAccessCatalog.APIKEYS_MANAGE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> list(@PathParam(ORG) String organizationId) {
        return IamResponses.ok(() -> keys.list(organizationId));
    }

    @POST
    @Operation(operationId = "createServiceAccount",
            summary = "Create a service account with module roles and its first key (returned once)")
    @PermissionsAllowed(value = CoreAccessCatalog.APIKEYS_MANAGE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> create(@PathParam(ORG) String organizationId,
            @HeaderParam(IamIdentityAugmentor.DEV_EMAIL_HEADER) String devEmail, CreateServiceAccountRequest body) {
        return IamResponses.respond(() -> keys.create(organizationId, caller(devEmail), body),
                Response.Status.CREATED);
    }

    @DELETE
    @Path("/{accountId}")
    @Operation(operationId = "deleteServiceAccount", summary = "Delete a service account, its keys and roles")
    @PermissionsAllowed(value = CoreAccessCatalog.APIKEYS_MANAGE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> delete(@PathParam(ORG) String organizationId, @PathParam("accountId") UUID accountId,
            @HeaderParam(IamIdentityAugmentor.DEV_EMAIL_HEADER) String devEmail) {
        return IamResponses.respond(() -> keys.delete(organizationId, caller(devEmail), accountId),
                Response.Status.NO_CONTENT);
    }

    @PUT
    @Path("/{accountId}/roles")
    @Operation(operationId = "setServiceAccountRoles", summary = "Replace a service account's module roles")
    @PermissionsAllowed(value = CoreAccessCatalog.APIKEYS_MANAGE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> setRoles(@PathParam(ORG) String organizationId, @PathParam("accountId") UUID accountId,
            @HeaderParam(IamIdentityAugmentor.DEV_EMAIL_HEADER) String devEmail, RolesRequest body) {
        return IamResponses.ok(() -> keys.setRoles(organizationId, caller(devEmail), accountId,
                body == null ? null : body.roles()));
    }

    @PUT
    @Path("/{accountId}/token-credential")
    @Operation(operationId = "setServiceAccountTokenCredential",
            summary = "Link the OAuth2 credential whose token this account's API keys are exchanged for")
    @PermissionsAllowed(value = CoreAccessCatalog.APIKEYS_MANAGE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> setTokenCredential(@PathParam(ORG) String organizationId,
            @PathParam("accountId") UUID accountId,
            @HeaderParam(IamIdentityAugmentor.DEV_EMAIL_HEADER) String devEmail, TokenCredentialRequest body) {
        return IamResponses.ok(() -> keys.setTokenCredential(organizationId, caller(devEmail), accountId, body));
    }

    @POST
    @Path("/{accountId}/keys")
    @Operation(operationId = "createApiKey", summary = "A new key for the service account (returned once)")
    @PermissionsAllowed(value = CoreAccessCatalog.APIKEYS_MANAGE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> createKey(@PathParam(ORG) String organizationId, @PathParam("accountId") UUID accountId,
            @HeaderParam(IamIdentityAugmentor.DEV_EMAIL_HEADER) String devEmail, CreateKeyRequest body) {
        return IamResponses.respond(() -> keys.createKey(organizationId, caller(devEmail), accountId, body),
                Response.Status.CREATED);
    }

    @DELETE
    @Path("/{accountId}/keys/{keyId}")
    @Operation(operationId = "revokeApiKey", summary = "Revoke a key; it stops working at once")
    @PermissionsAllowed(value = CoreAccessCatalog.APIKEYS_MANAGE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> revokeKey(@PathParam(ORG) String organizationId, @PathParam("accountId") UUID accountId,
            @PathParam("keyId") UUID keyId, @HeaderParam(IamIdentityAugmentor.DEV_EMAIL_HEADER) String devEmail) {
        return IamResponses.respond(() -> keys.revokeKey(organizationId, caller(devEmail), accountId, keyId),
                Response.Status.NO_CONTENT);
    }

    private Caller caller(String devEmail) {
        return IamIdentityAugmentor.callerOf(identity, devEmail, clientIdClaims);
    }
}
