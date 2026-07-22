package com.microboxlabs.miot.core.alfresco;

import com.microboxlabs.miot.core.alfresco.client.AddGroupMemberRequest;
import com.microboxlabs.miot.core.alfresco.client.AlfrescoClientException;
import com.microboxlabs.miot.core.alfresco.client.AlfrescoCoreApi;
import com.microboxlabs.miot.core.alfresco.client.CreateGroupRequest;
import io.quarkus.arc.lookup.LookupUnlessProperty;
import io.quarkus.arc.properties.UnlessBuildProperty;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.rest.client.inject.RestClient;
import org.jboss.logging.Logger;

/**
 * Real implementation of {@link IAlfrescoGroupAdminClient} backed by
 * {@link AlfrescoCoreApi}. Active whenever {@code miot.alfresco.auth}
 * is not {@code stub}.
 *
 * <p>Idempotency:
 * <ul>
 *   <li>{@code addGroupMember} swallows 409 (already a member).</li>
 *   <li>{@code removeGroupMember} swallows 404 (not a member).</li>
 * </ul>
 * This keeps the admin UI "add"/"remove" buttons safe to click twice
 * without surfacing spurious errors.
 */
@ApplicationScoped
@LookupUnlessProperty(name = "miot.alfresco.auth", stringValue = "stub", lookupIfMissing = false)
// Fix local dev (rama feature/gemelos-gxc): la exclusión debe ser de BUILD —
// con inyección directa el bean real siempre ganaba sobre el stub @DefaultBean
// aunque miot.alfresco.auth=stub, y su fallo de conexión se recuperaba como
// "no miembro" dejando scopes vacíos sin error visible.
@UnlessBuildProperty(name = "miot.alfresco.auth", stringValue = "stub", enableIfMissing = true)
public class RealAlfrescoGroupAdminClient implements IAlfrescoGroupAdminClient {

    private static final Logger LOG = Logger.getLogger(RealAlfrescoGroupAdminClient.class);

    private final AlfrescoCoreApi coreApi;

    public RealAlfrescoGroupAdminClient(@RestClient AlfrescoCoreApi coreApi) {
        this.coreApi = coreApi;
    }

    @Override
    public Uni<String> createGroup(String groupId, String displayName) {
        return coreApi.createGroup(new CreateGroupRequest(groupId, displayName))
                .map(resp -> resp.entry() != null ? resp.entry().id() : groupId)
                .onFailure(AlfrescoClientException.class).recoverWithUni(ex -> {
                    if (ex.isConflict()) {
                        LOG.debugf("createGroup(%s): already exists — ignoring 409", groupId);
                        return Uni.createFrom().item(groupId);
                    }
                    return Uni.createFrom().failure(ex);
                });
    }

    @Override
    public Uni<Void> addGroupMember(String groupId, String personId) {
        return coreApi.addGroupMember(groupId, AddGroupMemberRequest.person(personId))
                .replaceWithVoid()
                .onFailure(AlfrescoClientException.class).recoverWithUni(ex -> {
                    if (ex.isConflict()) {
                        LOG.debugf("addGroupMember(%s, %s): already a member — ignoring 409",
                                groupId, personId);
                        return Uni.createFrom().voidItem();
                    }
                    return Uni.createFrom().failure(ex);
                });
    }

    @Override
    public Uni<Void> removeGroupMember(String groupId, String personId) {
        return coreApi.removeGroupMember(groupId, personId)
                .onFailure(AlfrescoClientException.class).recoverWithUni(ex -> {
                    if (ex.isNotFound()) {
                        LOG.debugf("removeGroupMember(%s, %s): not a member — ignoring 404",
                                groupId, personId);
                        return Uni.createFrom().voidItem();
                    }
                    return Uni.createFrom().failure(ex);
                });
    }
}
