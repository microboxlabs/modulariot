package com.microboxlabs.miot.core.branding;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class EntityTagMatchTest {

    private static final String ETAG = "abc123";

    @Test
    void matchesAStrongValidator() {
        assertTrue(EntityTagMatch.matches("\"abc123\"", ETAG));
    }

    @Test
    void matchesAWeakValidatorSinceGetUsesTheWeakComparison() {
        assertTrue(EntityTagMatch.matches("W/\"abc123\"", ETAG));
    }

    @Test
    void matchesAnyEntryInAList() {
        assertTrue(EntityTagMatch.matches("\"other\", W/\"abc123\"", ETAG));
        assertTrue(EntityTagMatch.matches("\"abc123\", \"other\"", ETAG));
    }

    @Test
    void matchesTheWildcard() {
        assertTrue(EntityTagMatch.matches("*", ETAG));
        assertTrue(EntityTagMatch.matches("  *  ", ETAG));
    }

    @Test
    void doesNotMatchADifferentTag() {
        assertFalse(EntityTagMatch.matches("\"different\"", ETAG));
        assertFalse(EntityTagMatch.matches("\"one\", W/\"two\"", ETAG));
    }

    @Test
    void anAbsentOrEmptyHeaderNeverMatches() {
        assertFalse(EntityTagMatch.matches(null, ETAG));
        assertFalse(EntityTagMatch.matches("", ETAG));
        assertFalse(EntityTagMatch.matches("   ", ETAG));
    }

    @Test
    void aCommaInsideAQuotedTagDoesNotSplitTheList() {
        // RFC 9110 etagc admits "," inside the opaque tag.
        assertTrue(EntityTagMatch.matches("\"a,b\"", "a,b"));
        assertTrue(EntityTagMatch.matches("\"x\", W/\"a,b\"", "a,b"));
        assertFalse(EntityTagMatch.matches("\"a,b\"", "a"));
    }

    @Test
    void anUnquotedValueIsNotAValidator() {
        assertFalse(EntityTagMatch.matches("abc123", ETAG));
    }

    @Test
    void neverMatchesWhenThereIsNoCurrentTag() {
        assertFalse(EntityTagMatch.matches("*", null));
    }
}
