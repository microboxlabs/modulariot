package com.microboxlabs.miot.integrations.api;

import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import com.microboxlabs.miot.integrations.telephony.TelephonyKeys;
import com.microboxlabs.miot.integrations.telephony.TelnyxCallEvents;
import com.microboxlabs.miot.integrations.telephony.TelnyxWebhookVerifier;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.Clock;
import java.util.Map;
import java.util.function.Function;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * Public Telnyx call-control webhook for a TELNYX connection. It sits under {@code /webhooks/*}, which needs no
 * JWT, like the WhatsApp webhook. Each delivery must carry a valid ed25519 signature made with the key whose
 * public half is in the connection's {@code metadata.webhookPublicKey}; otherwise 401 and the body is not read.
 * Set this URL as the webhook of the Telnyx Credential Connection.
 */
@Path("/webhooks/telnyx/{connectionId}")
@Tag(name = "Telnyx Webhook", description = "Telnyx call events (public, signature-verified)")
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class TelnyxWebhookResource {

    private final Function<String, IntegrationConnection> connections;
    private final TelnyxCallEvents events;
    private final Clock clock;

    @Inject
    public TelnyxWebhookResource(IntegrationConnectionRepository repository, TelnyxCallEvents events) {
        this(repository::findActiveTelnyxById, events, Clock.systemUTC());
    }

    TelnyxWebhookResource(Function<String, IntegrationConnection> connections, TelnyxCallEvents events,
            Clock clock) {
        this.connections = connections;
        this.events = events;
        this.clock = clock;
    }

    @POST
    @Consumes(MediaType.WILDCARD)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Receive a Telnyx call event (call.initiated, call.answered, call.hangup)")
    public Response receive(@PathParam("connectionId") String connectionId,
            @HeaderParam("telnyx-signature-ed25519") String signature,
            @HeaderParam("telnyx-timestamp") String timestamp, String body) {
        IntegrationConnection connection = connections.apply(connectionId);
        Object key = connection == null || connection.metadata() == null ? null
                : connection.metadata().get(TelephonyKeys.WEBHOOK_PUBLIC_KEY);
        if (connection == null || key == null) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        if (!TelnyxWebhookVerifier.verify(key.toString(), signature, timestamp, body, clock.instant())) {
            return Response.status(Response.Status.UNAUTHORIZED).build();
        }
        try {
            TelnyxCallEvents.Outcome outcome = events.apply(connection.id(), body);
            return Response.ok(Map.of("event", outcome.event())).build();
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.BAD_REQUEST).entity(Map.of("error", e.getMessage())).build();
        }
    }
}
