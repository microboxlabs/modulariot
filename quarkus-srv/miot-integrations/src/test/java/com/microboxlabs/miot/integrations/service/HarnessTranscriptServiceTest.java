package com.microboxlabs.miot.integrations.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.domain.HarnessThreadMessage;
import com.microboxlabs.miot.integrations.domain.HarnessThreadShare;
import com.microboxlabs.miot.integrations.domain.ShareLink;
import com.microboxlabs.miot.integrations.dto.TranscriptDtos.ToolSummary;
import com.microboxlabs.miot.integrations.dto.TranscriptDtos.Transcript;
import com.microboxlabs.miot.integrations.dto.TranscriptDtos.TranscriptMessage;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class HarnessTranscriptServiceTest {

    private static final String TENANT = "tenant-1";
    private static final String TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz012345";
    private static final String CALLER = "trainer@example.test";
    private static final String OTHER = "someone@example.test";

    private final InMemoryStories store = new InMemoryStories();
    private final HarnessTranscriptService service = new HarnessTranscriptService(store.threads, store.links);

    @Test
    void aThreadBecomesTextAndToolCallsWithoutReasoning() {
        String id = thread(CALLER);
        message(id, "m1", null, Map.of("role", "user",
                "content", List.of(Map.of("type", "text", "text", "how many trips today?"))));
        message(id, "m2", "m1", Map.of("role", "assistant", "content", List.of(
                Map.of("type", "reasoning", "text", "let me think"),
                Map.of("type", "tool-call", "toolName", "query", "args", Map.of("sql", "select 1"),
                        "result", "x".repeat(900)),
                Map.of("type", "text", "text", "41 trips"))));

        Transcript transcript = service.transcript(TENANT, CALLER, id);

        assertEquals(id, transcript.threadId());
        assertEquals("Trips", transcript.title());
        assertEquals(0, transcript.omittedMessages());
        assertEquals(2, transcript.messages().size());
        assertEquals(new TranscriptMessage("user", "how many trips today?", List.of()),
                transcript.messages().get(0));
        TranscriptMessage answer = transcript.messages().get(1);
        assertEquals("assistant", answer.role());
        assertEquals("41 trips", answer.text());
        ToolSummary tool = answer.tools().get(0);
        assertEquals("query", tool.name());
        assertEquals("{\"sql\":\"select 1\"}", tool.argsSummary());
        assertEquals(HarnessTranscriptService.MAX_RESULT_CHARS, tool.resultSummary().length());
        assertTrue(tool.resultSummary().endsWith("…"));
    }

    @Test
    void aShareLinkOpensTheThreadItPointsTo() {
        String id = thread(OTHER);
        message(id, "m1", null, Map.of("role", "user", "content", "plain text"));
        store.links.rows.put(TOKEN, new ShareLink(
                TOKEN, TENANT, ShareLink.THREAD, id, "org", "someone@example.test", OffsetDateTime.now()));

        assertEquals("plain text", service.transcript(TENANT, CALLER, TOKEN).messages().get(0).text());

        store.links.revoked.add(TOKEN);
        assertNull(service.transcript(TENANT, CALLER, TOKEN), "a revoked link opens nothing");
    }

    @Test
    void byIdAnotherMembersPrivateThreadIsNotFoundUntilSharedWithTheCaller() {
        String id = thread(OTHER);
        message(id, "m1", null, text("user", "private question"));

        assertNull(service.transcript(TENANT, CALLER, id), "a trainer does not read others' private chats");

        store.threads.shares.put(id, List.of(new HarnessThreadShare(id, CALLER, "read", OTHER, null)));
        assertEquals("private question", service.transcript(TENANT, CALLER, id).messages().get(0).text());
    }

    @Test
    void anotherTenantsThreadOrLinkIsNotFound() {
        String id = thread(CALLER);
        store.links.rows.put(TOKEN, new ShareLink(
                TOKEN, "tenant-2", ShareLink.THREAD, id, "org", "someone@example.test", OffsetDateTime.now()));

        assertNull(service.transcript("tenant-2", CALLER, id));
        assertNull(service.transcript(TENANT, CALLER, TOKEN));
        assertNull(service.transcript(TENANT, CALLER, "not a ref!"));
    }

    @Test
    void onlyTheBranchTheThreadEndsOnIsRead() {
        String id = thread(CALLER);
        message(id, "m1", null, text("user", "question"));
        message(id, "m2", "m1", text("assistant", "first answer"));
        message(id, "m3", "m1", text("assistant", "regenerated answer"));

        List<String> texts = service.transcript(TENANT, CALLER, id).messages().stream()
                .map(TranscriptMessage::text).toList();

        assertEquals(List.of("question", "regenerated answer"), texts);
    }

    @Test
    void theOldestTurnsGoFirstWhenTheTranscriptIsTooLong() {
        String id = thread(CALLER);
        String parent = null;
        for (int i = 0; i < 10; i++) {
            String messageId = "m" + i;
            message(id, messageId, parent, text("user", i + "-" + "y".repeat(9_998)));
            parent = messageId;
        }

        Transcript transcript = service.transcript(TENANT, CALLER, id);

        assertEquals(6, transcript.messages().size());
        assertEquals(4, transcript.omittedMessages());
        assertTrue(transcript.messages().get(0).text().startsWith("4-"));
        assertTrue(transcript.messages().get(5).text().startsWith("9-"));
    }

    @Test
    void aSingleOversizedMessageIsCutRatherThanDropped() {
        String id = thread(CALLER);
        message(id, "m1", null, text("assistant", "z".repeat(HarnessTranscriptService.MAX_CHARS * 2)));

        Transcript transcript = service.transcript(TENANT, CALLER, id);

        assertEquals(1, transcript.messages().size());
        assertEquals(HarnessTranscriptService.MAX_CHARS, transcript.messages().get(0).text().length());
    }

    private String thread(String owner) {
        String id = UUID.randomUUID().toString();
        store.threads.add(id, TENANT, owner, "Trips");
        return id;
    }

    private void message(String threadId, String id, String parentId, Map<String, Object> payload) {
        List<HarnessThreadMessage> list = store.threads.messages.computeIfAbsent(threadId, k -> new ArrayList<>());
        list.add(new HarnessThreadMessage(threadId, id, parentId, "aui-v1", payload, list.size() + 1L,
                OffsetDateTime.now()));
    }

    private static Map<String, Object> text(String role, String value) {
        return Map.of("role", role, "content", List.of(Map.of("type", "text", "text", value)));
    }
}
