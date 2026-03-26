package com.microboxlabs.miot.resource.util;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;

public final class JsonUtil {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private JsonUtil() {}

    public static String toJson(Map<String, Object> map) {
        try {
            return MAPPER.writeValueAsString(map);
        } catch (Exception e) {
            return "{}";
        }
    }

    public static String nvl(Object val) {
        return val != null ? val.toString() : "";
    }
}
