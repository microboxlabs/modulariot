import { describe, expect, it } from "vitest";
import { channelLink, dialNumber, phoneDigits } from "./channel-link";

describe("channelLink", () => {
  it("opens WhatsApp with the message typed, and the dialer for a call", () => {
    expect(channelLink("whatsapp", "+1 202 555 0101", "Hola, ¿dónde va?")).toBe(
      "https://wa.me/12025550101?text=Hola%2C%20%C2%BFd%C3%B3nde%20va%3F"
    );
    expect(channelLink("whatsapp", "+12025550101", "  ")).toBe(
      "https://wa.me/12025550101"
    );
    expect(channelLink("phone", "+1 202 555 0101", "x")).toBe(
      "tel:+12025550101"
    );
  });

  it("opens nothing without a usable number, or for Meet and Teams", () => {
    expect(channelLink("whatsapp", "", "x")).toBeNull();
    expect(channelLink("phone", "12", "x")).toBeNull();
    expect(channelLink("phone", "12345", "x")).toBeNull();
    expect(channelLink("meet", "+12025550101", "x")).toBeNull();
    expect(phoneDigits(undefined)).toBeNull();
  });
});

describe("dialNumber", () => {
  it("dials a full number with + and a short service number as it is", () => {
    expect(dialNumber("+56 9 1234 5678")).toBe("+56912345678");
    expect(dialNumber("133")).toBe("133");
    expect(channelLink("phone", "133", "x")).toBe("tel:133");
    expect(dialNumber("12")).toBeNull();
  });
});
