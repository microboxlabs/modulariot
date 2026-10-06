package com.microboxlabs.miot.core.iam;

import com.microboxlabs.miot.core.iam.TeamService.CreatedInvitation;
import com.microboxlabs.miot.core.mail.Mail;
import com.microboxlabs.miot.core.mail.MailDelivery;
import com.microboxlabs.miot.core.mail.OrganizationMailer;
import com.microboxlabs.miot.core.model.Organization;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Emails an invitation link. Uses the organization's own mail connection, else the platform
 * organization's ({@code miot.mail.platform-organization}). Without {@code miot.app.public-url}
 * there is no link to send, so nothing is sent.
 */
@ApplicationScoped
public class InvitationMail {

    private static final Logger LOG = Logger.getLogger(InvitationMail.class);

    private final OrganizationMailer mailer;
    private final Optional<String> publicUrl;
    private final Optional<String> platformOrganization;

    @Inject
    public InvitationMail(OrganizationMailer mailer,
            @ConfigProperty(name = "miot.app.public-url") Optional<String> publicUrl,
            @ConfigProperty(name = "miot.mail.platform-organization") Optional<String> platformOrganization) {
        this.mailer = mailer;
        this.publicUrl = publicUrl.map(String::trim).filter(s -> !s.isEmpty());
        this.platformOrganization = platformOrganization.map(String::trim).filter(s -> !s.isEmpty());
    }

    /** Emails each invitation in turn and returns them with their delivery. Call after the commit. */
    public Uni<List<CreatedInvitation>> deliverAll(Organization root, List<CreatedInvitation> created, String inviter,
            String lang) {
        // Look the platform organization up first: a send may finish on a worker thread, where
        // Hibernate Reactive cannot run.
        return platform(root).flatMap(platform -> {
            Uni<List<CreatedInvitation>> chain = Uni.createFrom().item(new ArrayList<>());
            for (CreatedInvitation invitation : created) {
                chain = chain.flatMap(list -> deliver(root, platform, invitation, inviter, lang).map(sent -> {
                    list.add(sent);
                    return list;
                }));
            }
            return chain;
        });
    }

    public Uni<CreatedInvitation> deliver(Organization root, CreatedInvitation created, String inviter, String lang) {
        return platform(root).flatMap(platform -> deliver(root, platform, created, inviter, lang));
    }

    private Uni<CreatedInvitation> deliver(Organization root, Organization platform, CreatedInvitation created,
            String inviter, String lang) {
        if (publicUrl.isEmpty()) {
            return Uni.createFrom().item(created.withDelivery(
                    MailDelivery.notConfigured("miot.app.public-url is not set")));
        }
        String language = "en".equals(lang) ? "en" : "es";
        String link = link(publicUrl.get(), language, created.token());
        Mail mail = InvitationEmail.of(language, created.invitation().email(), root.name, inviter, link,
                created.invitation().expiresAt());
        // A resend makes a new token, so it gets a new key; a retry of the same send does not.
        String key = "invitation-" + created.invitation().id() + "-"
                + TeamService.hash(created.token()).substring(0, 16);
        return send(root, mail, key)
                .flatMap(delivery -> delivery.isNotConfigured() && platform != null
                        ? send(platform, mail, key)
                        : Uni.createFrom().item(delivery))
                .map(created::withDelivery);
    }

    /** The invitation is already saved, so a mailer failure becomes a FAILED delivery. */
    private Uni<MailDelivery> send(Organization organization, Mail mail, String key) {
        return mailer.send(organization, mail, key)
                .onFailure().recoverWithItem(e -> {
                    LOG.warnf(e, "Sending an invitation email for organization %s failed", organization.slug);
                    return MailDelivery.failed("Could not send the email");
                });
    }

    /** The platform organization that sends when the organization cannot, or null. */
    @SuppressWarnings("java:S3252") // Panache's static finder, called through the entity as elsewhere.
    private Uni<Organization> platform(Organization root) {
        if (platformOrganization.isEmpty() || platformOrganization.get().equals(root.slug)) {
            return Uni.createFrom().nullItem();
        }
        return Panache.withSession(() -> Organization.<Organization>find("slug", platformOrganization.get())
                        .firstResult())
                .onFailure().recoverWithItem(e -> {
                    LOG.warnf(e, "Could not load the platform organization %s", platformOrganization.get());
                    return null;
                });
    }

    static String link(String publicUrl, String lang, String token) {
        String base = publicUrl.endsWith("/") ? publicUrl.substring(0, publicUrl.length() - 1) : publicUrl;
        return base + "/" + lang + "/invite/" + token;
    }
}
