package com.microboxlabs.miot.conversational.api;

import com.microboxlabs.miot.conversational.jobs.WhatsAppWebhookJobs;
import com.microboxlabs.miot.conversational.service.WhatsAppSignatureVerifier;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionResolver;
import com.microboxlabs.miot.integrations.service.WhatsAppWebhookKeys;
import io.quarkus.arc.properties.IfBuildProperty;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Optional;
import java.util.function.Function;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.jboss.logging.Logger;

/**
 * Public inbound webhook for the Meta WhatsApp Cloud API — driver replies and message status
 * callbacks. Meta cannot present our JWT, so this path is deliberately outside both auth regimes:
 *
 * <ul>
 *   <li>It sits under {@code /webhooks/whatsapp} — a prefix the blanket {@code /api/* →
 *       authenticated} policy does not match at all, so the request is never challenged. (The
 *       original {@code /api/v1/whatsapp/webhook} placement plus a more-specific {@code permit}
 *       rule returned 401 in practice: Quarkus 3.32.4 did not let the narrower {@code permit}
 *       override {@code /api/*}. Living off {@code /api/*} sidesteps that precedence entirely.)</li>
 *   <li>It carries no {@code {organizationId}}, so the org-scoped {@code OrganizationRequestFilter}
 *       — which only matches {@code /api/v1/orgs/**} — never runs. The path names the WHATSAPP
 *       connection instead; its organization owns the delivery.</li>
 * </ul>
 *
 * <p>Trust is established by the connection's own keys, stored on its credential: the verify token
 * on {@code GET} and an {@code X-Hub-Signature-256} HMAC with the Meta App secret on {@code POST}.
 * An unknown connection or a mismatch returns 403/401 and the body is never processed.
 */
@Path("/webhooks/whatsapp/{connectionId}")
@Tag(name = "WhatsApp Webhook", description = "Inbound Meta WhatsApp Cloud API webhook (public, signature-verified)")
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class WhatsAppWebhookResource {

    private static final Logger LOG = Logger.getLogger(WhatsAppWebhookResource.class);
    private static final String MODE_SUBSCRIBE = "subscribe";

    private final Function<String, Optional<WhatsAppWebhookKeys>> keys;
    private final WhatsAppWebhookJobs jobs;

    @Inject
    public WhatsAppWebhookResource(IntegrationConnectionResolver resolver, WhatsAppWebhookJobs jobs) {
        this(resolver::whatsAppWebhookKeys, jobs);
    }

    WhatsAppWebhookResource(Function<String, Optional<WhatsAppWebhookKeys>> keys, WhatsAppWebhookJobs jobs) {
        this.keys = keys;
        this.jobs = jobs;
    }

    /**
     * Meta's one-time subscription handshake: echo {@code hub.challenge} verbatim (text/plain)
     * only when Meta is subscribing and presents the connection's verify token.
     */
    @GET
    @Produces(MediaType.TEXT_PLAIN)
    @Operation(summary = "Verify the webhook subscription (Meta hub.challenge handshake)")
    public Response verify(
            @PathParam("connectionId") String connectionId,
            @QueryParam("hub.mode") String mode,
            @QueryParam("hub.verify_token") String token,
            @QueryParam("hub.challenge") String challenge) {
        String expected = keys.apply(connectionId).map(WhatsAppWebhookKeys::verifyToken).orElse("");
        if (!isValidHandshake(mode, token, expected)) {
            LOG.warnf("Rejected WhatsApp webhook verification handshake for connection %s", connectionId);
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        if (challenge == null || challenge.isBlank()) {
            LOG.warn("WhatsApp webhook handshake verified but hub.challenge was missing");
            return Response.status(Response.Status.BAD_REQUEST).build();
        }
        return Response.ok(challenge).build();
    }

    /**
     * Inbound events (driver messages + delivery/read status). Verifies the HMAC over the exact
     * received bytes with the connection's App secret, then makes each event of the connection's
     * organization an integration job and answers 200 once they are inserted. A failed insert answers
     * 500 so Meta redelivers; each job's dedupe key keeps a redelivery from running an event twice.
     */
    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Operation(summary = "Receive inbound WhatsApp messages and status callbacks (HMAC-verified)")
    public Uni<Response> receive(
            @PathParam("connectionId") String connectionId,
            @HeaderParam("X-Hub-Signature-256") String signature,
            byte[] body) {
        return Uni.createFrom().item(() -> {
            Optional<WhatsAppWebhookKeys> connection = keys.apply(connectionId);
            if (connection.isEmpty()
                    || !WhatsAppSignatureVerifier.verify(body, signature, connection.get().appSecret())) {
                LOG.warnf("Rejected WhatsApp webhook POST for connection %s: unknown connection or invalid "
                        + "X-Hub-Signature-256", connectionId);
                return Response.status(Response.Status.UNAUTHORIZED).build();
            }
            try {
                jobs.enqueue(body, connection.get().tenantCode());
                return Response.ok().build();
            } catch (RuntimeException e) {
                LOG.error("WhatsApp webhook ingestion failed; returning 500 so Meta retries", e);
                return Response.serverError().build();
            }
        }).runSubscriptionOn(Infrastructure.getDefaultWorkerPool());
    }

    /**
     * The handshake is valid only when Meta is subscribing AND presents exactly the connection's
     * verify token. A blank token never matches, so a connection without one cannot be verified
     * by an empty token. Static + package-private for unit testing without HTTP.
     */
    static boolean isValidHandshake(String mode, String token, String expectedToken) {
        return MODE_SUBSCRIBE.equals(mode)
                && expectedToken != null && !expectedToken.isBlank()
                && expectedToken.equals(token);
    }
}
