package com.microboxlabs.miot.core.messaging;

import io.quarkus.arc.DefaultBean;
import io.vertx.core.eventbus.EventBus;
import io.vertx.core.json.Json;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.function.Consumer;

/**
 * In-process messaging via Vert.x EventBus.
 * Default implementation when multiple components run in the same JVM.
 */
@ApplicationScoped
@DefaultBean
public class InProcessBus implements IComponentBus {

    @Inject
    EventBus eventBus;

    @Override
    public <T> void publish(String channel, T event) {
        eventBus.publish(channel, Json.encode(event));
    }

    @Override
    public <T> void subscribe(String channel, Class<T> type, Consumer<T> handler) {
        eventBus.consumer(channel, message -> {
            T decoded = Json.decodeValue((String) message.body(), type);
            handler.accept(decoded);
        });
    }
}
