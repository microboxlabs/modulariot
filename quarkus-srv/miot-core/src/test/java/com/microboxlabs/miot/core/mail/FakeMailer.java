package com.microboxlabs.miot.core.mail;

import com.microboxlabs.miot.core.model.Organization;
import io.smallrye.mutiny.Uni;
import jakarta.annotation.Priority;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Records every email instead of sending it. Only organizations whose tenant client id was
 * {@link #configure}d have a mail connection; the rest answer NOT_CONFIGURED.
 */
@ApplicationScoped
@Alternative
@Priority(1)
public class FakeMailer implements OrganizationMailer {

    public record Sent(String tenantClientId, Mail mail, String idempotencyKey) {
    }

    private final Set<String> configured = ConcurrentHashMap.newKeySet();
    private final List<Sent> sent = new CopyOnWriteArrayList<>();

    public void configure(String tenantClientId) {
        configured.add(tenantClientId);
    }

    public List<Sent> sent() {
        return List.copyOf(sent);
    }

    public void reset() {
        configured.clear();
        sent.clear();
    }

    @Override
    public Uni<MailDelivery> send(Organization organization, Mail mail, String idempotencyKey) {
        if (!configured.contains(organization.tenantClientId)) {
            return Uni.createFrom().item(MailDelivery.notConfigured("No mail connection"));
        }
        sent.add(new Sent(organization.tenantClientId, mail, idempotencyKey));
        return Uni.createFrom().item(MailDelivery.sent());
    }
}
