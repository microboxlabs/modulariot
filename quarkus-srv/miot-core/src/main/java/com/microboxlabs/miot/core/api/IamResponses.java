package com.microboxlabs.miot.core.api;

import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.function.Supplier;

/**
 * Maps IAM service failures to HTTP: {@link IllegalArgumentException} 400, {@link SecurityException} 403,
 * {@link NoSuchElementException} 404, {@link IllegalStateException} 409. Body {@code {"error": "..."}}.
 */
final class IamResponses {

    private IamResponses() {
    }

    static Uni<Response> respond(Supplier<Uni<?>> call, Response.Status success) {
        return Uni.createFrom().<Object>deferred(() -> call.get().map(body -> (Object) body))
                .map(body -> body == null
                        ? Response.status(success).build()
                        : Response.status(success).entity(body).build())
                .onFailure(e -> status(e) != null)
                .recoverWithItem(e -> Response.status(status(e))
                        .type(MediaType.APPLICATION_JSON)
                        .entity(Map.of("error", e.getMessage() == null ? "" : e.getMessage()))
                        .build());
    }

    static Uni<Response> ok(Supplier<Uni<?>> call) {
        return respond(call, Response.Status.OK);
    }

    private static Response.Status status(Throwable e) {
        if (e instanceof SecurityException) {
            return Response.Status.FORBIDDEN;
        }
        if (e instanceof NoSuchElementException) {
            return Response.Status.NOT_FOUND;
        }
        if (e instanceof IllegalArgumentException) {
            return Response.Status.BAD_REQUEST;
        }
        if (e instanceof IllegalStateException) {
            return Response.Status.CONFLICT;
        }
        return null;
    }
}
