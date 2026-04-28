package com.microboxlabs.miot.core.tax;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.microboxlabs.miot.core.tax.TaxIdValidator.InvalidTaxIdException;
import org.junit.jupiter.api.Test;

class ChileanRutValidatorTest {

    private final ChileanRutValidator validator = new ChileanRutValidator();

    @Test
    void normalizesCanonicalForm() {
        assertEquals("77856310-K", validator.normalize("77856310-K"));
    }

    @Test
    void normalizesLowercaseK() {
        assertEquals("77856310-K", validator.normalize("77856310-k"));
    }

    @Test
    void normalizesWithThousandsSeparators() {
        assertEquals("77856310-K", validator.normalize("77.856.310-K"));
    }

    @Test
    void normalizesWithoutDash() {
        assertEquals("77856310-K", validator.normalize("77856310K"));
    }

    @Test
    void normalizesNumericVerifier() {
        // 96123456-5 is the correct checksum for body 96123456.
        assertEquals("96123456-5", validator.normalize("96123456-5"));
    }

    @Test
    void normalizesTrazaExampleFromSeed() {
        // Traza sub-account seed uses 77656970-4
        assertEquals("77656970-4", validator.normalize("77.656.970-4"));
    }

    @Test
    void rejectsNull() {
        assertThrows(InvalidTaxIdException.class, () -> validator.normalize(null));
    }

    @Test
    void rejectsEmpty() {
        assertThrows(InvalidTaxIdException.class, () -> validator.normalize(""));
    }

    @Test
    void rejectsBadVerifier() {
        assertThrows(InvalidTaxIdException.class, () -> validator.normalize("77856310-0"));
    }

    @Test
    void rejectsNonNumericBody() {
        assertThrows(InvalidTaxIdException.class, () -> validator.normalize("7785A310-K"));
    }

    @Test
    void rejectsTooShort() {
        assertThrows(InvalidTaxIdException.class, () -> validator.normalize("123-4"));
    }

    @Test
    void tryNormalizeReturnsNullOnInvalid() {
        assertEquals(null, validator.tryNormalize("bogus"));
    }

    @Test
    void normalizationIsIdempotent() {
        String once = validator.normalize("77.856.310-K");
        String twice = validator.normalize(once);
        assertEquals(once, twice);
    }
}
