package com.microboxlabs.miot.trips.geo;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.trips.geo.Addresses.Street;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class AddressesTest {

    @Test
    void foldDropsAccentsAndPunctuationButKeepsEnye() {
        assertEquals("AV JOSE PEDRO ALESSANDRI 1166 ÑUÑOA", Addresses.fold("Av. José Pedro Alessandri #1166, Ñuñoa"));
    }

    @Test
    void theKeyAddsTheDistrictOnlyWhenTheAddressDoesNotNameIt() {
        assertEquals("AV LARCO 101 MIRAFLORES", Addresses.key("Av. Larco 101", "Miraflores"));
        assertEquals("AV LARCO 101 MIRAFLORES LIMA", Addresses.key("Av. Larco 101, Miraflores, Lima", "MIRAFLORES"));
    }

    @Test
    void theStreetIsTheTextBeforeTheLastNumber() {
        assertEquals(Optional.of(new Street("Avenida Providencia", "1234")),
                Addresses.street("Avenida Providencia 1234, Of. 501"));
        assertEquals(Optional.of(new Street("Calle 10 de Julio", "456")), Addresses.street("Calle 10 de Julio 456"));
        assertEquals(Optional.of(new Street("Los Leones", "382")), Addresses.street("Los Leones N° 382"));
        assertEquals(Optional.of(new Street("Apoquindo", "3000")), Addresses.street("Apoquindo 3000 Piso 5"));
        assertEquals(Optional.of(new Street("Irarrázaval", "45")), Addresses.street("Irarrázaval #045"));
        assertTrue(Addresses.street("Avenida Providencia").isEmpty());
    }

    @Test
    void spellingsIncludeTheNameWithoutItsPrefix() {
        assertEquals(List.of("AVENIDA PROVIDENCIA", "PROVIDENCIA"), Addresses.spellings("Avenida Providencia", true));
        assertEquals(List.of("ÑUÑOA"), Addresses.spellings("Ñuñoa", false));
        assertEquals(List.of("IRARRÁZAVAL", "IRARRAZAVAL"), Addresses.spellings("Irarrázaval", true));
    }
}
