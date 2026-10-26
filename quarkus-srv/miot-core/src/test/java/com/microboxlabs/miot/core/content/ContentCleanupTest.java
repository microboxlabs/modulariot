package com.microboxlabs.miot.core.content;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.auth.PlatformTestProfile;
import com.microboxlabs.miot.core.db.PgTransactions;
import com.microboxlabs.miot.core.db.PgTx;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.vertx.mutiny.sqlclient.Pool;
import jakarta.inject.Inject;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

@QuarkusTest
@TestProfile(PlatformTestProfile.class)
class ContentCleanupTest {

    @Inject
    Pool pool;

    @TempDir
    Path root;

    @Test
    void cleanupDeletesOnlyUnownedRowsAndTheirFiles() {
        Instant now = Instant.now();
        String tenant = "content-test-" + UUID.randomUUID();
        FileContentDriver files = new FileContentDriver(root);
        PgContentStore store = new PgContentStore(() -> pool);
        ContentService contents = service(store, files, now);
        byte[] pdf = "%PDF-1.7 test document".getBytes(StandardCharsets.UTF_8);
        Content kept = contents.write(tenant, "test", "kept.pdf", "application/pdf", new ByteArrayInputStream(pdf));
        Content dropped = contents.write(tenant, "test", "dropped.pdf", "application/pdf",
                new ByteArrayInputStream(pdf));
        contents.owner(tenant, UUID.fromString(kept.id()), "test:record");
        ContentService cleanup = service(store, files, now.plus(Duration.ofHours(25)));
        assertEquals(1, cleanup.deleteUnowned(10));
        assertTrue(store.find(tenant, UUID.fromString(kept.id())).isPresent());
        assertTrue(files.exists(kept.contentUrl()));
        assertFalse(store.find(tenant, UUID.fromString(dropped.id())).isPresent());
        assertFalse(files.exists(dropped.contentUrl()));
        contents.owner(tenant, UUID.fromString(kept.id()), null);
        assertEquals(1, cleanup.deleteUnowned(10));
    }

    @Test
    void anOuterRollbackRemovesUploadsFromSuccessfulSavepointsToo() {
        Instant now = Instant.now();
        String tenant = "content-test-" + UUID.randomUUID();
        FileContentDriver files = new FileContentDriver(root);
        PgContentStore store = new PgContentStore(() -> pool);
        ContentService contents = service(store, files, now);
        AtomicReference<Content> outer = new AtomicReference<>();
        AtomicReference<Content> inner = new AtomicReference<>();
        Runnable work = () -> {
            outer.set(upload(contents, tenant));
            PgTx.savepoint(() -> {
                inner.set(upload(contents, tenant));
                return null;
            });
            throw new IllegalStateException("rollback the content records");
        };
        PgTransactions tx = new PgTransactions(() -> pool);
        assertThrows(IllegalStateException.class, () -> tx.inTransaction(work));
        for (Content content : List.of(outer.get(), inner.get())) {
            assertFalse(files.exists(content.contentUrl()));
            assertFalse(store.find(tenant, UUID.fromString(content.id())).isPresent());
        }
    }

    @Test
    void aSavepointRollbackKeepsTheOuterUploadAndDoesNotCompensateItOnCommit() {
        Instant now = Instant.now();
        String tenant = "content-test-" + UUID.randomUUID();
        FileContentDriver files = new FileContentDriver(root);
        PgContentStore store = new PgContentStore(() -> pool);
        ContentService contents = service(store, files, now);
        AtomicReference<Content> rejected = new AtomicReference<>();
        PgTransactions tx = new PgTransactions(() -> pool);
        Content kept = tx.inTransaction(() -> {
            Content outer = upload(contents, tenant);
            Supplier<Void> work = () -> {
                rejected.set(upload(contents, tenant));
                throw new IllegalStateException("rollback this upload only");
            };
            assertThrows(IllegalStateException.class, () -> PgTx.savepoint(work));
            assertFalse(files.exists(rejected.get().contentUrl()));
            assertTrue(files.exists(outer.contentUrl()));
            return outer;
        });
        assertTrue(files.exists(kept.contentUrl()));
        assertTrue(store.find(tenant, UUID.fromString(kept.id())).isPresent());
        assertEquals(1, service(store, files, now.plus(Duration.ofHours(25))).deleteUnowned(10));
    }

    private static Content upload(ContentService contents, String tenant) {
        return contents.write(tenant, "test", "test.pdf", "application/pdf",
                new ByteArrayInputStream("%PDF-1.7 test".getBytes(StandardCharsets.UTF_8)));
    }

    private ContentService service(PgContentStore store, FileContentDriver files, Instant now) {
        return new ContentService(store, List.of(files), "fs", 1024, ContentService.DEFAULT_TYPES,
                Duration.ofHours(24), Clock.fixed(now, ZoneOffset.UTC), new PgTransactions(() -> pool));
    }
}
