package com.microboxlabs.miot.symptoms;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.scurrilous.circe.checksum.Crc32cIntChecksum;
import io.netty.buffer.ByteBuf;
import io.netty.buffer.Unpooled;
import java.nio.charset.StandardCharsets;
import org.apache.pulsar.client.api.CompressionType;
import org.apache.pulsar.client.api.PulsarClient;
import org.apache.pulsar.common.compression.CompressionCodecProvider;
import org.junit.jupiter.api.Test;

class PulsarDependencyCompatibilityTest {
    @Test
    void bookkeeperChecksumMatchesTheCrc32cTestVector() {
        ByteBuf input = Unpooled.copiedBuffer("123456789", StandardCharsets.US_ASCII);
        try {
            assertEquals(0xe3069283, Crc32cIntChecksum.computeChecksum(input));
        } finally {
            input.release();
        }
    }

    @Test
    void pulsarCompressionRoundTripsWithPatchedAircompressor() throws Exception {
        String message = "Pulsar security dependency compatibility".repeat(20);
        for (CompressionType type : new CompressionType[] {CompressionType.LZ4, CompressionType.ZSTD}) {
            var codec = CompressionCodecProvider.getCompressionCodec(type);
            ByteBuf input = Unpooled.copiedBuffer(message, StandardCharsets.UTF_8);
            ByteBuf encoded = null;
            ByteBuf decoded = null;
            try {
                int size = input.readableBytes();
                encoded = codec.encode(input);
                decoded = codec.decode(encoded, size);
                assertEquals(message, decoded.toString(StandardCharsets.UTF_8), type.name());
            } finally {
                if (decoded != null) decoded.release();
                if (encoded != null) encoded.release();
                input.release();
            }
        }
    }

    @Test
    void httpLookupClientCanBeCreatedWithPatchedDependencies() throws Exception {
        // HTTP lookup constructs Pulsar's AHC adapter. A binary-incompatible AHC
        // upgrade fails here even though applications using pulsar:// still boot.
        // No broker connection is made until a producer or consumer is created.
        try (PulsarClient client = PulsarClient.builder()
                .serviceUrl("http://127.0.0.1:1")
                .ioThreads(1)
                .listenerThreads(1)
                .build()) {
            assertNotNull(client);
        }
    }
}
