package com.microboxlabs.miot.integrations.orgaccount;

import com.google.auth.oauth2.GoogleCredentials;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.net.URI;

/**
 * The modulith's own Google access token, from Application Default Credentials:
 * {@code GOOGLE_APPLICATION_CREDENTIALS} (any credential file Google accepts), then
 * gcloud's file, then the metadata server (GKE Workload Identity).
 */
public class PlatformGoogleToken {

    static final String CLOUD_PLATFORM = "https://www.googleapis.com/auth/cloud-platform";

    interface Source {
        GoogleCredentials load() throws IOException;
    }

    private final Source source;
    private GoogleCredentials credentials;

    PlatformGoogleToken(Source source) {
        this.source = source;
    }

    public static PlatformGoogleToken applicationDefault() {
        return new PlatformGoogleToken(
                () -> GoogleCredentials.getApplicationDefault().createScoped(List.of(CLOUD_PLATFORM)));
    }

    public synchronized Map<String, List<String>> metadata(URI uri) {
        try {
            if (credentials == null) credentials = source.load();
            return credentials.getRequestMetadata(uri);
        } catch (IOException e) {
            throw new GoogleCallException(502, "The platform has no usable Google credentials", e);
        }
    }
}
