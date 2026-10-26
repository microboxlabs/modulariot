package com.microboxlabs.miot.content.gcs;

import com.google.cloud.ReadChannel;
import com.google.cloud.WriteChannel;
import com.google.cloud.storage.BlobId;
import com.google.cloud.storage.BlobInfo;
import com.google.cloud.storage.Storage;
import com.google.cloud.storage.StorageOptions;
import com.microboxlabs.miot.core.content.ContentDriver;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.channels.Channels;
import java.util.Optional;
import java.util.function.Supplier;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * Content in a Google Cloud Storage bucket. New content goes to {@code miot.content.gcs.bucket}; URLs are
 * {@code gcs://<bucket>/<path>}, so content in another bucket stays readable. Credentials come from the
 * environment (workload identity, {@code GOOGLE_APPLICATION_CREDENTIALS}).
 */
@ApplicationScoped
public class GcsContentDriver implements ContentDriver {

    static final String SCHEME = "gcs";
    private static final String PREFIX = SCHEME + "://";

    private final Supplier<Storage> storage;
    private final Optional<String> bucket;
    private volatile Storage client;

    @Inject
    GcsContentDriver(@ConfigProperty(name = "miot.content.gcs.bucket") Optional<String> bucket) {
        this(() -> StorageOptions.getDefaultInstance().getService(), bucket);
    }

    public GcsContentDriver(Supplier<Storage> storage, Optional<String> bucket) {
        this.storage = storage;
        this.bucket = bucket.filter(b -> !b.isBlank());
    }

    @Override
    public String scheme() {
        return SCHEME;
    }

    @Override
    public String write(String path, InputStream in, String mimetype) throws IOException {
        String b = bucket.orElseThrow(() -> new IllegalStateException("miot.content.gcs.bucket is not set"));
        BlobInfo info = BlobInfo.newBuilder(BlobId.of(b, path)).setContentType(mimetype).build();
        try (WriteChannel channel = client().writer(info, Storage.BlobWriteOption.doesNotExist());
                OutputStream out = Channels.newOutputStream(channel)) {
            in.transferTo(out);
        }
        return PREFIX + b + "/" + path;
    }

    @Override
    public InputStream read(String url) throws IOException {
        BlobId id = blob(url);
        if (client().get(id) == null) {
            throw new IOException("content not found in the store");
        }
        ReadChannel channel = client().reader(id);
        return Channels.newInputStream(channel);
    }

    @Override
    public boolean exists(String url) {
        return client().get(blob(url)) != null;
    }

    @Override
    public void delete(String url) {
        client().delete(blob(url));
    }

    private static BlobId blob(String url) {
        if (url == null || !url.startsWith(PREFIX)) {
            throw new IllegalArgumentException("not a gcs:// content URL");
        }
        String rest = url.substring(PREFIX.length());
        int slash = rest.indexOf('/');
        if (slash <= 0 || slash == rest.length() - 1) {
            throw new IllegalArgumentException("gcs:// content URL without a bucket and a path");
        }
        return BlobId.of(rest.substring(0, slash), rest.substring(slash + 1));
    }

    /** Built on first use, so a deployment that never uses GCS needs no credentials. */
    private Storage client() {
        Storage c = client;
        if (c == null) {
            synchronized (this) {
                c = client;
                if (c == null) {
                    c = storage.get();
                    client = c;
                }
            }
        }
        return c;
    }
}
