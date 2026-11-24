package com.microboxlabs.miot.teltonika.ingest;

import com.microboxlabs.miot.teltonika.device.RegisteredDevice;
import com.microboxlabs.miot.teltonika.protocol.AvlRecord;
import java.util.List;
import java.util.concurrent.CompletionStage;

/**
 * Destination of the decoded records. The receiver acknowledges a packet to the device only after
 * the returned stage completes; if it fails, no acknowledgment is sent and the device sends the
 * packet again. Records that cannot be published (no position, time out of range, no asset) are
 * counted in the outcome; the receiver keeps the raw packet so they are not lost.
 */
public interface RecordSink {

    /** Teltonika records. */
    CompletionStage<IngestOutcome> publish(RegisteredDevice device, List<AvlRecord> records);

    /**
     * Records already translated, from any source. {@code source} keeps the request IDs of different
     * sources apart ({@code teltonika}, {@code traccar}).
     */
    CompletionStage<IngestOutcome> publish(RegisteredDevice device, String source, List<Candidate> records);

    /** What happened to the records of one packet. */
    record IngestOutcome(int published, int duplicates, int withoutPosition, int outOfTime, int unassigned) {

        public static final IngestOutcome NONE = new IngestOutcome(0, 0, 0, 0, 0);

        /** Records neither published nor already published: kept only in the packet log. */
        public int notPublished() {
            return withoutPosition + outOfTime + unassigned;
        }

        public String reason() {
            StringBuilder sb = new StringBuilder();
            append(sb, "without_position", withoutPosition);
            append(sb, "out_of_time", outOfTime);
            append(sb, "unassigned", unassigned);
            return sb.isEmpty() ? null : sb.toString();
        }

        private static void append(StringBuilder sb, String name, int n) {
            if (n > 0) {
                if (!sb.isEmpty()) {
                    sb.append(',');
                }
                sb.append(name).append('=').append(n);
            }
        }
    }
}
