package com.microboxlabs.miot.integrations.telephony;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.core.telephony.PstnCall;
import com.microboxlabs.miot.core.telephony.PstnCall.Report;
import com.microboxlabs.miot.core.telephony.TelephonyThrottledException;
import com.microboxlabs.miot.core.telephony.TelephonyUnavailableException;
import com.microboxlabs.miot.integrations.auth.AuthResolutionException;
import com.microboxlabs.miot.integrations.auth.CredentialAuthRegistry;
import com.microboxlabs.miot.integrations.auth.CredentialAuthContext;
import com.microboxlabs.miot.integrations.auth.oauth.OAuth2CredentialConfigs;
import com.microboxlabs.miot.integrations.domain.AuthType;
import com.microboxlabs.miot.integrations.net.OutboundUrlGuard;
import java.net.URI;
import java.util.function.Consumer;
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
import java.time.Duration;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.BiFunction;

/**
 * Reads PSTN call records through a TEAMS_PHONE connection: an app token from its Entra credential, then both
 * Graph reports for the window, {@code getPstnCalls} (Calling Plans, Operator Connect) and
 * {@code getDirectRoutingCalls} (the organization's own carrier), each following at most {@link #MAX_PAGES} pages.
 * A 404 means the records are not there yet and counts as an empty report. Any other failure of either report
 * fails the lookup, since a match needs the complete list. A 429, or a 503 with {@code Retry-After}, fails it with
 * {@link TelephonyThrottledException} carrying the wait Graph asked for.
 */
@ApplicationScoped
public class TeamsCallRecords {

    static final int MAX_PAGES = 5;
    static final Duration DEFAULT_RETRY_AFTER = Duration.ofMinutes(1);
    static final Duration MAX_RETRY_AFTER = Duration.ofHours(1);

    private final BiFunction<String, String, IntegrationConnection> connections;
    private final BiFunction<String, IntegrationConnection, ResolvedConnection> resolver;
    private final CredentialAuthRegistry auth;
    private final GraphClient graph;
    private final ObjectMapper json;
    private final Consumer<URI> tokenUrlGuard;

    @Inject
    public TeamsCallRecords(IntegrationConnectionRepository repository, IntegrationConnectionResolver resolver,
            CredentialAuthRegistry auth, GraphClient graph, ObjectMapper json) {
        this(repository::findByTenantAndId, resolver::resolve, auth, graph, json);
    }

    public TeamsCallRecords(BiFunction<String, String, IntegrationConnection> connections,
            BiFunction<String, IntegrationConnection, ResolvedConnection> resolver, CredentialAuthRegistry auth,
            GraphClient graph, ObjectMapper json) {
        this(connections, resolver, auth, graph, json,
                url -> OutboundUrlGuard.requirePublicHttpUrl(url, "tokenUrl"));
    }

    TeamsCallRecords(BiFunction<String, String, IntegrationConnection> connections,
            BiFunction<String, IntegrationConnection, ResolvedConnection> resolver, CredentialAuthRegistry auth,
            GraphClient graph, ObjectMapper json, Consumer<URI> tokenUrlGuard) {
        this.tokenUrlGuard = tokenUrlGuard;
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
            CredentialAuthContext context = resolved.authContext();
            TeamsAppToken.problem(context.credentialType(), context.publicConfig()).ifPresent(problem -> {
                throw new TelephonyUnavailableException(problem);
            });
            tokenUrlGuard.accept(OAuth2CredentialConfigs.tokenUrl(context.credentialType(), context.publicConfig()));
            headers = TeamsAppToken.headers(auth, new CredentialAuthContext(AuthType.OAUTH2_CLIENT_CREDENTIALS,
                    context.credentialType(), context.publicConfig(), context.secret()));
        } catch (ConnectionResolutionException | AuthResolutionException | IllegalStateException
                | IllegalArgumentException e) {
            throw new TelephonyUnavailableException("Microsoft Entra did not issue a token: " + e.getMessage());
        }
        try {
            List<PstnCall> calls = new ArrayList<>(read(Report.PSTN, headers, from, to));
            calls.addAll(read(Report.DIRECT_ROUTING, headers, from, to));
            return List.copyOf(calls);
        } catch (IOException e) {
            throw new TelephonyUnavailableException("Could not reach Microsoft Graph: " + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new TelephonyUnavailableException("The Graph request was interrupted");
        }
    }

    private List<PstnCall> read(Report report, Map<String, String> headers, Instant from, Instant to)
            throws IOException, InterruptedException {
        String name = report == Report.PSTN ? "PSTN" : "Direct Routing";
        List<PstnCall> calls = new ArrayList<>();
        HttpResponse<String> response = report == Report.PSTN ? graph.pstnCalls(headers, from, to)
                : graph.directRoutingCalls(headers, from, to);
        for (int page = 0; page < MAX_PAGES; page++) {
            if (notPublished(response, page, name)) {
                return calls;
            }
            JsonNode body = callList(response, name);
            for (JsonNode row : body.path("value")) {
                calls.add(report == Report.PSTN ? pstnCall(row) : directRoutingCall(row));
            }
            String next = body.path("@odata.nextLink").asText("");
            if (next.isBlank()) {
                break;
            }
            if (page + 1 == MAX_PAGES) {
                throw new TelephonyUnavailableException(TelephonyUnavailableException.CALL_RECORDS_PAGE_LIMIT,
                        "The Graph " + name + " lookup exceeded its page limit;"
                        + " reconciliation requires a complete call list");
            }
            response = graph.next(headers, next);
        }
        return calls;
    }

    private static boolean notPublished(HttpResponse<String> response, int page, String name) {
        if (response.statusCode() != 404) {
            return false;
        }
        if (page > 0) {
            throw new TelephonyUnavailableException("Graph returned HTTP 404 for a later " + name
                    + " page; reconciliation requires a complete call list");
        }
        return true;
    }

    private JsonNode callList(HttpResponse<String> response, String name) {
        int status = response.statusCode();
        Optional<String> retryAfter = response.headers().firstValue("Retry-After");
        if (status == 429 || (status == 503 && retryAfter.isPresent())) {
            throw new TelephonyThrottledException("Graph returned HTTP " + status + " for the " + name
                    + " calls: throttled", retryAfter(retryAfter.orElse(null), Instant.now()));
        }
        if (status == 401 || status == 403) {
            throw new TelephonyUnavailableException("Graph returned HTTP " + status + " for the " + name
                    + " calls: the app needs CallRecords.Read.All");
        }
        if (status < 200 || status >= 300) {
            throw new TelephonyUnavailableException("Graph returned HTTP " + status + " for the " + name + " calls");
        }
        JsonNode body = parse(response.body());
        if (body == null || !body.path("value").isArray()) {
            throw new TelephonyUnavailableException("Graph returned an invalid " + name + " call list");
        }
        return body;
    }

    /** {@code Retry-After} as seconds or an HTTP date; one minute when absent or unreadable, at most one hour. */
    static Duration retryAfter(String value, Instant now) {
        Duration wait = DEFAULT_RETRY_AFTER;
        if (value != null && !value.isBlank()) {
            String v = value.trim();
            try {
                wait = Duration.ofSeconds(Long.parseLong(v));
            } catch (NumberFormatException notSeconds) {
                try {
                    wait = Duration.between(now, ZonedDateTime.parse(v, DateTimeFormatter.RFC_1123_DATE_TIME));
                } catch (DateTimeParseException notADate) {
                    wait = DEFAULT_RETRY_AFTER;
                }
            }
        }
        if (wait.compareTo(Duration.ofSeconds(1)) < 0) {
            return Duration.ofSeconds(1);
        }
        return wait.compareTo(MAX_RETRY_AFTER) > 0 ? MAX_RETRY_AFTER : wait;
    }

    private static PstnCall pstnCall(JsonNode row) {
        return new PstnCall(text(row, "id"), text(row, "callId"), text(row, "userPrincipalName"),
                number(text(row, "callerNumber")), number(text(row, "calleeNumber")), time(row, "startDateTime"),
                time(row, "endDateTime"), row.path("duration").asInt(0), text(row, "callType"));
    }

    /**
     * A {@code directRoutingLogRow}. Its {@code duration} runs from the invite, ringing included, so the connected
     * seconds are taken from {@code startDateTime} (the answer) to {@code endDateTime} of a successful call; a
     * failed call connected 0 seconds and ended at {@code failureDateTime}.
     */
    static PstnCall directRoutingCall(JsonNode row) {
        JsonNode success = row.path("successfulCall");
        Boolean answered = success.isBoolean() ? success.asBoolean() : null;
        Instant start = time(row, "startDateTime");
        Instant end = time(row, "endDateTime");
        int seconds = row.path("duration").asInt(0);
        if (Boolean.FALSE.equals(answered)) {
            seconds = 0;
        } else if (Boolean.TRUE.equals(answered) && start != null && end != null && !end.isBefore(start)) {
            seconds = (int) Duration.between(start, end).toSeconds();
        }
        return new PstnCall(text(row, "id"), text(row, "correlationId"), text(row, "userPrincipalName"),
                number(text(row, "callerNumber")), number(text(row, "calleeNumber")),
                start != null ? start : time(row, "inviteDateTime"),
                end != null ? end : time(row, "failureDateTime"), seconds, text(row, "callType"), answered,
                Report.DIRECT_ROUTING);
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

    private JsonNode parse(String body) {
        try {
            return json.readTree(body == null ? "{}" : body);
        } catch (IOException e) {
            throw new TelephonyUnavailableException("Graph returned a body that is not JSON");
        }
    }
}
