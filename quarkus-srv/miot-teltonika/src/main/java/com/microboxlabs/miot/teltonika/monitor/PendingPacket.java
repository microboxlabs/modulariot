package com.microboxlabs.miot.teltonika.monitor;

/** A packet kept while its device was pending activation, with its row id so it is marked exactly. */
public record PendingPacket(long id, PacketLogEntry entry) {
}
