package com.microboxlabs.miot.content.gcs;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.google.cloud.storage.BlobId;
import com.google.cloud.storage.Storage;
import com.google.cloud.storage.StorageException;
import com.google.cloud.storage.contrib.nio.testing.LocalStorageHelper;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class GcsContentDriverTest {

    private final Storage storage = LocalStorageHelper.getOptions().getService();
    private final GcsContentDriver driver = new GcsContentDriver(() -> storage, Optional.of("pods"));

    @Test
    void writesReadsAndDeletesByTheBucketInTheUrl() throws IOException {
        byte[] bytes = "%PDF-1.7 signed".getBytes(StandardCharsets.UTF_8);
        String url = driver.write("t1/2026/10/26/a", new ByteArrayInputStream(bytes), "application/pdf");

        assertEquals("gcs://pods/t1/2026/10/26/a", url);
        assertEquals("application/pdf", storage.get(BlobId.of("pods", "t1/2026/10/26/a")).getContentType());
        try (InputStream in = driver.read(url)) {
            assertArrayEquals(bytes, in.readAllBytes());
        }
        assertTrue(driver.exists(url));
        driver.delete(url);
        assertFalse(driver.exists(url));
        driver.delete(url);
    }

    @Test
    void readsContentOfAnotherBucket() throws IOException {
        GcsContentDriver old = new GcsContentDriver(() -> storage, Optional.of("old"));
        String url = old.write("t1/x", new ByteArrayInputStream(new byte[] {1, 2}), "image/png");

        try (InputStream in = driver.read(url)) {
            assertArrayEquals(new byte[] {1, 2}, in.readAllBytes());
        }
    }

    @Test
    void aFailedReadDoesNotPublishPartialContent() {
        InputStream broken = new InputStream() {
            private int reads;

            @Override
            public int read() throws IOException {
                if (++reads > 3) {
                    throw new IOException("broken upload input");
                }
                return 1;
            }
        };
        assertThrows(IOException.class, () -> driver.write("t1/broken", broken, "application/pdf"));
        assertFalse(driver.exists("gcs://pods/t1/broken"));
    }

    @Test
    void aRefusedOverwritePreservesTheExistingObject() throws IOException {
        byte[] original = {1, 2, 3};
        String url = driver.write("t1/existing", new ByteArrayInputStream(original), "application/pdf");
        ByteArrayInputStream replacement = new ByteArrayInputStream(new byte[] {4, 5});
        assertThrows(StorageException.class, () -> driver.write("t1/existing", replacement, "application/pdf"));
        try (InputStream in = driver.read(url)) {
            assertArrayEquals(original, in.readAllBytes());
        }
    }

    @Test
    void refusesWritesWithoutABucketAndUrlsOfOtherStores() {
        GcsContentDriver none = new GcsContentDriver(() -> storage, Optional.empty());
        ByteArrayInputStream input = new ByteArrayInputStream(new byte[] {1});
        assertThrows(IllegalStateException.class,
                () -> none.write("t1/x", input, "image/png"));
        assertThrows(IllegalArgumentException.class, () -> driver.exists("fs://t1/x"));
        assertThrows(IllegalArgumentException.class, () -> driver.exists("gcs://pods"));
        assertThrows(IOException.class, () -> driver.read("gcs://pods/missing"));
    }
}
