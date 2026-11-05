package com.microboxlabs.miot.core.content;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.SecureDirectoryStream;
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

    @TempDir
    Path outside;

    private final Rows store = new Rows();

    private ContentService service(long maxBytes, Instant now) {
        return new ContentService(store, List.of(new FileContentDriver(root)), "fs", maxBytes,
                ContentService.DEFAULT_TYPES, Duration.ofHours(24), Clock.fixed(now, ZoneOffset.UTC));
    }

    @Test
    void storesTheFileWithItsTenantSizeAndDigest() throws Exception {
        Content c = service(1024, NOW).write("t1", "user:a", "manifest.pdf", "application/pdf",
                new ByteArrayInputStream(PDF));

        assertEquals("t1", c.tenantCode());
        assertTrue(c.contentUrl().startsWith("fs://.content-"));
        assertEquals(PDF.length, c.size());
        assertEquals(HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(PDF)), c.sha256());
        assertEquals("manifest.pdf", c.name());
        assertNull(c.owner());
        try (InputStream in = service(1024, NOW).open("t1", UUID.fromString(c.id())).stream()) {
            assertArrayEquals(PDF, in.readAllBytes());
        }
        ContentService reader = service(1024, NOW);
        UUID id = UUID.fromString(c.id());
        assertThrows(NoSuchElementException.class, () -> reader.open("t2", id));
    }

    @Test
    void refusesOtherTypesBytesThatDoNotMatchAndLargeFiles() throws IOException {
        ContentService s = service(PDF.length - 1L, NOW);
        ByteArrayInputStream html = new ByteArrayInputStream("<html>".getBytes(StandardCharsets.UTF_8));
        ByteArrayInputStream wrongType = new ByteArrayInputStream(PDF);
        ByteArrayInputStream tooLarge = new ByteArrayInputStream(PDF);
        assertThrows(IllegalArgumentException.class, () -> s.write("t1", "u", "a.html", "text/html",
                html));
        assertThrows(IllegalArgumentException.class, () -> s.write("t1", "u", "a.png", "image/png",
                wrongType));
        IllegalArgumentException large = assertThrows(IllegalArgumentException.class,
                () -> s.write("t1", "u", "a.pdf", "application/pdf", tooLarge));
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
        ContentService owner = service(1024, NOW);
        UUID droppedId = UUID.fromString(dropped.id());
        assertThrows(NoSuchElementException.class, () -> owner.owner("t1", droppedId, "x"));
    }

    @Test
    void aFailedPhysicalDeletionKeepsTheRowForTheNextCleanup() {
        Content content = service(1024, NOW).write("t1", "u", "a.pdf", "application/pdf",
                new ByteArrayInputStream(PDF));
        FileContentDriver flaky = new FileContentDriver(root) {
            private boolean fail = true;

            @Override
            public void delete(String url) throws IOException {
                if (fail) {
                    fail = false;
                    throw new IOException("temporary deletion failure");
                }
                super.delete(url);
            }
        };
        ContentService cleanup = new ContentService(store, List.of(flaky), "fs", 1024,
                ContentService.DEFAULT_TYPES, Duration.ofHours(24),
                Clock.fixed(NOW.plus(Duration.ofHours(25)), ZoneOffset.UTC));
        assertEquals(0, cleanup.deleteUnowned(10));
        assertTrue(store.find("t1", UUID.fromString(content.id())).isPresent());
        assertTrue(flaky.exists(content.contentUrl()));
        assertEquals(1, cleanup.deleteUnowned(10));
        assertFalse(flaky.exists(content.contentUrl()));
    }

    @Test
    void theFileDriverStaysInsideItsRoot() {
        FileContentDriver fs = new FileContentDriver(root);
        ByteArrayInputStream input = new ByteArrayInputStream(PDF);
        assertThrows(IllegalArgumentException.class,
                () -> fs.write("../escape", input, "application/pdf"));
        assertThrows(IllegalArgumentException.class, () -> fs.read("fs://../../etc/passwd"));
        assertThrows(IllegalArgumentException.class, () -> fs.read("gcs://bucket/x"));
    }

    @Test
    void symbolicParentsCannotRedirectFileOperations() throws IOException {
        FileContentDriver fs = new FileContentDriver(root);
        Path secret = outside.resolve("document");
        Files.write(secret, PDF);
        Files.createSymbolicLink(root.resolve("tenant"), outside);
        assertThrows(IOException.class, () -> fs.read("fs://tenant/document"));
        assertThrows(IOException.class, () -> fs.delete("fs://tenant/document"));
        assertFalse(fs.exists("fs://tenant/document"));
        ByteArrayInputStream input = new ByteArrayInputStream(PDF);
        String url = fs.write("tenant/new-document", input, "application/pdf");
        assertFalse(Files.exists(outside.resolve("new-document")));
        try (InputStream in = fs.read(url)) {
            assertArrayEquals(PDF, in.readAllBytes());
        }
        fs.delete(url);
        fs.delete(url);
        assertArrayEquals(PDF, Files.readAllBytes(secret));
    }

    @Test
    void aStoredFileReplacedByASymbolicLinkIsNeverFollowed() throws IOException {
        FileContentDriver fs = new FileContentDriver(root);
        Path secret = outside.resolve("secret");
        Files.write(secret, PDF);
        String url = fs.write("tenant/document", new ByteArrayInputStream(PDF), "application/pdf");
        Path stored = root.resolve(url.substring("fs://".length()));
        Files.delete(stored);
        Files.createSymbolicLink(stored, secret);
        assertThrows(IOException.class, () -> fs.read(url));
        assertFalse(fs.exists(url));
        fs.delete(url);
        assertArrayEquals(PDF, Files.readAllBytes(secret));
    }

    @Test
    void legacyHierarchicalFilesRemainReadableAndDeletable() throws IOException {
        try (DirectoryStream<Path> directory = Files.newDirectoryStream(root)) {
            assumeTrue(directory instanceof SecureDirectoryStream<?>);
        }
        FileContentDriver fs = new FileContentDriver(root);
        Path legacy = root.resolve("tenant/old-document");
        Files.createDirectories(legacy.getParent());
        Files.write(legacy, PDF);
        String url = "fs://tenant/old-document";
        assertTrue(fs.exists(url));
        try (InputStream in = fs.read(url)) {
            assertArrayEquals(PDF, in.readAllBytes());
        }
        fs.delete(url);
        assertFalse(Files.exists(legacy));
    }

    @Test
    void recognizesTheAcceptedTypesByTheirFirstBytes() {
        assertTrue(ContentService.matches("image/jpeg", new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0}));
        assertTrue(ContentService.matches("image/png", new byte[] {(byte) 0x89, 'P', 'N', 'G'}));
        assertTrue(ContentService.matches("image/webp", "RIFF0000WEBPVP8 ".getBytes(StandardCharsets.US_ASCII)));
        assertTrue(ContentService.matches("image/heic", bmff("heic")));
        assertTrue(ContentService.matches("image/heic", bmff("mif1", "heix")));
        assertFalse(ContentService.matches("image/heic", bmff("mp42", "isom")));
        assertFalse(ContentService.matches("image/heic", bmff("avif", "mif1", "miaf")));
        assertFalse(ContentService.matches("image/jpeg", PDF));
        assertFalse(ContentService.matches("application/pdf", new byte[0]));
    }

    private static byte[] bmff(String major, String... compatible) {
        ByteBuffer header = ByteBuffer.allocate(16 + compatible.length * 4);
        header.putInt(header.capacity()).put("ftyp".getBytes(StandardCharsets.US_ASCII));
        header.put(major.getBytes(StandardCharsets.US_ASCII)).putInt(0);
        for (String brand : compatible) {
            header.put(brand.getBytes(StandardCharsets.US_ASCII));
        }
        return header.array();
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
        public List<Content> unowned(OffsetDateTime before, int limit) {
            List<Content> out = new ArrayList<>();
            for (Content c : List.copyOf(rows.values())) {
                if (out.size() < limit && c.owner() == null && created.get(c.id()).isBefore(before.toInstant())) {
                    out.add(c);
                }
            }
            return out;
        }

        @Override
        public boolean deleteUnowned(String tenantCode, UUID id, OffsetDateTime before) {
            return find(tenantCode, id)
                    .filter(c -> c.owner() == null && created.get(c.id()).isBefore(before.toInstant()))
                    .map(c -> rows.remove(c.id()) != null).orElse(false);
        }
    }
}
