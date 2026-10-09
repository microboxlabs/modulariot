package com.microboxlabs.miot.core.gps;

import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.WebApplicationException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

/** A caching token endpoint that issues a JWT-shaped token expiring at {@link #expiresAt}. */
public class FakeGpsTokenApi implements GpsTokenApi {

    public final List<TokenRequest> requests = new ArrayList<>();
    public Instant expiresAt = Instant.now().plusSeconds(3600);
    public Long expiresIn = 86400L;
    public int refuseWith;

    public synchronized void reset() {
        requests.clear();
        expiresAt = Instant.now().plusSeconds(3600);
        expiresIn = 86400L;
        refuseWith = 0;
    }

    @Override
    public synchronized Uni<TokenResponse> token(TokenRequest request) {
        requests.add(request);
        if (refuseWith != 0) {
            return Uni.createFrom().failure(new WebApplicationException(refuseWith));
        }
        return Uni.createFrom().item(new TokenResponse(jwt(request.clientId(), expiresAt), expiresIn));
    }

    public static String jwt(String subject, Instant exp) {
        Base64.Encoder b64 = Base64.getUrlEncoder().withoutPadding();
        String header = b64.encodeToString("{\"alg\":\"HS256\"}".getBytes(StandardCharsets.UTF_8));
        String claims = b64.encodeToString(("{\"sub\":\"" + subject + "@clients\",\"exp\":" + exp.getEpochSecond()
                + "}").getBytes(StandardCharsets.UTF_8));
        return header + "." + claims + ".sig";
    }
}
