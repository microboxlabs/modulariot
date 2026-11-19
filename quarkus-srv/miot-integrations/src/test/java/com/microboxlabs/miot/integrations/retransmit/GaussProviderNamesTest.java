package com.microboxlabs.miot.integrations.retransmit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;

class GaussProviderNamesTest {

    @Test
    void normalizesOrganizationNames() {
        assertEquals("acme-gps", GaussProviderNames.normalize("Acme GPS"));
        assertEquals("gammatrack", GaussProviderNames.normalize("Gammatrack"));
        assertEquals("transportes-nandu-ltda", GaussProviderNames.normalize("  Transportes Ñandú Ltda. "));
        assertEquals("deltatrack", GaussProviderNames.normalize("DeltaTrack"));
        assertNull(GaussProviderNames.normalize("  -- "));
        assertNull(GaussProviderNames.normalize(null));
    }

    @Test
    void fallsBackToSlugWhenNameHasNoLetters() {
        assertEquals("acme-gps", GaussProviderNames.providerName("Acme GPS", "acmegps"));
        assertEquals("beta", GaussProviderNames.providerName("¿?", "beta"));
        assertNull(GaussProviderNames.providerName(null, " "));
    }
}
