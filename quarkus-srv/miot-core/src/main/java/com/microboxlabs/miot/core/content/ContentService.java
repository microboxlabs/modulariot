package com.microboxlabs.miot.core.content;

import com.microboxlabs.miot.core.db.PgTx;
import com.microboxlabs.miot.core.db.Transactions;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Stores files for the modules. New content goes to the driver of {@code miot.content.store}; reads go to the driver
 * of the content URL's scheme. Only the types of {@code miot.content.types} are accepted, and the first bytes must
 * match the declared type. A module sets the owner once the record that uses the content is saved; content without
 * an owner is deleted after {@code miot.content.unowned-grace}. A driver writes nothing when the write fails.
 */
@ApplicationScoped
public class ContentService {

    public static final long DEFAULT_MAX_BYTES = 20L * 1024 * 1024;
    public static final List<String> DEFAULT_TYPES =
            List.of("image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf");
    private static final Logger LOG = Logger.getLogger(ContentService.class);
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyy/MM/dd");
    private static final int SNIFF = 256;
    // HEVC still-image brands: https://mp4ra.org/registered-types/brands
    private static final Set<String> HEIC_BRANDS = Set.of("heic", "heix", "heim", "heis");

    /** What {@link #open} returns; the caller closes {@code stream}. */
    public record Opened(Content content, InputStream stream) {
    }

    private final ContentStore store;
    private final Map<String, ContentDriver> drivers;
    private final String scheme;
    private final long maxBytes;
    private final Set<String> types;
    private final Duration grace;
    private final Clock clock;
    private final Transactions tx;

    @Inject
    ContentService(ContentStore store, Instance<ContentDriver> drivers, Transactions tx,
            @ConfigProperty(name = "miot.content.store", defaultValue = "fs") String scheme,
            @ConfigProperty(name = "miot.content.max-bytes", defaultValue = "20971520") long maxBytes,
            @ConfigProperty(name = "miot.content.types",
                    defaultValue = "image/jpeg,image/png,image/webp,image/heic,application/pdf") List<String> types,
            @ConfigProperty(name = "miot.content.unowned-grace", defaultValue = "PT24H") Duration grace) {
        this(store, drivers.stream().toList(), scheme, maxBytes, types, grace, Clock.systemUTC(), tx);
    }

    @SuppressWarnings("java:S107") // The configuration above, plus the clock, for tests.
    public ContentService(ContentStore store, List<ContentDriver> drivers, String scheme, long maxBytes,
            List<String> types, Duration grace, Clock clock) {
        this(store, drivers, scheme, maxBytes, types, grace, clock, Transactions.none());
    }

    @SuppressWarnings("java:S107") // The storage configuration and its transaction boundary.
    public ContentService(ContentStore store, List<ContentDriver> drivers, String scheme, long maxBytes,
            List<String> types, Duration grace, Clock clock, Transactions tx) {
        this.store = store;
        this.drivers = drivers.stream().collect(Collectors.toMap(ContentDriver::scheme, Function.identity()));
        this.scheme = scheme;
        this.maxBytes = maxBytes;
        this.types = types.stream().map(t -> t.trim().toLowerCase(Locale.ROOT)).collect(Collectors.toSet());
        this.grace = grace;
        this.clock = clock;
        this.tx = tx;
    }

    /**
     * Stores {@code in} without an owner. Refuses a type outside the list, bytes that do not match it, and content
     * larger than the limit.
     */
    @SuppressWarnings("java:S1075") // Logical driver keys use URI separators on every operating system.
    public Content write(String tenantCode, String actor, String name, String mimetype, InputStream in) {
        String type = mimetype == null ? "" : mimetype.trim().toLowerCase(Locale.ROOT);
        if (!types.contains(type)) {
            throw new IllegalArgumentException("content type " + type + " is not accepted");
        }
        ContentDriver driver = driver(scheme);
        UUID id = UUID.randomUUID();
        String path = tenantCode + "/" + DAY.format(OffsetDateTime.now(clock).withOffsetSameInstant(ZoneOffset.UTC))
                + "/" + id;
        try (Measured measured = new Measured(new BufferedInputStream(in), maxBytes)) {
            measured.mark(SNIFF);
            byte[] head = measured.readNBytes(SNIFF);
            measured.reset();
            if (!matches(type, head)) {
                throw new IllegalArgumentException("the file is not a " + type);
            }
            String url = driver.write(path, measured, type);
            return insert(new Content(id.toString(), tenantCode, url, name(name), type,
                    measured.count, measured.sha256(), null, null, actor), driver);
        } catch (TooLarge e) {
            throw new IllegalArgumentException("the file is larger than " + maxBytes / (1024 * 1024) + " MB");
        } catch (IOException e) {
            throw new UncheckedIOException("could not store the content", e);
        }
    }

    private Content insert(Content content, ContentDriver driver) throws IOException {
        try {
            Content saved = store.insert(content);
            PgTx.afterRollback(() -> deleteAfterRollback(driver, content.contentUrl()));
            return saved;
        } catch (RuntimeException e) {
            driver.delete(content.contentUrl());
            throw e;
        }
    }

    private static void deleteAfterRollback(ContentDriver driver, String url) {
        try {
            driver.delete(url);
        } catch (IOException e) {
            throw new UncheckedIOException("could not remove rolled-back content", e);
        }
    }

    public Optional<Content> find(String tenantCode, UUID id) {
        return store.find(tenantCode, id);
    }

    public Opened open(String tenantCode, UUID id) {
        Content c = store.find(tenantCode, id).orElseThrow(() -> new NoSuchElementException("content not found"));
        try {
            return new Opened(c, driver(schemeOf(c.contentUrl())).read(c.contentUrl()));
        } catch (IOException e) {
            throw new UncheckedIOException("could not read the content", e);
        }
    }

    /** {@code owner} names the record that uses the content; null releases it to the cleanup. */
    public void owner(String tenantCode, UUID id, String owner) {
        if (!store.owner(tenantCode, id, owner)) {
            throw new NoSuchElementException("content not found");
        }
    }

    /** Deletes content without an owner older than the grace period, at most {@code limit}; returns how many. */
    public int deleteUnowned(int limit) {
        OffsetDateTime before = OffsetDateTime.now(clock).minus(grace);
        return tx.inTransaction(() -> {
            int deleted = 0;
            for (Content c : store.unowned(before, limit)) {
                try {
                    driver(schemeOf(c.contentUrl())).delete(c.contentUrl());
                } catch (IOException | RuntimeException e) {
                    LOG.warnf("Could not delete content %s: %s", c.id(), e.getMessage());
                    continue;
                }
                if (store.deleteUnowned(c.tenantCode(), UUID.fromString(c.id()), before)) {
                    deleted++;
                }
            }
            return deleted;
        });
    }

    private ContentDriver driver(String s) {
        ContentDriver d = drivers.get(s);
        if (d == null) {
            throw new IllegalStateException("no content driver for " + s);
        }
        return d;
    }

    private static String schemeOf(String url) {
        int i = url.indexOf("://");
        if (i <= 0) {
            throw new IllegalStateException("content URL without a scheme");
        }
        return url.substring(0, i);
    }

    private static String name(String name) {
        if (name == null || name.isBlank()) {
            return null;
        }
        String n = name.replaceAll("[\\p{Cntrl}/\\\\]", "_").trim();
        return n.length() > 255 ? n.substring(n.length() - 255) : n;
    }

    /** The first bytes of the accepted types. A type without a known signature is accepted as declared. */
    static boolean matches(String type, byte[] head) {
        return switch (type) {
            case "image/jpeg" -> starts(head, 0xFF, 0xD8, 0xFF);
            case "image/png" -> starts(head, 0x89, 'P', 'N', 'G');
            case "application/pdf" -> starts(head, '%', 'P', 'D', 'F');
            case "image/webp" -> starts(head, 'R', 'I', 'F', 'F') && head.length >= 12
                    && Arrays.equals(Arrays.copyOfRange(head, 8, 12), new byte[] {'W', 'E', 'B', 'P'});
            case "image/heic" -> heic(head);
            default -> true;
        };
    }

    private static boolean heic(byte[] head) {
        if (head.length < 16 || !Arrays.equals(Arrays.copyOfRange(head, 4, 8),
                new byte[] {'f', 't', 'y', 'p'})) {
            return false;
        }
        long boxSize = Integer.toUnsignedLong(ByteBuffer.wrap(head).getInt());
        int end = boxSize == 0 ? head.length : (int) Math.min(boxSize, head.length);
        if (end < 16) {
            return false;
        }
        if (heicBrand(head, 8)) {
            return true;
        }
        for (int offset = 16; offset + 4 <= end; offset += 4) {
            if (heicBrand(head, offset)) {
                return true;
            }
        }
        return false;
    }

    private static boolean heicBrand(byte[] head, int offset) {
        return HEIC_BRANDS.contains(new String(head, offset, 4, StandardCharsets.US_ASCII));
    }

    private static boolean starts(byte[] head, int... signature) {
        if (head.length < signature.length) {
            return false;
        }
        for (int i = 0; i < signature.length; i++) {
            if ((head[i] & 0xFF) != signature[i]) {
                return false;
            }
        }
        return true;
    }

    private static final class TooLarge extends IOException {
        private TooLarge() {
            super("content too large");
        }
    }

    /** Counts and digests what is read; more than {@code max} bytes fails the read. */
    private static final class Measured extends DigestInputStream {
        private final long max;
        private long count;
        private long markCount;

        private Measured(InputStream in, long max) {
            super(in, newDigest());
            this.max = max;
        }

        private static MessageDigest newDigest() {
            try {
                return MessageDigest.getInstance("SHA-256");
            } catch (NoSuchAlgorithmException e) {
                throw new IllegalStateException(e);
            }
        }

        @Override
        public synchronized void mark(int limit) {
            super.mark(limit);
            on(false);
            markCount = count;
        }

        @Override
        public synchronized void reset() throws IOException {
            super.reset();
            on(true);
            count = markCount;
        }

        @Override
        public int read() throws IOException {
            int b = super.read();
            if (b >= 0) {
                seen(1);
            }
            return b;
        }

        @Override
        public int read(byte[] buf, int off, int len) throws IOException {
            int n = super.read(buf, off, len);
            if (n > 0) {
                seen(n);
            }
            return n;
        }

        private void seen(int n) throws TooLarge {
            count += n;
            if (count > max) {
                throw new TooLarge();
            }
        }

        private String sha256() {
            return HexFormat.of().formatHex(getMessageDigest().digest());
        }
    }
}
