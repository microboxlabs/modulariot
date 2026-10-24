package com.microboxlabs.miot.conversational.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.conversational.rules.ConnectionChannel;
import org.junit.jupiter.api.Test;

class ChannelTest {

    @Test
    void everyConnectionChannelIsAMessageChannelStoredByItsKey() {
        for (ConnectionChannel c : ConnectionChannel.values()) {
            Channel channel = Channel.fromDb(c.key());
            assertEquals(c.key(), channel.dbValue());
        }
        assertEquals(Channel.WHATSAPP, Channel.fromDb(null));
    }
}
