package com.microboxlabs.miot.symptoms.route;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class RouteTableParserTest {

    @Test
    void emptyJsonIsEmptyTable() {
        assertTrue(RouteTableParser.parse("").isEmpty());
        assertTrue(RouteTableParser.parse("{\"routes\":[]}").isEmpty());
    }

    @Test
    void parsesCanaryDocument() {
        String json =
                """
                {
                  "routes": [
                    {
                      "name": "off-hours-driving",
                      "targetIds": ["4"],
                      "postgresFunction": "process_symptoms_off_hours_driving"
                    }
                  ]
                }
                """;
        RouteTable table = RouteTableParser.parse(json);
        SymptomRoute route = table.match(4).orElseThrow();
        assertEquals("off-hours-driving", route.name());
        assertEquals("process_symptoms_off_hours_driving", route.postgresFunction());
        assertEquals(2, route.concurrency());
        assertEquals(30, route.timeoutSeconds());
        assertTrue(table.match(9).isEmpty());
    }

    @Test
    void nullOptionalIntegersUseDefaults() {
        RouteTable table = RouteTableParser.parse(
                """
                {"routes":[{
                  "name":"x",
                  "targetIds":["4"],
                  "postgresFunction":"fn_x",
                  "concurrency":null,
                  "timeoutSeconds":null
                }]}
                """);
        SymptomRoute route = table.match(4).orElseThrow();
        assertEquals(2, route.concurrency());
        assertEquals(30, route.timeoutSeconds());
    }

    @Test
    void numericTargetIdsBecomeStrings() {
        RouteTable table = RouteTableParser.parse(
                "{\"routes\":[{\"name\":\"x\",\"targetIds\":[10],\"postgresFunction\":\"fn_x\"}]}");
        assertEquals("x", table.match(10).orElseThrow().name());
    }
}
