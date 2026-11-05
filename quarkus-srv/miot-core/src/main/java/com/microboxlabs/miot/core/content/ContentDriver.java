package com.microboxlabs.miot.core.content;

import java.io.IOException;
import java.io.InputStream;

/**
 * Keeps content bytes. Each driver owns one URL scheme ({@code fs}, {@code gcs}); a content URL is
 * {@code <scheme>://<location>}. Reads go to the driver of the URL's scheme, so content written by a store that is
 * no longer the configured one stays readable.
 */
public interface ContentDriver {

    String scheme();

    /** Writes {@code in} under {@code path} ({@code <tenant>/<yyyy>/<mm>/<dd>/<uuid>}) and returns its URL. */
    String write(String path, InputStream in, String mimetype) throws IOException;

    InputStream read(String url) throws IOException;

    boolean exists(String url) throws IOException;

    /** Deleting content that does not exist does nothing. */
    void delete(String url) throws IOException;
}
