package com.microboxlabs.miot.core.content;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class ContentServiceTest {

    private static final byte[] PDF = "%PDF-1.7 manifest signed by the receiver".getBytes(StandardCharsets.UTF_8);
    private static final Instant NOW = Instant.parse("2026-10-26T12:00:00Z");

    @TempDir
    Path root;

    private final Rows store = new Rows();

    private ContentService service(long maxBytes, Instant now) {
        return new ContentService(store, List.of(new FileContentDriver(root)), "fs", maxBytes,
                ContentService.DEFAULT_TYPES, Duration.ofHours(24), Clock.fixed(now, ZoneOffset.UTC));
    }

    @Test
    void storesTheFileByTenantAndDayWithItsSizeAndDigest() throws Exception {
        Content c = service(1024, NOW).write("t1", "user:a", "manifest.pdf", "application/pdf",
                new ByteArrayInputStream(PDF));

        assertTrue(c.contentUrl().startsWith("fs://t1/2026/10/26/"));
        assertEquals(PDF.length, c.size());
        assertEquals(HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(PDF)), c.sha256());
        assertEquals("manifest.pdf", c.name());
        assertNull(c.owner());
        try (InputStream in = service(1024, NOW).open("t1", UUID.fromString(c.id())).stream()) {
            assertArrayEquals(PDF, in.readAllBytes());
        }
        assertThrows(NoSuchElementException.class, () -> service(1024, NOW).open("t2", UUID.fromString(c.id())));
    }

    @Test
    void refusesOtherTypesBytesThatDoNotMatchAndLargeFiles() throws IOException {
        ContentService s = service(PDF.length - 1L, NOW);

        assertThrows(IllegalArgumentException.class, () -> s.write("t1", "u", "a.html", "text/html",
                new ByteArrayInputStream("<html>".getBytes(StandardCharsets.UTF_8))));
        assertThrows(IllegalArgumentException.class, () -> s.write("t1", "u", "a.png", "image/png",
                new ByteArrayInputStream(PDF)));
        IllegalArgumentException large = assertThrows(IllegalArgumentException.class,
                () -> s.write("t1", "u", "a.pdf", "application/pdf", new ByteArrayInputStream(PDF)));
        assertTrue(large.getMessage().contains("larger"));
        assertTrue(store.rows.isEmpty());
        try (Stream<Path> files = Files.walk(root)) {
            assertEquals(0, files.filter(Files::isRegularFile).count());
        }
    }

    @Test
    void deletesUnownedContentAfterTheGracePeriod() {
        Content kept = service(1024, NOW).write("t1", "u", "a.pdf", "application/pdf", new ByteArrayInputStream(PDF));
        Content dropped = service(1024, NOW).write("t1", "u", "b.pdf", "application/pdf",
                new ByteArrayInputStream(PDF));
        service(1024, NOW).owner("t1", UUID.fromString(kept.id()), "trips:delivery_proof:1");

        assertEquals(0, service(1024, NOW.plus(Duration.ofHours(23))).deleteUnowned(10));
        assertEquals(1, service(1024, NOW.plus(Duration.ofHours(25))).deleteUnowned(10));

        FileContentDriver fs = new FileContentDriver(root);
        assertTrue(fs.exists(kept.contentUrl()));
        assertFalse(fs.exists(dropped.contentUrl()));
        assertThrows(NoSuchElementException.class,
                () -> service(1024, NOW).owner("t1", UUID.fromString(dropped.id()), "x"));
    }

    @Test
    void theFileDriverStaysInsideItsRoot() {
        FileContentDriver fs = new FileContentDriver(root);

        assertThrows(IllegalArgumentException.class,
                () -> fs.write("../escape", new ByteArrayInputStream(PDF), "application/pdf"));
        assertThrows(IllegalArgumentException.class, () -> fs.read("fs://../../etc/passwd"));
        assertThrows(IllegalArgumentException.class, () -> fs.read("gcs://bucket/x"));
    }

    @Test
    void recognizesTheAcceptedTypesByTheirFirstBytes() {
        assertTrue(ContentService.matches("image/jpeg", new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0}));
        assertTrue(ContentService.matches("image/png", new byte[] {(byte) 0x89, 'P', 'N', 'G'}));
        assertTrue(ContentService.matches("image/webp", "RIFF0000WEBPVP8 ".getBytes(StandardCharsets.US_ASCII)));
        assertTrue(ContentService.matches("image/heic", "0000ftypheic".getBytes(StandardCharsets.US_ASCII)));
        assertFalse(ContentService.matches("image/jpeg", PDF));
        assertFalse(ContentService.matches("application/pdf", new byte[0]));
    }

    /** {@link ContentStore} in memory. */
    private static final class Rows implements ContentStore {
        private final Map<String, Content> rows = new LinkedHashMap<>();
        private final Map<String, Instant> created = new LinkedHashMap<>();

        @Override
        public Content insert(Content c) {
            rows.put(c.id(), c);
            created.put(c.id(), NOW);
            return c;
        }

        @Override
        public Optional<Content> find(String tenantCode, UUID id) {
            return Optional.ofNullable(rows.get(id.toString())).filter(c -> c.tenantCode().equals(tenantCode));
        }

        @Override
        public boolean owner(String tenantCode, UUID id, String owner) {
            Optional<Content> c = find(tenantCode, id);
            c.ifPresent(x -> rows.put(x.id(), new Content(x.id(), x.tenantCode(), x.contentUrl(), x.name(),
                    x.mimetype(), x.size(), x.sha256(), owner, x.createdAt(), x.createdBy())));
            return c.isPresent();
        }

        @Override
        public List<Content> deleteUnowned(OffsetDateTime before, int limit) {
            List<Content> out = new ArrayList<>();
            for (Content c : List.copyOf(rows.values())) {
                if (out.size() < limit && c.owner() == null && created.get(c.id()).isBefore(before.toInstant())) {
                    rows.remove(c.id());
                    out.add(c);
                }
            }
            return out;
        }
    }
}
