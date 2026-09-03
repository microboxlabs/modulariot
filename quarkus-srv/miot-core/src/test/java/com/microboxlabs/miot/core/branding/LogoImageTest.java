package com.microboxlabs.miot.core.branding;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.ws.rs.BadRequestException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import org.junit.jupiter.api.Test;

class LogoImageTest {

    private static String dataUrl(String mime, byte[] content) {
        return "data:" + mime + ";base64," + Base64.getEncoder().encodeToString(content);
    }

    @Test
    void decodesMimeAndContent() {
        byte[] svg = "<svg/>".getBytes(StandardCharsets.UTF_8);

        LogoImage logo = LogoImage.fromDataUrl(dataUrl("image/svg+xml", svg));

        assertEquals("image/svg+xml", logo.mime());
        assertArrayEquals(svg, logo.content());
    }

    @Test
    void etagIsTheSha256OfTheContent() {
        LogoImage logo = LogoImage.fromDataUrl(
                dataUrl("image/png", "abc".getBytes(StandardCharsets.UTF_8)));

        assertEquals(
                "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
                logo.etag());
    }

    @Test
    void differentContentGetsADifferentEtagSoCachesInvalidate() {
        LogoImage first = LogoImage.fromDataUrl(
                dataUrl("image/png", "one".getBytes(StandardCharsets.UTF_8)));
        LogoImage second = LogoImage.fromDataUrl(
                dataUrl("image/png", "two".getBytes(StandardCharsets.UTF_8)));

        assertNotEquals(first.etag(), second.etag());
    }

    @Test
    void normalizesMimeCase() {
        LogoImage logo = LogoImage.fromDataUrl(
                dataUrl("IMAGE/PNG", "x".getBytes(StandardCharsets.UTF_8)));

        assertEquals("image/png", logo.mime());
    }

    @Test
    void rejectsMimesTheColumnConstraintWouldReject() {
        assertThrows(BadRequestException.class, () -> LogoImage.fromDataUrl(
                dataUrl("text/html", "<b>x</b>".getBytes(StandardCharsets.UTF_8))));
        assertThrows(BadRequestException.class, () -> LogoImage.fromDataUrl(
                dataUrl("image/gif", "x".getBytes(StandardCharsets.UTF_8))));
    }

    @Test
    void rejectsPayloadsOverTheCap() {
        byte[] tooBig = new byte[LogoImage.MAX_BYTES + 1];

        assertThrows(BadRequestException.class,
                () -> LogoImage.fromDataUrl(dataUrl("image/png", tooBig)));
    }

    @Test
    void acceptsPayloadsExactlyAtTheCap() {
        byte[] atCap = new byte[LogoImage.MAX_BYTES];

        assertEquals(LogoImage.MAX_BYTES,
                LogoImage.fromDataUrl(dataUrl("image/png", atCap)).content().length);
    }

    @Test
    void rejectsEmptyContent() {
        assertThrows(BadRequestException.class,
                () -> LogoImage.fromDataUrl(dataUrl("image/png", new byte[0])));
    }

    @Test
    void rejectsNonDataUrls() {
        assertThrows(BadRequestException.class,
                () -> LogoImage.fromDataUrl("https://example.com/logo.png"));
        assertThrows(BadRequestException.class, () -> LogoImage.fromDataUrl(null));
        assertThrows(BadRequestException.class, () -> LogoImage.fromDataUrl("   "));
    }

    @Test
    void rejectsUrlEncodedDataUrlsSinceOnlyBase64IsStored() {
        assertThrows(BadRequestException.class,
                () -> LogoImage.fromDataUrl("data:image/svg+xml,%3Csvg%2F%3E"));
    }

    @Test
    void rejectsMalformedBase64() {
        assertThrows(BadRequestException.class,
                () -> LogoImage.fromDataUrl("data:image/png;base64,not!valid!base64"));
    }
}
