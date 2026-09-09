package com.microboxlabs.miot.integrations.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.domain.HarnessThread;
import com.microboxlabs.miot.integrations.domain.HarnessThreadMessage;
import com.microboxlabs.miot.integrations.domain.HarnessThreadShare;
import com.microboxlabs.miot.integrations.dto.ThreadMessageRequest;
import com.microboxlabs.miot.integrations.dto.ThreadPatchRequest;
import com.microboxlabs.miot.integrations.dto.ThreadResponse;
import com.microboxlabs.miot.integrations.dto.ThreadShareRequest;
import com.microboxlabs.miot.integrations.dto.ThreadUpsertRequest;
import com.microboxlabs.miot.integrations.persistence.HarnessThreadRepository;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class HarnessThreadServiceTest {

    private static final String TENANT = "tenant-1";
    private static final String OWNER = "owner@example.test";
    private static final String OTHER = "other@example.test";
    private static final Map<String, Object> PAYLOAD = Map.of("role", "user");

    @Test
    void aThreadIsPrivateToItsOwner() {
        var repo = new FakeRepository();
        var service = new HarnessThreadService(repo);
        String id = newThread(service, OWNER);

        assertNull(service.get(TENANT, OTHER, id), "another user must not see the thread");
        assertNull(service.listMessages(TENANT, OTHER, id, null, null));
        assertTrue(service.listVisible(TENANT, OTHER, null).isEmpty());
    }

    @Test
    void sharingGrantsReadingButNotWriting() {
        var repo = new FakeRepository();
        var service = new HarnessThreadService(repo);
        String id = newThread(service, OWNER);
        service.appendMessage(TENANT, OWNER, id, new ThreadMessageRequest("m1", null, null, PAYLOAD));

        assertNotNull(service.share(TENANT, OWNER, id, new ThreadShareRequest(OTHER, "read")));

        assertNotNull(service.get(TENANT, OTHER, id), "a shared thread is readable");
        assertEquals(1, service.listMessages(TENANT, OTHER, id, null, null).size());
        assertNull(
                service.appendMessage(TENANT, OTHER, id, new ThreadMessageRequest("m2", "m1", null, PAYLOAD)),
                "a reader must not append to someone else's conversation");
        assertNull(service.patch(TENANT, OTHER, id, new ThreadPatchRequest("mine now", null, null, null)));
        assertFalse(service.delete(TENANT, OTHER, id));
    }

    @Test
    void listingSeparatesOwnedFromShared() {
        var repo = new FakeRepository();
        var service = new HarnessThreadService(repo);
        String mine = newThread(service, OTHER);
        String theirs = newThread(service, OWNER);
        service.share(TENANT, OWNER, theirs, new ThreadShareRequest(OTHER, null));

        List<ThreadResponse> visible = service.listVisible(TENANT, OTHER, null);

        assertEquals(List.of(mine, theirs), visible.stream().map(ThreadResponse::id).toList());
        assertTrue(visible.get(0).owned());
        assertFalse(visible.get(1).owned());
        assertTrue(visible.get(1).sharedWith().isEmpty(),
                "a reader has no business enumerating the other readers");
    }

    @Test
    void theOwnerSeesWhoTheThreadIsSharedWith() {
        var repo = new FakeRepository();
        var service = new HarnessThreadService(repo);
        String id = newThread(service, OWNER);
        service.share(TENANT, OWNER, id, new ThreadShareRequest(OTHER, "read"));

        assertEquals(List.of(OTHER), service.get(TENANT, OWNER, id).sharedWith());

        assertTrue(service.revokeShare(TENANT, OWNER, id, OTHER));
        assertNull(service.get(TENANT, OTHER, id), "revoking takes the thread back out of view");
    }

    @Test
    void listingReadsEveryThreadsSharesInOneGo() {
        var repo = new FakeRepository();
        var service = new HarnessThreadService(repo);
        for (int i = 0; i < 5; i++) {
            newThread(service, OWNER);
        }

        service.listVisible(TENANT, OWNER, null);

        assertEquals(1, repo.batchedShareLookups,
                "one query for the listing, not one per thread");
    }

    @Test
    void theLimitCapsTheWholeResponse() {
        var repo = new FakeRepository();
        var service = new HarnessThreadService(repo);
        String mine = newThread(service, OTHER);
        String theirs = newThread(service, OWNER);
        service.share(TENANT, OWNER, theirs, new ThreadShareRequest(OTHER, null));

        List<ThreadResponse> visible = service.listVisible(TENANT, OTHER, 1);

        assertEquals(List.of(mine), visible.stream().map(ThreadResponse::id).toList());
    }

    @Test
    void aParentIdTooLongForTheColumnIsRejected() {
        var service = new HarnessThreadService(new FakeRepository());
        String id = newThread(service, OWNER);
        var request = new ThreadMessageRequest("m1", "p".repeat(129), null, PAYLOAD);

        assertThrows(IllegalArgumentException.class,
                () -> service.appendMessage(TENANT, OWNER, id, request));
    }

    @Test
    void payloadSizeIsMeasuredInBytesNotCharacters() {
        var service = new HarnessThreadService(new FakeRepository());
        String id = newThread(service, OWNER);
        // Three bytes each in UTF-8, so this clears the cap on length() and
        // busts it on the bytes that actually reach JSONB.
        Map<String, Object> payload = Map.of("data", "€".repeat(100 * 1024));
        var request = new ThreadMessageRequest("m1", null, null, payload);

        assertThrows(IllegalArgumentException.class,
                () -> service.appendMessage(TENANT, OWNER, id, request));
    }

    @Test
    void titlesAreCutOnCodePointBoundaries() {
        var repo = new FakeRepository();
        var service = new HarnessThreadService(repo);

        var saved = service.create(TENANT, OWNER,
                new ThreadUpsertRequest(UUID.randomUUID().toString(), "\uD83D\uDE80".repeat(400), null));

        assertEquals(280, saved.title().codePointCount(0, saved.title().length()));
        assertEquals("\uD83D\uDE80".repeat(280), saved.title());
    }

    @Test
    void creatingATakenIdIsRefusedRatherThanHijacked() {
        var repo = new FakeRepository();
        var service = new HarnessThreadService(repo);
        String id = newThread(service, OWNER);

        assertNull(service.create(TENANT, OTHER, new ThreadUpsertRequest(id, "mine", null)));
        assertEquals(OWNER, repo.threads.get(id).ownerId());
    }

    @Test
    void appendCreatesTheThreadWhenTheFirstMessageArrivesFirst() {
        var repo = new FakeRepository();
        var service = new HarnessThreadService(repo);
        String id = UUID.randomUUID().toString();

        var saved = service.appendMessage(
                TENANT, OWNER, id, new ThreadMessageRequest("m1", null, null, PAYLOAD));

        assertNotNull(saved);
        assertEquals(HarnessThreadService.DEFAULT_FORMAT, saved.format());
        assertNotNull(repo.threads.get(id), "the panel persists lazily — the row is created here");
        assertEquals(OWNER, repo.threads.get(id).ownerId());
    }

    @Test
    void expiryIsOptionalAndClearable() {
        var repo = new FakeRepository();
        var service = new HarnessThreadService(repo);
        OffsetDateTime expiry = OffsetDateTime.now().plusDays(7);
        String id = UUID.randomUUID().toString();

        assertNull(service.create(TENANT, OWNER, new ThreadUpsertRequest(id, "t", null)).expiresAt(),
                "threads do not expire unless someone says so");

        assertEquals(expiry, service.patch(TENANT, OWNER, id, new ThreadPatchRequest(null, expiry, null, null))
                .expiresAt());
        assertNull(service.patch(TENANT, OWNER, id, new ThreadPatchRequest(null, null, true, null)).expiresAt(),
                "clearExpiry is how a caller asks for 'never'");
    }

    @Test
    void oversizedPayloadsAreRefused() {
        var service = new HarnessThreadService(new FakeRepository());
        String id = newThread(service, OWNER);
        Map<String, Object> huge = Map.of("data", "x".repeat(300 * 1024));

        var request = new ThreadMessageRequest("m1", null, null, huge);
        assertThrows(IllegalArgumentException.class,
                () -> service.appendMessage(TENANT, OWNER, id, request));
    }

    @Test
    void malformedInputIsRejected() {
        var service = new HarnessThreadService(new FakeRepository());
        String id = newThread(service, OWNER);
        var emptyPayload = new ThreadMessageRequest("m1", null, null, Map.of());
        var selfShare = new ThreadShareRequest(OWNER, "read");
        var writeShare = new ThreadShareRequest(OTHER, "write");

        assertThrows(IllegalArgumentException.class,
                () -> service.get(TENANT, OWNER, "not-a-uuid"));
        assertThrows(IllegalArgumentException.class,
                () -> service.appendMessage(TENANT, OWNER, id, emptyPayload));
        assertThrows(IllegalArgumentException.class,
                () -> service.share(TENANT, OWNER, id, selfShare));
        assertThrows(IllegalArgumentException.class,
                () -> service.share(TENANT, OWNER, id, writeShare));
    }

    @Test
    void longTitlesAreTruncatedToTheColumnWidth() {
        var repo = new FakeRepository();
        var service = new HarnessThreadService(repo);

        var saved = service.create(TENANT, OWNER,
                new ThreadUpsertRequest(UUID.randomUUID().toString(), "y".repeat(400), null));

        assertEquals(280, saved.title().length());
        assertEquals("y".repeat(280), saved.title());
    }

    @Test
    void theSummaryRoundTripsAndSurvivesUnrelatedPatches() {
        var service = new HarnessThreadService(new FakeRepository());
        String id = newThread(service, OWNER);

        assertNull(service.get(TENANT, OWNER, id).summary(), "nothing compacted yet");
        assertEquals("so far: trips", service.patch(TENANT, OWNER, id,
                new ThreadPatchRequest(null, null, null, "so far: trips")).summary());
        assertEquals("so far: trips", service.patch(TENANT, OWNER, id,
                new ThreadPatchRequest("renamed", null, null, null)).summary(),
                "a patch that says nothing about the summary leaves it alone");
        assertEquals("so far: trips", service.listVisible(TENANT, OWNER, null).get(0).summary());
    }

    @Test
    void aSummaryLongerThanTheHarnessAcceptsIsRefused() {
        var service = new HarnessThreadService(new FakeRepository());
        String id = newThread(service, OWNER);
        var request = new ThreadPatchRequest(null, null, null, "s".repeat(8_001));

        assertThrows(IllegalArgumentException.class, () -> service.patch(TENANT, OWNER, id, request));
    }

    @Test
    void messagesPageFromTheLastSeqTheCallerHolds() {
        var service = new HarnessThreadService(new FakeRepository());
        String id = newThread(service, OWNER);
        for (int i = 1; i <= 5; i++) {
            service.appendMessage(TENANT, OWNER, id, new ThreadMessageRequest("m" + i, null, null, PAYLOAD));
        }

        List<HarnessThreadMessage> first = service.listMessages(TENANT, OWNER, id, null, 2);
        assertEquals(List.of("m1", "m2"), first.stream().map(HarnessThreadMessage::id).toList());

        long cursor = first.get(first.size() - 1).seq();
        List<HarnessThreadMessage> second = service.listMessages(TENANT, OWNER, id, cursor, 2);
        assertEquals(List.of("m3", "m4"), second.stream().map(HarnessThreadMessage::id).toList());

        List<HarnessThreadMessage> last = service.listMessages(TENANT, OWNER, id, second.get(1).seq(), 2);
        assertEquals(List.of("m5"), last.stream().map(HarnessThreadMessage::id).toList(),
                "a short page is the last one");

        assertEquals(5, service.listMessages(TENANT, OWNER, id, -7L, 5_000).size(),
                "a negative cursor reads from the start and an oversized page is capped, not refused");
    }

    private static String newThread(HarnessThreadService service, String owner) {
        String id = UUID.randomUUID().toString();
        service.create(TENANT, owner, new ThreadUpsertRequest(id, "chat", null));
        return id;
    }

    /** In-memory stand-in with the same visibility rules the SQL enforces. */
    private static class FakeRepository extends HarnessThreadRepository {
        final Map<String, HarnessThread> threads = new LinkedHashMap<>();
        final Map<String, List<HarnessThreadMessage>> messages = new LinkedHashMap<>();
        final Map<String, List<HarnessThreadShare>> shares = new LinkedHashMap<>();
        int batchedShareLookups;
        long nextSeq;

        FakeRepository() {
            super(null);
        }

        @Override
        public HarnessThread upsert(HarnessThread thread) {
            HarnessThread existing = threads.get(thread.id());
            if (existing != null) {
                if (!Objects.equals(existing.ownerId(), thread.ownerId())
                        || !Objects.equals(existing.tenantCode(), thread.tenantCode())) {
                    return null;
                }
                HarnessThread renamed = new HarnessThread(
                        existing.id(), existing.tenantCode(), existing.ownerId(),
                        thread.title() == null ? existing.title() : thread.title(),
                        existing.summary(), existing.expiresAt(), existing.lastMessageAt(),
                        existing.createdAt(), OffsetDateTime.now());
                threads.put(renamed.id(), renamed);
                return renamed;
            }
            OffsetDateTime now = OffsetDateTime.now();
            HarnessThread created = new HarnessThread(
                    thread.id(), thread.tenantCode(), thread.ownerId(), thread.title(),
                    thread.summary(), thread.expiresAt(), now, now, now);
            threads.put(created.id(), created);
            return created;
        }

        @Override
        public List<HarnessThread> listOwned(String tenantCode, String ownerId, int limit) {
            return threads.values().stream()
                    .filter(t -> Objects.equals(t.tenantCode(), tenantCode))
                    .filter(t -> Objects.equals(t.ownerId(), ownerId))
                    .limit(limit)
                    .toList();
        }

        @Override
        public List<HarnessThread> listSharedWith(String tenantCode, String principal, int limit) {
            return threads.values().stream()
                    .filter(t -> Objects.equals(t.tenantCode(), tenantCode))
                    .filter(t -> listShares(t.id()).stream()
                            .anyMatch(s -> Objects.equals(s.principal(), principal)))
                    .limit(limit)
                    .toList();
        }

        @Override
        public HarnessThread find(String threadId, String tenantCode) {
            HarnessThread thread = threads.get(threadId);
            return thread != null && Objects.equals(thread.tenantCode(), tenantCode) ? thread : null;
        }

        @Override
        public HarnessThread update(
                String threadId, String ownerId, String title,
                OffsetDateTime expiresAt, boolean clearExpiry, String summary) {
            HarnessThread thread = threads.get(threadId);
            if (thread == null || !Objects.equals(thread.ownerId(), ownerId)) {
                return null;
            }
            HarnessThread updated = new HarnessThread(
                    thread.id(), thread.tenantCode(), thread.ownerId(),
                    title == null ? thread.title() : title,
                    summary == null ? thread.summary() : summary,
                    clearExpiry ? null : (expiresAt == null ? thread.expiresAt() : expiresAt),
                    thread.lastMessageAt(), thread.createdAt(), OffsetDateTime.now());
            threads.put(updated.id(), updated);
            return updated;
        }

        @Override
        public boolean softDelete(String threadId, String tenantCode, String ownerId) {
            HarnessThread thread = find(threadId, tenantCode);
            if (thread == null || !Objects.equals(thread.ownerId(), ownerId)) {
                return false;
            }
            threads.remove(threadId);
            return true;
        }

        @Override
        public HarnessThreadMessage appendMessage(HarnessThreadMessage message) {
            List<HarnessThreadMessage> stored = messages.computeIfAbsent(
                    message.threadId(), k -> new ArrayList<>());
            HarnessThreadMessage numbered = new HarnessThreadMessage(
                    message.threadId(), message.id(), message.parentId(), message.format(),
                    message.payload(), ++nextSeq, message.createdAt());
            stored.add(numbered);
            return numbered;
        }

        @Override
        public List<HarnessThreadMessage> listMessages(String threadId, long afterSeq, int limit) {
            return messages.getOrDefault(threadId, List.of()).stream()
                    .filter(m -> m.seq() > afterSeq)
                    .limit(limit)
                    .toList();
        }

        @Override
        public HarnessThreadShare upsertShare(HarnessThreadShare share) {
            List<HarnessThreadShare> current =
                    shares.computeIfAbsent(share.threadId(), k -> new ArrayList<>());
            current.removeIf(s -> Objects.equals(s.principal(), share.principal()));
            current.add(share);
            return share;
        }

        @Override
        public boolean deleteShare(String threadId, String principal) {
            return shares.getOrDefault(threadId, new ArrayList<>())
                    .removeIf(s -> Objects.equals(s.principal(), principal));
        }

        @Override
        public List<HarnessThreadShare> listShares(String threadId) {
            return List.copyOf(shares.getOrDefault(threadId, List.of()));
        }

        @Override
        public Map<String, List<HarnessThreadShare>> listSharesFor(List<String> threadIds) {
            batchedShareLookups++;
            Map<String, List<HarnessThreadShare>> out = new LinkedHashMap<>();
            for (String id : threadIds) {
                List<HarnessThreadShare> current = shares.get(id);
                if (current != null && !current.isEmpty()) {
                    out.put(id, List.copyOf(current));
                }
            }
            return out;
        }
    }
}
