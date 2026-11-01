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

    private static final List<String> OFFICIAL = List.of("JORGE", "ALESSANDRI", "RODRIGUEZ");

    @Test
    void streetTokensDropTypeTitlesAndConnectingWords() {
        assertEquals(OFFICIAL, Addresses.streetTokens("PRESIDENTE JORGE ALESSANDRI RODRÍGUEZ"));
        assertEquals(List.of("JORGE", "ALESSANDRI", "RODRIGUEZ"),
                Addresses.streetTokens("Av. Pdte. Jorge Alessandri Rodriguez"));
        assertEquals(List.of("10", "JULIO"), Addresses.streetTokens("Calle 10 de Julio"));
    }

    @Test
    void theScoreIsTheShareOfWordsMatchedWhenTheShorterNameMatchesWhole() {
        assertEquals(1.0, Addresses.streetScore(Addresses.streetTokens("Av. Jorge Alessandri Rodriguez"), OFFICIAL));
        assertEquals(1.0, Addresses.streetScore(Addresses.streetTokens("J. Alessandri R."), OFFICIAL));
        assertEquals(2.0 / 3, Addresses.streetScore(Addresses.streetTokens("Jorge Alessandri"), OFFICIAL), 1e-9);
        assertEquals(0.0, Addresses.streetScore(Addresses.streetTokens("Arturo Alessandri"), OFFICIAL));
        assertEquals(0.0, Addresses.streetScore(Addresses.streetTokens("Avenida"), OFFICIAL));
    }

    @Test
    void afterTheNumberIsWhereAnAddressNamesItsCommune() {
        assertEquals("San Bernardo", Addresses.afterNumber("Av. Jorge Alessandri 10700, San Bernardo"));
        assertEquals("San Bernardo", Addresses.afterNumber("Pdte Jorge Alessandri Rodríguez 10700 San Bernardo"));
        assertEquals("", Addresses.afterNumber("Av. Providencia 1234"));
    }

    @Test
    void initialsDoNotConsumeTheMatchOfAFullWord() {
        assertEquals(1.0, Addresses.streetScore(List.of("A", "ALPHA"), List.of("ALPHA", "AMBER")));
        assertEquals(1.0, Addresses.streetScore(List.of("ALPHA", "A"), List.of("ALPHA", "AMBER")));
        assertEquals(1.0, Addresses.streetScore(List.of("ALPHA", "AMBER"), List.of("A", "ALPHA")));
        assertEquals(0.0, Addresses.streetScore(List.of("ALPHA", "BETA"), List.of("A", "AMBER")));
    }

    @Test
    void numberedStreetNamesMustMatchExactly() {
        assertEquals(0.0, Addresses.streetScore(List.of("1", "NORTH"), List.of("10", "NORTH")));
        assertEquals(0.0, Addresses.streetScore(List.of("10", "NORTH"), List.of("1", "NORTH")));
        assertEquals(1.0, Addresses.streetScore(List.of("1", "NORTH"), List.of("1", "NORTH")));
    }

    @Test
    void addressTailKeepsTheTextAfterUnitDetails() {
        assertEquals("Depto 2 District", Addresses.afterNumber("Alpha 123 Depto 2 District"));
        assertEquals("Depto 2, District, Region", Addresses.afterNumber("Alpha 123 Depto 2, District, Region"));
    }
}
