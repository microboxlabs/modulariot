package com.microboxlabs.miot.core.alfresco;

import com.microboxlabs.miot.core.alfresco.client.AddGroupMemberRequest;
import com.microboxlabs.miot.core.alfresco.client.AlfrescoClientException;
import com.microboxlabs.miot.core.alfresco.client.AlfrescoCoreApi;
import com.microboxlabs.miot.core.alfresco.client.CreateGroupRequest;
import io.quarkus.arc.lookup.LookupUnlessProperty;
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
public class RealAlfrescoGroupAdminClient implements IAlfrescoGroupAdminClient {

    private static final Logger LOG = Logger.getLogger(RealAlfrescoGroupAdminClient.class);

    private final AlfrescoCoreApi coreApi;

    public RealAlfrescoGroupAdminClient(@RestClient AlfrescoCoreApi coreApi) {
        this.coreApi = coreApi;
    }

    @Override
    public Uni<String> createGroup(String groupId, String displayName) {
        return coreApi.createGroup(new CreateGroupRequest(groupId, displayName))
                .map(resp -> resp.entry() != null ? resp.entry().id() : groupId);
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
