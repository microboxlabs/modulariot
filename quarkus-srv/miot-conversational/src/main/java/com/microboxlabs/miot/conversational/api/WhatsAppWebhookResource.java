package com.microboxlabs.miot.conversational.api;

import com.microboxlabs.miot.conversational.service.WhatsAppSignatureVerifier;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.jboss.logging.Logger;

/**
 * Public inbound webhook for the Meta WhatsApp Cloud API — driver replies and message status
 * callbacks. Meta cannot present our JWT, so this path is deliberately outside both auth regimes:
 *
 * <ul>
 *   <li>It sits under {@code /api/v1/whatsapp/webhook} (no {@code {organizationId}}), so the
 *       org-scoped {@code OrganizationRequestFilter} — which only matches
 *       {@code /api/v1/orgs/**} — never runs. The owning org is resolved later from the payload's
 *       {@code phone_number_id} (slice 3), not from the path.</li>
 *   <li>A more-specific {@code permit} HTTP permission (see {@code application.properties}) lifts
 *       just this path out of the blanket {@code /api/* → authenticated} policy.</li>
 * </ul>
 *
 * <p>Trust is established instead by Meta's own signals: a verify-token handshake on
 * {@code GET} and an {@code X-Hub-Signature-256} HMAC over the raw body on {@code POST}. Both
 * are fail-closed — a mismatch returns 403/401 and the body is never processed.
 */
@Path("/api/v1/whatsapp/webhook")
@Tag(name = "WhatsApp Webhook", description = "Inbound Meta WhatsApp Cloud API webhook (public, signature-verified)")
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class WhatsAppWebhookResource {

    private static final Logger LOG = Logger.getLogger(WhatsAppWebhookResource.class);
    private static final String MODE_SUBSCRIBE = "subscribe";

    private final String verifyToken;
    private final String appSecret;

    @Inject
    public WhatsAppWebhookResource(
            @ConfigProperty(name = "miot.whatsapp.webhook.verify-token") String verifyToken,
            @ConfigProperty(name = "miot.whatsapp.app-secret") String appSecret) {
        this.verifyToken = verifyToken;
        this.appSecret = appSecret;
    }

    /**
     * Meta's one-time subscription handshake: echo {@code hub.challenge} verbatim (text/plain)
     * only when Meta is subscribing and presents our configured verify token.
     */
    @GET
    @Produces(MediaType.TEXT_PLAIN)
    @Operation(summary = "Verify the webhook subscription (Meta hub.challenge handshake)")
    public Response verify(
            @QueryParam("hub.mode") String mode,
            @QueryParam("hub.verify_token") String token,
            @QueryParam("hub.challenge") String challenge) {
        if (isValidHandshake(mode, token, verifyToken)) {
            return Response.ok(challenge).build();
        }
        LOG.warn("Rejected WhatsApp webhook verification handshake (mode/verify-token mismatch)");
        return Response.status(Response.Status.FORBIDDEN).build();
    }

    /**
     * Inbound events (driver messages + delivery/read status). Verifies the HMAC over the exact
     * received bytes, then always answers 200 on acceptance so Meta does not retry-storm a
     * payload we have taken — idempotent ingestion (slice 3) absorbs the at-least-once retries
     * that still occur.
     */
    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Operation(summary = "Receive inbound WhatsApp messages and status callbacks (HMAC-verified)")
    public Response receive(
            @HeaderParam("X-Hub-Signature-256") String signature,
            byte[] body) {
        if (!WhatsAppSignatureVerifier.verify(body, signature, appSecret)) {
            LOG.warn("Rejected WhatsApp webhook POST: missing or invalid X-Hub-Signature-256");
            return Response.status(Response.Status.UNAUTHORIZED).build();
        }
        // Ingestion (parse → persist → status mirroring) is wired here in slice 3.
        LOG.debugf("Accepted WhatsApp webhook POST (%d bytes)", body == null ? 0 : body.length);
        return Response.ok().build();
    }

    /**
     * The handshake is valid only when Meta is subscribing AND presents exactly our configured
     * verify token. A blank configured token never matches, so an unconfigured channel cannot be
     * verified by an empty token. Static + package-private for unit testing without HTTP.
     */
    static boolean isValidHandshake(String mode, String token, String expectedToken) {
        return MODE_SUBSCRIBE.equals(mode)
                && expectedToken != null && !expectedToken.isBlank()
                && expectedToken.equals(token);
    }
}
