package com.microboxlabs.miot.integrations.telephony;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.core.auth.PlatformScope;
import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.service.ResolvedConnection;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class TelnyxUsageReconcilerTest {
    private static final Instant NOW = Instant.parse("2026-11-04T10:00:00Z");
    private final InMemoryTelephonyUsageStore usage = new InMemoryTelephonyUsageStore();
    private final List<Integer> pages = new ArrayList<>();
    private final List<String> queries = new ArrayList<>();
    private int failurePage = -1;
    private int insertedPages;
    private boolean malformed;
    private final IntegrationConnection connection = new IntegrationConnection("p1", PlatformScope.TENANT, "Line",
            ProviderType.TELNYX, URI.create("https://api.telnyx.test"), "cred", ConnectionStatus.ACTIVE, null, null, Map.of());

    private final TelephonyHttp http = request -> {
        String query = URLDecoder.decode(request.uri().getRawQuery(), StandardCharsets.UTF_8);
        queries.add(query);
        int page = Integer.parseInt(query.split("page\\[number]=")[1].split("&")[0]);
        pages.add(page);
        // 1,000 unrelated account records fill pages 1..20. The managed record is on page 21.
        String cdr = "{\"id\":\"cdr-" + page + "\",\"connection_id\":\"" + (page == 21 + insertedPages ? "sip-1" : "other")
                + "\",\"auth_username\":\"login\",\"cld\":\"56911111111\",\"started_at\":\"2026-11-04T09:00:00Z\","
                + "\"finished_at\":\"2026-11-04T09:01:00Z\",\"answered_at\":\"2026-11-04T09:00:00Z\",\"call_sec\":60,\"cost\":\"0.2\",\"currency\":\"USD\"}";
        String body = malformed ? "{\"data\":[]}" : "{\"data\":[" + String.join(",", java.util.Collections.nCopies(page < 21 ? 50 : 1, cdr))
                + "],\"meta\":{\"total_pages\":" + (25 + insertedPages) + "}}";
        return new StubHttp().reply("/v2/detail_records", page == failurePage ? 503 : 200, body).send(request);
    };

    private TelnyxUsageReconciler reconciler(Instant now) {
        return new TelnyxUsageReconciler(t -> connection,
                (t, c) -> new ResolvedConnection(c.id(), c.baseUrl(), Map.of("sipConnectionId", "sip-1"), Map.of("token", "KEY_test")),
                new TelnyxClient(http, connection.baseUrl()), usage, new ObjectMapper(), Clock.fixed(now, ZoneOffset.UTC), true);
    }

    @Test
    void boundedRunsResumeBeyondAThousandRecordsAfterAProcessRestart() {
        usage.saveCredential("login", "acme", "cred", "sip-1");
        var first = reconciler(NOW).run();
        assertTrue(first.incomplete());
        assertEquals(21, first.nextPage());
        assertEquals(20, pages.size());
        assertTrue(usage.rows("acme", NOW.minusSeconds(7200), NOW).isEmpty());
        pages.clear();

        var afterRestart = reconciler(NOW.plusSeconds(24 * 3600)).run();
        assertEquals(List.of(21, 22, 23, 24, 25), pages);
        assertFalse(afterRestart.incomplete());
        assertEquals(1, afterRestart.created());
        assertEquals(1, usage.rows("acme", NOW.minusSeconds(7200), NOW).size());
        assertEquals(1, usage.billedMinutes("acme", NOW.minusSeconds(7200), NOW));
        assertTrue(queries.get(20).contains("last_4_days"), "the unfinished scan keeps its oldest day in scope");
        assertTrue(queries.get(20).contains("sort=-started_at"));
        assertTrue(usage.reconcileCursor("p1").isEmpty(), "completed scans restart to pick up late records");
    }

    @Test
    void aFailedPageIsRetriedWithoutLosingCompletedProgress() {
        failurePage = 3;
        assertEquals(3, reconciler(NOW).run().nextPage());
        assertEquals(List.of(1, 2, 3), pages);
        pages.clear();
        failurePage = -1;
        var retry = reconciler(NOW).run();
        assertEquals(3, pages.getFirst());
        assertEquals(23, retry.nextPage());
        assertTrue(retry.incomplete());
    }

    @Test
    void missingPaginationMetadataReportsAnIncompleteScan() {
        malformed = true;
        var result = reconciler(NOW).run();
        assertTrue(result.incomplete());
        assertEquals(1, result.nextPage());
        assertEquals(1, usage.reconcileCursor("p1").orElseThrow().nextPage());
    }

    @Test
    void newRecordsAtTheFrontRepeatPagesWithoutSkippingUnvisitedCalls() {
        usage.saveCredential("login", "acme", "cred", "sip-1");
        reconciler(NOW).run();
        insertedPages = 1;
        pages.clear();
        var next = reconciler(NOW.plusSeconds(15 * 60)).run();
        assertEquals(List.of(21, 22, 23, 24, 25, 26), pages);
        assertEquals(1, next.created());
        assertFalse(next.incomplete());
        assertTrue(queries.get(20).contains("last_4_days"), "even a partial-day delay cannot age out the initial lookback");
        assertTrue(queries.get(20).contains("sort=-started_at"), "new records must enter before the cursor, not shift unvisited rows past it");
    }
}
