package com.microboxlabs.miot.core.content;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/** Content on a disk or a mounted volume under {@code miot.content.fs.root}. URLs are {@code fs://<path>}. */
@ApplicationScoped
public class FileContentDriver implements ContentDriver {

    static final String SCHEME = "fs";
    private static final String PREFIX = SCHEME + "://";

    private final Path root;

    @Inject
    FileContentDriver(@ConfigProperty(name = "miot.content.fs.root", defaultValue = "data/content") String root) {
        this(Path.of(root));
    }

    public FileContentDriver(Path root) {
        this.root = root.toAbsolutePath().normalize();
    }

    @Override
    public String scheme() {
        return SCHEME;
    }

    /** Written to a temporary file first and moved into place, so a failed write leaves nothing behind. */
    @Override
    public String write(String path, InputStream in, String mimetype) throws IOException {
        Path target = resolve(path);
        Files.createDirectories(target.getParent());
        Path tmp = Files.createTempFile(target.getParent(), ".upload-", ".tmp");
        try {
            Files.copy(in, tmp, StandardCopyOption.REPLACE_EXISTING);
            Files.move(tmp, target, StandardCopyOption.ATOMIC_MOVE);
        } finally {
            Files.deleteIfExists(tmp);
        }
        return PREFIX + path;
    }

    @Override
    public InputStream read(String url) throws IOException {
        return Files.newInputStream(resolve(location(url)));
    }

    @Override
    public boolean exists(String url) {
        return Files.isRegularFile(resolve(location(url)));
    }

    @Override
    public void delete(String url) throws IOException {
        Files.deleteIfExists(resolve(location(url)));
    }

    private static String location(String url) {
        if (url == null || !url.startsWith(PREFIX)) {
            throw new IllegalArgumentException("not an fs:// content URL");
        }
        return url.substring(PREFIX.length());
    }

    /** A path that leaves the root is refused. */
    private Path resolve(String path) {
        Path p = root.resolve(path).normalize();
        if (!p.startsWith(root) || p.equals(root)) {
            throw new IllegalArgumentException("content path outside the store");
        }
        return p;
    }
}
