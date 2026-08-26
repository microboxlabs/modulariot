package com.microboxlabs.miot.symptoms.process;

import io.smallrye.mutiny.Uni;
import io.vertx.core.json.JsonObject;

public interface FunctionInvoker {

    Uni<JsonObject> invoke(String functionName, JsonObject debeziumPayload);
}
