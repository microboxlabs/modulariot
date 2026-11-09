package cl.streamhub.gps.model;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class GpsTest {

    @Test
    void distinguishesMissingHeadingFromAnExplicitNorthwardHeading() throws Exception {
        ObjectMapper json = new ObjectMapper();

        assertNull(json.readValue("{}", Gps.class).headingOrNull());
        assertNull(json.readValue("{\"heading\":null}", Gps.class).headingOrNull());
        assertEquals(0.0, json.readValue("{\"heading\":0}", Gps.class).headingOrNull());
        assertEquals(45.0, json.readValue("{\"heading\":45}", Gps.class).headingOrNull());
        assertEquals(0.0, new Gps().getHeading(), "existing primitive callers retain their default");
        Gps north = new Gps();
        north.setHeading(0);
        assertEquals(0.0, north.headingOrNull(), "existing primitive setter preserves an explicit zero");
    }

    @Test
    void headingPresenceSurvivesTheTrackingPublishersJsonRoundTrip() throws Exception {
        ObjectMapper json = new ObjectMapper();
        Gps missing = json.readValue("{}", Gps.class);
        String missingJson = json.writeValueAsString(missing);
        Gps north = json.readValue("{\"heading\":0}", Gps.class);
        String northJson = json.writeValueAsString(north);

        assertFalse(json.readTree(missingJson).has("heading"));
        assertNull(json.readValue(missingJson, Gps.class).headingOrNull());
        assertEquals(0.0, json.readTree(northJson).get("heading").doubleValue());
        assertEquals(0.0, json.readValue(northJson, Gps.class).headingOrNull());
    }
}
