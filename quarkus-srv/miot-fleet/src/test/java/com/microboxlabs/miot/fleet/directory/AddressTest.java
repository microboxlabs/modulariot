package com.microboxlabs.miot.fleet.directory;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.fleet.directory.FleetDirectoryProducer.Address;
import org.junit.jupiter.api.Test;

class AddressTest {

    @Test
    void readsHostPortAndDatabase() {
        assertEquals(new Address("db.internal", 6432, "gps"), Address.parse("postgresql://user@db.internal:6432/gps"));
        assertEquals(new Address("proxy", 5432, "prod_iot_gps"), Address.parse("proxy:5432/prod_iot_gps?ssl=true"));
        assertEquals(new Address("proxy", 5432, "prod_iot_gps"), Address.parse("postgres://proxy"));
    }
}
