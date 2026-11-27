package com.microboxlabs.miot.teltonika.protocol;

import java.util.List;

/**
 * A decoded AVL data packet.
 *
 * @param codecId {@link CodecParser#CODEC_8} or {@link CodecParser#CODEC_8_EXTENDED}
 * @param records records in the order the device sent them
 */
public record AvlPacket(int codecId, List<AvlRecord> records) {

    public AvlPacket {
        records = List.copyOf(records);
    }

    /** The count the server must acknowledge. */
    public int recordCount() {
        return records.size();
    }
}
