package com.microboxlabs.miot.core.event;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class TextKeyTest {

    @Test
    void keysIgnoreCaseCombiningMarksAndUnicodeSpacing() {
        assertEquals("planta penon", TextKey.of("  PLANTA\u00a0 \t Pe\u1ab0ñón\uFEFF"));
        assertEquals("planta penon", TextKey.of("Planta Pen\u0303o\u0301n"));
        assertEquals("", TextKey.of(" \u00a0\uFEFF\t"));
        assertEquals("", TextKey.of(null));
    }
}
