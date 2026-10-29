package com.microboxlabs.miot.integrations.service;

import com.microboxlabs.miot.integrations.domain.CredentialProfile;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.ConnectionTestResponse;
import com.microboxlabs.miot.integrations.dto.CreateIntegrationConnectionRequest;
import com.microboxlabs.miot.integrations.orgaccount.ManagedGoogleIdentity;
import com.microboxlabs.miot.integrations.orgaccount.OrgServiceAccount;
import com.microboxlabs.miot.integrations.orgaccount.OrgServiceAccountService;
import com.microboxlabs.miot.integrations.persistence.CredentialProfileRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.net.URI;
import java.util.Map;
import java.util.Optional;

/**
 * A BigQuery connection that queries as the organization's own service account. It
 * creates the account when the organization has none, lets it run jobs in the
 * organizations' project, and tests the connection, which activates it.
 */
@ApplicationScoped
public class ManagedBigQueryConnections {

    static final String NAME = "BigQuery · ModularIoT";

    public record Result(IntegrationConnection connection, ConnectionTestResponse test) {
    }

    private final OrgServiceAccountService accounts;
    private final CredentialProfileService credentials;
    private final CredentialProfileRepository credentialRepository;
    private final IntegrationConnectionService connections;

    @Inject
    public ManagedBigQueryConnections(OrgServiceAccountService accounts, CredentialProfileService credentials,
            CredentialProfileRepository credentialRepository, IntegrationConnectionService connections) {
        this.accounts = accounts;
        this.credentials = credentials;
        this.credentialRepository = credentialRepository;
        this.connections = connections;
    }

    /** Idempotent: an organization keeps one managed BigQuery connection. */
    public Result create(String tenantCode, String slug, String name, String actor) {
        OrgServiceAccount account = accounts.create(tenantCode, slug, name, actor);
        accounts.allowQueries(tenantCode);
        IntegrationConnection connection = existing(tenantCode).orElseGet(() -> {
            CredentialProfile credential = credentials.createManaged(tenantCode, actor, NAME,
                    Map.of(ManagedGoogleIdentity.CLIENT_EMAIL, account.email(), "projectId", account.projectId()));
            return connections.createConnection(tenantCode, new CreateIntegrationConnectionRequest(NAME,
                    ProviderType.CUSTOM_HTTP, URI.create(BigQueryProbe.BASE_URL), credential.id(), Map.of(), null));
        });
        ConnectionTestResponse test = connections.testConnection(tenantCode, connection.id(), null);
        return new Result(connections.getConnection(tenantCode, connection.id()), test);
    }

    /** The tenant's BigQuery connection whose credential is the managed one. */
    Optional<IntegrationConnection> existing(String tenantCode) {
        return connections.listConnections(tenantCode).stream()
                .filter(BigQueryProbe::isBigQuery)
                .filter(c -> c.credentialProfileId() != null)
                .filter(c -> {
                    CredentialProfile credential =
                            credentialRepository.findByTenantAndId(tenantCode, c.credentialProfileId());
                    return credential != null && ManagedGoogleIdentity.isManaged(credential.publicConfig());
                })
                .findFirst();
    }
}
