package com.microboxlabs.miot.teltonika.server;

import io.vertx.core.Future;
import java.util.UUID;

/**
 * How this instance reaches a device to send it a command: an open TCP session, or the MQTT
 * commands topic of a device heard recently on the broker.
 */
public interface CommandLink {

    /** Sends a claimed command if the link is idle; completes with whether it was written. */
    Future<Boolean> offerCommand(UUID id, String command);

    String remoteAddress();

    /** Ends the link; a TCP device reconnects. */
    void close();
}
