package com.microboxlabs.miot.integrations.api;

import com.microboxlabs.miot.core.auth.PlatformAuthorizer;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.function.Supplier;

/**
 * The shared shape of a platform setting resource: platform owners only, blocking work on a worker thread,
 * {@link IllegalArgumentException} as 400 and {@link IllegalStateException} as 409.
 */
final class PlatformSettingEndpoints {

    private final PlatformAuthorizer authorizer;
    private final String notFound;

    /** @param notFound the error when the setting is not set */
    PlatformSettingEndpoints(PlatformAuthorizer authorizer, String notFound) {
        this.authorizer = authorizer;
        this.notFound = notFound;
    }

    <T> Uni<T> get(Supplier<T> read) {
        return authorizer.requirePlatformOwner().flatMap(ignored -> onWorker(read));
    }

    /** {@code save} gets the acting owner. */
    Uni<Response> put(Function<String, Object> save) {
        return authorizer.requirePlatformOwner().flatMap(actor -> onWorker(() -> {
            try {
                return Response.ok(save.apply(actor)).build();
            } catch (IllegalArgumentException e) {
                return error(Response.Status.BAD_REQUEST, e.getMessage());
            } catch (IllegalStateException e) {
                return error(Response.Status.CONFLICT, e.getMessage());
            }
        }));
    }

    /** {@code remove} gets the acting owner and answers false when the setting was not set. */
    Uni<Response> delete(Predicate<String> remove) {
        return authorizer.requirePlatformOwner().flatMap(actor -> onWorker(() -> {
            try {
                return remove.test(actor)
                        ? Response.noContent().build()
                        : error(Response.Status.NOT_FOUND, notFound);
            } catch (IllegalStateException e) {
                return error(Response.Status.CONFLICT, e.getMessage());
            }
        }));
    }

    /** {@code check} answers null when the setting is not set. */
    Uni<Response> test(Supplier<Object> check) {
        return authorizer.requirePlatformOwner().flatMap(ignored -> onWorker(() -> {
            Object result = check.get();
            return result == null ? error(Response.Status.NOT_FOUND, notFound) : Response.ok(result).build();
        }));
    }

    private static Response error(Response.Status status, String message) {
        return Response.status(status).type(MediaType.APPLICATION_JSON).entity(Map.of("error", message)).build();
    }

    private static <T> Uni<T> onWorker(Supplier<T> work) {
        return Uni.createFrom().item(work).runSubscriptionOn(Infrastructure.getDefaultWorkerPool());
    }
}
