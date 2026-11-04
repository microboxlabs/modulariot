package com.microboxlabs.miot.integrations.telephony;

import java.io.IOException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/** Sends one request and reads the body as text. Tests pass a stub instead of the network. */
@FunctionalInterface
public interface TelephonyHttp {

    Duration TIMEOUT = Duration.ofSeconds(10);

    HttpResponse<String> send(HttpRequest request) throws IOException, InterruptedException;

    static TelephonyHttp network() {
        HttpClient client = HttpClient.newBuilder().connectTimeout(TIMEOUT).build();
        return request -> client.send(request, HttpResponse.BodyHandlers.ofString());
    }
}
