package com.microboxlabs.miot.symptoms.store;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class PgInboundCallersTest {

    @Test
    void aChileanCallerAlsoMatchesItsNationalForm() {
        assertArrayEquals(new String[] {"56911111111", "911111111"}, PgInboundCallers.forms("+56911111111"));
        assertArrayEquals(new String[] {"12025550101"}, PgInboundCallers.forms("+1 202 555 0101"));
        assertEquals(0, PgInboundCallers.forms("123").length);
        assertEquals(0, PgInboundCallers.forms(null).length);
    }

    @Test
    void theLookupComparesPhoneAndBothChannelsByDigits() {
        assertTrue(PgInboundCallers.CONTACTS.contains("->> 'whatsapp'"));
        assertTrue(PgInboundCallers.CONTACTS.contains("->> 'phone'"));
        assertTrue(PgInboundCallers.CONTACTS.contains("WHERE active"));
        assertTrue(PgInboundCallers.OPEN_CASE.contains("t.status = 'OPEN'"));
    }
}
