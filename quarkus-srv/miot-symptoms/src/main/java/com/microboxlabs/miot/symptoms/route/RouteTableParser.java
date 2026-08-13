package com.microboxlabs.miot.symptoms.route;

import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import java.util.ArrayList;
import java.util.List;

/**
 * Parses the bootstrap JSON document. Superadmin will emit the same shape.
 *
 * <pre>
 * { "routes": [ { "name", "targetIds", "excludeIds?", "postgresFunction?",
 *                 "webhookUrl?", "concurrency?", "timeoutSeconds?" } ] }
 * </pre>
 */
public final class RouteTableParser {

    private RouteTableParser() {}

    public static RouteTable parse(String json) {
        if (json == null || json.isBlank()) {
            return RouteTable.empty();
        }
        JsonObject root = new JsonObject(json);
        JsonArray arr = root.getJsonArray("routes");
        if (arr == null || arr.isEmpty()) {
            return RouteTable.empty();
        }
        List<SymptomRoute> routes = new ArrayList<>();
        for (int i = 0; i < arr.size(); i++) {
            routes.add(fromObject(arr.getJsonObject(i)));
        }
        return RouteTable.of(routes);
    }

    static SymptomRoute fromObject(JsonObject o) {
        boolean hasPg = o.containsKey("postgresFunction") && o.getString("postgresFunction") != null;
        boolean hasWh = o.containsKey("webhookUrl") && o.getString("webhookUrl") != null;
        int concurrency = o.containsKey("concurrency")
                ? o.getInteger("concurrency")
                : hasPg ? 2 : 4;
        int timeout = o.containsKey("timeoutSeconds")
                ? o.getInteger("timeoutSeconds")
                : hasPg ? 30 : 15;
        if (!hasPg && hasWh && !o.containsKey("timeoutSeconds")) {
            timeout = 15;
        }
        return new SymptomRoute(
                o.getString("name"),
                stringList(o.getJsonArray("targetIds")),
                stringList(o.getJsonArray("excludeIds")),
                o.getString("postgresFunction"),
                o.getString("webhookUrl"),
                concurrency,
                timeout);
    }

    private static List<String> stringList(JsonArray arr) {
        if (arr == null) {
            return List.of();
        }
        List<String> out = new ArrayList<>(arr.size());
        for (int i = 0; i < arr.size(); i++) {
            out.add(String.valueOf(arr.getValue(i)));
        }
        return out;
    }
}
