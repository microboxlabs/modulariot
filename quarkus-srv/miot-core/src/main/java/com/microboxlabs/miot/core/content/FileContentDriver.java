package com.microboxlabs.miot.core.content;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.io.InputStream;
import java.nio.channels.Channels;
import java.nio.channels.SeekableByteChannel;
import java.nio.charset.StandardCharsets;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.NoSuchFileException;
import java.nio.file.OpenOption;
import java.nio.file.Path;
import java.nio.file.SecureDirectoryStream;
import java.nio.file.StandardOpenOption;
import java.nio.file.StandardCopyOption;
import java.nio.file.attribute.BasicFileAttributeView;
import java.nio.file.attribute.BasicFileAttributes;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Set;
import java.util.UUID;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/** Opaque fs:// keys in the configured root; older hierarchical URLs use secure directory traversal. */
@ApplicationScoped
public class FileContentDriver implements ContentDriver {

    static final String SCHEME = "fs";
    private static final String PREFIX = SCHEME + "://";
    private static final String STORED_PREFIX = ".content-";
    private static final Set<OpenOption> READ = Set.of(StandardOpenOption.READ, LinkOption.NOFOLLOW_LINKS);
    private static final Set<OpenOption> WRITE =
            Set.of(StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE, LinkOption.NOFOLLOW_LINKS);

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

    /** New writes use only direct children of the trusted root, never URL-derived parent directories. */
    @Override
    public String write(String path, InputStream in, String mimetype) throws IOException {
        Path target = stored(relative(path));
        Files.createDirectories(root);
        Path tmp = root.resolve(".upload-" + UUID.randomUUID());
        try {
            try (SeekableByteChannel channel = Files.newByteChannel(tmp, WRITE)) {
                in.transferTo(Channels.newOutputStream(channel));
            }
            Files.move(tmp, target, StandardCopyOption.ATOMIC_MOVE);
        } finally {
            Files.deleteIfExists(tmp);
        }
        return PREFIX + target.getFileName();
    }

    @Override
    public InputStream read(String url) throws IOException {
        Path path = relative(location(url));
        if (isStored(path)) {
            return Channels.newInputStream(Files.newByteChannel(root.resolve(path), READ));
        }
        try (SecureDirectoryStream<Path> base = openRoot()) {
            return legacy(base, path, (parent, name) -> Channels.newInputStream(parent.newByteChannel(name, READ)));
        }
    }

    @Override
    public boolean exists(String url) {
        Path path = relative(location(url));
        try {
            if (isStored(path)) {
                return Files.readAttributes(root.resolve(path), BasicFileAttributes.class, LinkOption.NOFOLLOW_LINKS)
                        .isRegularFile();
            }
            try (SecureDirectoryStream<Path> base = openRoot()) {
                return legacy(base, path, FileContentDriver::regularFile);
            }
        } catch (IOException unreadable) {
            return false;
        }
    }

    @Override
    public void delete(String url) throws IOException {
        Path path = relative(location(url));
        try {
            if (isStored(path)) {
                Files.deleteIfExists(root.resolve(path));
                return;
            }
            try (SecureDirectoryStream<Path> base = openRoot()) {
                legacy(base, path, (parent, name) -> {
                    parent.deleteFile(name);
                    return null;
                });
            }
        } catch (NoSuchFileException missing) {
            // Deleting content that does not exist is idempotent.
        }
    }

    private static boolean isStored(Path path) {
        return path.getNameCount() == 1 && path.toString().startsWith(STORED_PREFIX);
    }

    private SecureDirectoryStream<Path> openRoot() throws IOException {
        DirectoryStream<Path> stream = Files.newDirectoryStream(root);
        if (stream instanceof SecureDirectoryStream<Path> secure) {
            return secure;
        }
        stream.close();
        throw new IOException("the content filesystem must support secure directory operations");
    }

    private static boolean regularFile(SecureDirectoryStream<Path> directory, Path name) throws IOException {
        return directory.getFileAttributeView(name, BasicFileAttributeView.class, LinkOption.NOFOLLOW_LINKS)
                .readAttributes().isRegularFile();
    }

    @FunctionalInterface
    private interface DirectoryAction<T> {
        T apply(SecureDirectoryStream<Path> directory, Path name) throws IOException;
    }

    /** Opens legacy hierarchical paths without following links or re-resolving an already opened parent. */
    private static <T> T legacy(SecureDirectoryStream<Path> directory, Path path, DirectoryAction<T> action)
            throws IOException {
        if (path.getNameCount() == 1) {
            return action.apply(directory, path);
        }
        try (SecureDirectoryStream<Path> child = directory.newDirectoryStream(path.getName(0), LinkOption.NOFOLLOW_LINKS)) {
            return legacy(child, path.subpath(1, path.getNameCount()), action);
        }
    }

    private static String location(String url) {
        if (url == null || !url.startsWith(PREFIX)) {
            throw new IllegalArgumentException("not an fs:// content URL");
        }
        return url.substring(PREFIX.length());
    }

    private Path relative(String path) {
        Path target = root.resolve(path).normalize();
        if (!target.startsWith(root) || target.equals(root)) {
            throw new IllegalArgumentException("content path outside the store");
        }
        return root.relativize(target);
    }

    private Path stored(Path logical) {
        try {
            String hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(logical.toString().getBytes(StandardCharsets.UTF_8)));
            return root.resolve(STORED_PREFIX + hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
