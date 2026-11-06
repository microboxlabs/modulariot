package cl.streamhub.gps.model;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
    }
}
