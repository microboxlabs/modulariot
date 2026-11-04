package com.microboxlabs.miot.integrations.telephony;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.core.telephony.PstnCall;
import com.microboxlabs.miot.core.telephony.TelephonyUnavailableException;
import com.microboxlabs.miot.integrations.auth.AuthResolutionException;
import com.microboxlabs.miot.integrations.auth.CredentialAuthRegistry;
import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import com.microboxlabs.miot.integrations.service.ConnectionResolutionException;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionResolver;
import com.microboxlabs.miot.integrations.service.ResolvedConnection;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.BiFunction;

/**
 * Reads PSTN call records through a TEAMS_PHONE connection: an app token from its Entra credential, then
 * {@code getPstnCalls} for the window, following at most {@link #MAX_PAGES} pages. A 404 means the records
 * are not there yet and answers an empty list.
 */
@ApplicationScoped
public class TeamsCallRecords {

    static final int MAX_PAGES = 5;

    private final BiFunction<String, String, IntegrationConnection> connections;
    private final BiFunction<String, IntegrationConnection, ResolvedConnection> resolver;
    private final CredentialAuthRegistry auth;
    private final GraphClient graph;
    private final ObjectMapper json;

    @Inject
    public TeamsCallRecords(IntegrationConnectionRepository repository, IntegrationConnectionResolver resolver,
            CredentialAuthRegistry auth, GraphClient graph, ObjectMapper json) {
        this(repository::findByTenantAndId, resolver::resolve, auth, graph, json);
    }

    public TeamsCallRecords(BiFunction<String, String, IntegrationConnection> connections,
            BiFunction<String, IntegrationConnection, ResolvedConnection> resolver, CredentialAuthRegistry auth,
            GraphClient graph, ObjectMapper json) {
        this.connections = connections;
        this.resolver = resolver;
        this.auth = auth;
        this.graph = graph;
        this.json = json;
    }

    public List<PstnCall> pstnCalls(String tenantCode, String connectionId, Instant from, Instant to) {
        IntegrationConnection connection = connections.apply(tenantCode, connectionId);
        if (connection == null || connection.providerType() != ProviderType.TEAMS_PHONE) {
            throw new TelephonyUnavailableException("The organization has no Teams Phone connection");
        }
        if (connection.status() != ConnectionStatus.ACTIVE) {
            throw new TelephonyUnavailableException("The Teams Phone connection has not passed its test");
        }
        if (!graph.serves(connection.baseUrl())) {
            throw new TelephonyUnavailableException("The Teams Phone connection must use " + graph.baseUrl());
        }
        Map<String, String> headers;
        try {
            ResolvedConnection resolved = resolver.apply(tenantCode, connection);
            headers = TeamsAppToken.headers(auth, resolved.authContext());
        } catch (ConnectionResolutionException | AuthResolutionException | IllegalStateException
                | IllegalArgumentException e) {
            throw new TelephonyUnavailableException("Microsoft Entra did not issue a token: " + e.getMessage());
        }
        try {
            List<PstnCall> calls = new ArrayList<>();
            HttpResponse<String> response = graph.pstnCalls(headers, from, to);
            for (int page = 0; page < MAX_PAGES; page++) {
                int status = response.statusCode();
                if (status == 404) {
                    return List.copyOf(calls);
                }
                if (status == 401 || status == 403) {
                    throw new TelephonyUnavailableException(
                            "Graph returned HTTP " + status + ": the app needs CallRecords.Read.All");
                }
                if (status < 200 || status >= 300) {
                    throw new TelephonyUnavailableException("Graph returned HTTP " + status + " for the PSTN calls");
                }
                JsonNode body = read(response.body());
                for (JsonNode row : body.path("value")) {
                    calls.add(call(row));
                }
                String next = body.path("@odata.nextLink").asText("");
                if (next.isBlank()) {
                    break;
                }
                response = graph.next(headers, next);
            }
            return List.copyOf(calls);
        } catch (IOException e) {
            throw new TelephonyUnavailableException("Could not reach Microsoft Graph: " + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new TelephonyUnavailableException("The Graph request was interrupted");
        }
    }

    private static PstnCall call(JsonNode row) {
        return new PstnCall(text(row, "id"), text(row, "callId"), text(row, "userPrincipalName"),
                number(text(row, "callerNumber")), number(text(row, "calleeNumber")), time(row, "startDateTime"),
                time(row, "endDateTime"), row.path("duration").asInt(0), text(row, "callType"));
    }

    private static String number(String value) {
        String e164 = PhoneNumbers.e164(value);
        return e164 != null ? e164 : value;
    }

    private static String text(JsonNode row, String field) {
        JsonNode value = row.path(field);
        return value.isMissingNode() || value.isNull() ? null : value.asText();
    }

    private static Instant time(JsonNode row, String field) {
        String value = text(row, field);
        try {
            return value == null ? null : Instant.parse(value);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private JsonNode read(String body) {
        try {
            return json.readTree(body == null ? "{}" : body);
        } catch (IOException e) {
            throw new TelephonyUnavailableException("Graph returned a body that is not JSON");
        }
    }
}
