package com.microboxlabs.miot.symptoms.process;

import io.smallrye.mutiny.Uni;
import io.vertx.core.json.JsonObject;

public interface WebhookForwarder {

    boolean shouldForward(JsonObject result);

    Uni<Void> forward(String url, JsonObject result);
}
